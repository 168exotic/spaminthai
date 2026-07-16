// POST /api/report — เขียนลง QUEUE_KV แทน SPAM_KV โดยตรง (รอ admin อนุมัติ)
// มี Turnstile, rate limit, validation ฝั่ง server

import { json } from '../_lib/response.js';
import { normalizePhone, isValidThaiPhone } from '../_lib/phone.js';
import { hashIP, getClientIP } from '../_lib/hash.js';
import { checkMultipleLimits } from '../_lib/ratelimit.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import { stripHtml } from '../_lib/security.js';
import { sendAlert } from '../_lib/alert.js';

const CATS = ['scam', 'callcenter', 'ads', 'loan', 'safe'];
const QUEUE_TTL = 60 * 60 * 24 * 30; // 30 วัน

export async function onRequestPost({ request, env }) {
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) return json({ ok: true });

  const cl = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (cl > 2048) return json({ ok: true });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: true });
  }

  const ip = getClientIP(request);
  const ipSalt = env.IP_SALT || '';

  const rl = await checkMultipleLimits(env, 'report', request, [
    { limit: 5, windowSec: 3600 },
    { limit: 20, windowSec: 86400 }
  ], ipSalt);

  if (!rl.allowed) {
    await sendAlert(env, 'rate_limit', `IP hash โดน rate limit ที่ /api/report (retry ${rl.retryAfter}s)`);
    return new Response(JSON.stringify({ error: 'เกินจำนวนครั้งที่กำหนด กรุณาลองใหม่ภายหลัง' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': String(rl.retryAfter),
        'Access-Control-Allow-Origin': 'https://spaminthai.com'
      }
    });
  }

  const turnstileToken = body.turnstile || body['cf-turnstile-response'] || '';
  const ts = await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET);
  if (!ts.ok) {
    await trackTurnstileFail(env);
    return new Response(JSON.stringify({ error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': 'https://spaminthai.com'
      }
    });
  }

  const phone = normalizePhone(body.phone || body.number);
  const category = body.category;
  const detail = stripHtml(body.detail).slice(0, 500);

  if (!isValidThaiPhone(phone)) return json({ ok: true });
  if (!CATS.includes(category)) return json({ ok: true });

  const ipHash = await hashIP(ip, ipSalt);
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);
  const country = request.cf?.country || 'XX';
  const asn = request.cf?.asn || 0;

  if (env.QUEUE_KV) {
    const dedupeKey = `dedupe:${ipHash}:${phone}`;
    if (await env.QUEUE_KV.get(dedupeKey)) return json({ ok: true });
    await env.QUEUE_KV.put(dedupeKey, '1', { expirationTtl: 86400 });

    const random8 = crypto.randomUUID().slice(0, 8);
    const queueKey = `pending:${Date.now()}:${random8}`;
    const entry = {
      phone,
      category,
      detail,
      reporter_ip_hash: ipHash,
      country,
      asn,
      ua,
      ts: Date.now()
    };

    await env.QUEUE_KV.put(queueKey, JSON.stringify(entry), { expirationTtl: QUEUE_TTL });
    await trackQueueSize(env);
  }

  return json({ ok: true });
}

async function trackQueueSize(env) {
  if (!env.QUEUE_KV) return;
  const counterKey = 'counter:reports_hour';
  const raw = await env.QUEUE_KV.get(counterKey);
  const data = raw ? JSON.parse(raw) : { count: 0, since: Date.now() };

  if (Date.now() - data.since > 3600000) {
    data.count = 1;
    data.since = Date.now();
  } else {
    data.count++;
  }

  await env.QUEUE_KV.put(counterKey, JSON.stringify(data), { expirationTtl: 7200 });
  if (data.count > 20) {
    await sendAlert(env, 'queue_spike', `มี report เข้าคิว ${data.count} รายการใน 1 ชม.`);
  }
}

async function trackTurnstileFail(env) {
  if (!env.QUEUE_KV) return;
  const key = 'counter:turnstile_fail';
  const raw = await env.QUEUE_KV.get(key);
  const data = raw ? JSON.parse(raw) : { count: 0, since: Date.now() };

  if (Date.now() - data.since > 3600000) {
    data.count = 1;
    data.since = Date.now();
  } else {
    data.count++;
  }

  await env.QUEUE_KV.put(key, JSON.stringify(data), { expirationTtl: 7200 });
  if (data.count > 50) {
    await sendAlert(env, 'turnstile_fail', `Turnstile verify fail ${data.count} ครั้งใน 1 ชม.`);
  }
}
