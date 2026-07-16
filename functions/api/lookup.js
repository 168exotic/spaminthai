// GET /api/lookup?number=0812345678
// มี rate limit, anti-scraping (Origin/Referer), honeytoken

import { identifyCarrier } from './carrier.js';
import { json, isAllowedOrigin } from '../_lib/response.js';
import { normalizePhone, isValidThaiPhone } from '../_lib/phone.js';
import { checkMultipleLimits } from '../_lib/ratelimit.js';
import { addHoneytoken } from '../_lib/security.js';
import { sendAlert } from '../_lib/alert.js';
import { assess } from './lookup-assess.js';

export { assess };

export async function onRequestGet({ request, env }) {
  if (!isAllowedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const ipSalt = env.IP_SALT || '';

  const rl = await checkMultipleLimits(env, 'lookup', request, [
    { limit: 30, windowSec: 60 },
    { limit: 300, windowSec: 3600 }
  ], ipSalt);

  if (!rl.allowed) {
    await sendAlert(env, 'lookup_rate', 'IP โดน rate limit ที่ /api/lookup');
    return new Response(JSON.stringify({ error: 'เกินจำนวนครั้งที่กำหนด กรุณาลองใหม่ภายหลัง' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': String(rl.retryAfter),
        'Access-Control-Allow-Origin': 'https://spaminthai.com'
      }
    });
  }

  const url = new URL(request.url);
  const number = normalizePhone(url.searchParams.get('number') || '');

  if (!isValidThaiPhone(number)) {
    return json({ error: 'invalid_number' }, 400);
  }

  const raw = await env.SPAM_KV.get('num:' + number);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };

  const result = addHoneytoken({
    number,
    ...data,
    ...assess(data),
    ...identifyCarrier(number)
  });

  return json(result, 200, { 'Cache-Control': 'public, max-age=60' });
}
