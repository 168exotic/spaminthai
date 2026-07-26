// POST /api/sms-check  { hash, tokens? }  ->  { verdict, confidence, source }
// PRIVACY: only the SHA-256 hash (+ optional keyword tokens) is received; the
// SMS body is never sent or stored.

import { json } from './tip-utils.js';
import { checkRateLimit, clientIp } from './_security.js';
import {
  isValidHash,
  cleanTokens,
  resolveVerdict,
  smsHashKey,
  smsSafeKey,
  loadKeywords,
} from './sms-utils.js';

const SMS_RL = { max: 60, windowSec: 60, bucket: 'minute' };

export async function handleSmsCheck({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!isValidHash(body.hash)) return json({ error: 'invalid_hash' }, 400);

  const ip = clientIp(request);
  const rl = await checkRateLimit(env, 'sms', ip, SMS_RL);
  if (!rl.allowed) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter || 60) });

  const hash = body.hash.toLowerCase();
  const tokens = cleanTokens(body.tokens);

  const [safeHit, spamHit] = await Promise.all([
    env.SPAM_KV.get(smsSafeKey(hash)),
    env.SPAM_KV.get(smsHashKey(hash)),
  ]);

  let keywordHit = false;
  if (!safeHit && !spamHit && tokens.length) {
    const kws = (await loadKeywords(env)).map((k) => String(k).toLowerCase());
    keywordHit = tokens.some((t) => kws.some((k) => t.includes(k)));
  }

  return json(resolveVerdict({ safeHit: Boolean(safeHit), spamHit: Boolean(spamHit), keywordHit }));
}

export async function onRequestPost(ctx) {
  return handleSmsCheck(ctx);
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
