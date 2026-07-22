// Shared helpers for the phone-vertical dispute system.
//
// Keys are namespaced by vertical (dispute:phone:*) so future URL / SMS / name
// verticals can add their own dispute streams without colliding — see
// constraint "modular verticals". Reuses SPAM_KV + EVIDENCE_R2; introduces no
// new bindings.

import { MAX_IMAGE_BYTES } from './tip-utils.js';

export { MAX_IMAGE_BYTES };

// --- vocab / validation sets -------------------------------------------------

export const RELATIONSHIPS = new Set(['owner', 'business', 'legal', 'other']);

export const RELATIONSHIP_LABELS = {
  owner: 'เจ้าของเบอร์',
  business: 'ธุรกิจ',
  legal: 'ทนาย / ผู้ดูแล',
  other: 'อื่น ๆ',
};

export const CONTACT_CHANNELS = new Set(['line', 'email', 'none']);

export const CONTACT_CHANNEL_LABELS = {
  line: 'LINE @spaminthai',
  email: 'อีเมล',
  none: 'ไม่ต้องติดต่อกลับ',
};

// pending -> admin reviews -> approved (record flagged on the number) or rejected
export const DISPUTE_STATUSES = new Set(['pending', 'approved', 'rejected']);

export const DISPUTE_STATUS_LABELS = {
  pending: 'รอตรวจสอบ',
  approved: 'รับรองแล้ว',
  rejected: 'ปฏิเสธ',
};

export const REASON_MIN = 30;
export const REASON_MAX = 2000;

// --- key helpers (phone vertical) -------------------------------------------

export const DISPUTE_INDEX_KEY = 'disputes:phone:index';
export const disputeKey = (id) => `dispute:phone:${id}`;
export const disputeRateKey = (ipHashHex, hour) => `dispute:phone:rl:${ipHashHex}:${hour}`;

// --- ULID (Crockford base32, time-sortable) ---------------------------------
// Date.now()/crypto are available in the Cloudflare Worker runtime.

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid() {
  let ts = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[ts % 32] + time;
    ts = Math.floor(ts / 32);
  }
  let rand = '';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) rand += CROCKFORD[bytes[i] & 31];
  return time + rand; // 26 chars, lexicographically time-ordered
}

// Human-facing reference shown on the success page (e.g. DSP-7Q3ZK2).
export function disputeRef(id) {
  return 'DSP-' + String(id).slice(-6).toUpperCase();
}

// --- privacy: hash the reporter IP; never store it raw ----------------------

export async function ipHash(ip, env) {
  const salt = (env && env.IP_HASH_SALT) || 'spaminthai-dispute-v1';
  const data = new TextEncoder().encode(salt + ':' + String(ip || 'unknown'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// --- rate limit: 3 disputes / IP / hour (v1 anti-abuse, no captcha) ---------

export async function withinRateLimit(env, ipHashHex) {
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = disputeRateKey(ipHashHex, hour);
  const current = parseInt((await env.SPAM_KV.get(key)) || '0', 10);
  if (current >= 3) return false;
  await env.SPAM_KV.put(key, String(current + 1), { expirationTtl: 3600 });
  return true;
}

// --- Turnstile: verify only when the secret is configured on the project.
// No-op (allow) otherwise, so we never ship a captcha that rejects everyone.
// Enable end-to-end when BOSS sets TURNSTILE_SECRET on the Pages project.

export async function turnstileOk(env, token, ip) {
  if (!env || !env.TURNSTILE_SECRET) return true; // not configured -> allow
  if (!token) return false;
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

// --- evidence storage (namespaced R2 key; same EVIDENCE_R2 bucket) ----------

export async function storeDisputeEvidence(env, id, bytes, contentType = 'image/jpeg', ext = 'jpg') {
  const r2Key = `dispute/phone/evidence/${id}.${ext}`;
  if (env.EVIDENCE_R2) {
    await env.EVIDENCE_R2.put(r2Key, bytes, { httpMetadata: { contentType } });
    return { storage: 'r2', key: r2Key, contentType };
  }
  const kvKey = `dispute:phone:evidence:${id}`;
  await env.SPAM_KV.put(kvKey, bytes, { expirationTtl: 60 * 60 * 24 * 365 });
  return { storage: 'kv', key: kvKey, contentType };
}

export async function getDisputeEvidence(env, dispute) {
  if (!dispute.evidence_r2_key) return null;
  if (dispute.evidence_storage === 'r2' && env.EVIDENCE_R2) {
    const obj = await env.EVIDENCE_R2.get(dispute.evidence_r2_key);
    if (!obj) return null;
    return new Response(obj.body, {
      headers: {
        'Content-Type': dispute.evidence_content_type || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }
  const obj = await env.SPAM_KV.get(dispute.evidence_r2_key, 'arrayBuffer');
  if (!obj) return null;
  return new Response(obj, {
    headers: {
      'Content-Type': dispute.evidence_content_type || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// --- index (most-recent-first, capped) --------------------------------------

export async function pushDisputeIndex(env, entry) {
  const raw = await env.SPAM_KV.get(DISPUTE_INDEX_KEY);
  const index = raw ? JSON.parse(raw) : [];
  index.unshift(entry);
  await env.SPAM_KV.put(DISPUTE_INDEX_KEY, JSON.stringify(index.slice(0, 500)));
}

export async function updateDisputeIndex(env, id, patch) {
  const raw = await env.SPAM_KV.get(DISPUTE_INDEX_KEY);
  if (!raw) return;
  const index = JSON.parse(raw).map((e) => (e.id === id ? { ...e, ...patch } : e));
  await env.SPAM_KV.put(DISPUTE_INDEX_KEY, JSON.stringify(index));
}
