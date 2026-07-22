// POST /api/dispute — file a tracked dispute against a phone-number record.
//
// Multipart form (evidence upload) or JSON. Stores under dispute:phone:<ULID>
// in SPAM_KV, evidence in EVIDENCE_R2. v1 anti-abuse = rate limit (3/IP/hr);
// Turnstile is verified only when TURNSTILE_SECRET is set (no-op otherwise).

import {
  isAllowedImage,
  imageExtension,
  normalizePhone,
  json,
} from './tip-utils.js';

import {
  RELATIONSHIPS,
  CONTACT_CHANNELS,
  REASON_MIN,
  REASON_MAX,
  MAX_IMAGE_BYTES,
  ulid,
  disputeRef,
  disputeKey,
  ipHash,
  withinRateLimit,
  turnstileOk,
  storeDisputeEvidence,
  pushDisputeIndex,
} from './dispute-utils.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function parseBody(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return {
      num: form.get('num') || form.get('phone'),
      relationship: form.get('relationship'),
      reason: form.get('reason'),
      contact_channel: form.get('contact_channel'),
      contact_value: form.get('contact_value'),
      turnstileToken: form.get('cf-turnstile-response'),
      imageFile: form.get('evidence'),
    };
  }
  try {
    const b = await request.json();
    return {
      num: b.num || b.phone,
      relationship: b.relationship,
      reason: b.reason,
      contact_channel: b.contact_channel,
      contact_value: b.contact_value,
      turnstileToken: b.turnstileToken,
      imageFile: null,
    };
  } catch {
    return null;
  }
}

// Pure validation — unit-tested in scripts/test-dispute.mjs (no KV needed).
export function validateDispute(fields) {
  const num = normalizePhone(fields.num);
  if (num.length < 9 || num.length > 10) return { ok: false, error: 'invalid_number' };

  const relationship = String(fields.relationship || '');
  if (!RELATIONSHIPS.has(relationship)) return { ok: false, error: 'invalid_relationship' };

  const reason = String(fields.reason || '').trim();
  if (reason.length < REASON_MIN) return { ok: false, error: 'reason_too_short' };
  if (reason.length > REASON_MAX) return { ok: false, error: 'reason_too_long' };

  const contact_channel = String(fields.contact_channel || '');
  if (!CONTACT_CHANNELS.has(contact_channel)) return { ok: false, error: 'invalid_contact_channel' };

  let contact_value = String(fields.contact_value || '').trim().slice(0, 200);
  if (contact_channel === 'email') {
    if (!contact_value) return { ok: false, error: 'email_required' };
    if (!EMAIL_RE.test(contact_value)) return { ok: false, error: 'invalid_email' };
  }
  if (contact_channel !== 'email') contact_value = contact_channel === 'line' ? contact_value : '';

  return { ok: true, clean: { num, relationship, reason, contact_channel, contact_value } };
}

export async function handleDisputePost({ request, env }) {
  const fields = await parseBody(request);
  if (!fields) return json({ error: 'bad_request' }, 400);

  const v = validateDispute(fields);
  if (!v.ok) return json({ error: v.error }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Captcha (no-op unless TURNSTILE_SECRET is configured on the project).
  if (!(await turnstileOk(env, fields.turnstileToken, ip))) {
    return json({ error: 'captcha_failed' }, 400);
  }

  // Rate limit: 3 disputes / IP / hour.
  const ipHex = await ipHash(ip, env);
  if (!(await withinRateLimit(env, ipHex))) {
    return json({ error: 'rate_limited' }, 429);
  }

  const id = ulid();

  // Optional evidence image (may contain an ID card — never logged anywhere).
  let evidence = null;
  if (fields.imageFile && typeof fields.imageFile.arrayBuffer === 'function') {
    const bytes = await fields.imageFile.arrayBuffer();
    if (bytes.byteLength > 0) {
      if (!isAllowedImage(fields.imageFile)) return json({ error: 'invalid_image_type' }, 400);
      if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: 'image_too_large' }, 400);
      const ext = imageExtension(fields.imageFile);
      const ct = String(fields.imageFile.type || `image/${ext}`).toLowerCase();
      evidence = await storeDisputeEvidence(env, id, bytes, ct, ext);
    }
  }

  const createdAt = new Date().toISOString();
  const record = {
    id,
    ref: disputeRef(id),
    vertical: 'phone',
    num: v.clean.num,
    relationship: v.clean.relationship,
    reason: v.clean.reason,
    contact_channel: v.clean.contact_channel,
    contact_value: v.clean.contact_value || null,
    evidence_r2_key: evidence?.key || null,
    evidence_storage: evidence?.storage || null,
    evidence_content_type: evidence?.contentType || null,
    created_at: createdAt,
    ip_hash: ipHex,
    status: 'pending',
  };

  await env.SPAM_KV.put(disputeKey(id), JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 365,
  });
  await pushDisputeIndex(env, {
    id,
    ref: record.ref,
    num: record.num,
    relationship: record.relationship,
    reasonPreview: record.reason.slice(0, 80),
    hasImage: Boolean(record.evidence_r2_key),
    status: 'pending',
    created_at: createdAt,
  });

  return json({ ok: true, id, ref: record.ref });
}

export async function onRequestPost(ctx) {
  return handleDisputePost(ctx);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
