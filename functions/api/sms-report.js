// POST /api/sms-report  { hash, tokens?, reason }  ->  { ok, id }
// Community report of a spam SMS. Stores the hash + tokens + reason only — never
// the message body. Pending until an admin approves it on /admin/sms-reports.

import { json } from './tip-utils.js';
import { checkRateLimit, clientIp, ipHash } from './_security.js';
import { ulid } from './dispute-utils.js';
import {
  isValidHash,
  cleanTokens,
  smsReportKey,
  SMS_REPORTS_INDEX,
  REASON_MAX,
} from './sms-utils.js';

const REPORT_RL = { max: 20, windowSec: 3600, bucket: 'hour' };

export async function handleSmsReport({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!isValidHash(body.hash)) return json({ error: 'invalid_hash' }, 400);
  const reason = String(body.reason || '').trim().slice(0, REASON_MAX);
  if (reason.length < 3) return json({ error: 'reason_required' }, 400);

  const ip = clientIp(request);
  const rl = await checkRateLimit(env, 'sms-report', ip, REPORT_RL);
  if (!rl.allowed) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter || 3600) });

  const id = ulid();
  const record = {
    id,
    hash: body.hash.toLowerCase(),
    tokens: cleanTokens(body.tokens),
    reason,
    status: 'pending',
    created_at: new Date().toISOString(),
    ip_hash: await ipHash(ip, 'sms-report'),
  };
  await env.SPAM_KV.put(smsReportKey(id), JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });

  const raw = await env.SPAM_KV.get(SMS_REPORTS_INDEX);
  const index = raw ? JSON.parse(raw) : [];
  index.unshift({ id, hash: record.hash, reasonPreview: reason.slice(0, 80), status: 'pending', created_at: record.created_at });
  await env.SPAM_KV.put(SMS_REPORTS_INDEX, JSON.stringify(index.slice(0, 500)));

  return json({ ok: true, id });
}

export async function onRequestPost(ctx) {
  return handleSmsReport(ctx);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
