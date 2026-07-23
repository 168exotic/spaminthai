// POST /api/report
// Legacy: { number|phone, category } or multipart tip form
// Loanapp: { entity_type, value, name?, category?, detail? }

import {
  MAX_IMAGE_BYTES,
  isAllowedImage,
  imageExtension,
  json,
  mapCategory,
  newTipId,
  normalizePhone,
  recordReport,
  storeEvidence,
} from './tip-utils.js';

const LOANAPP_TYPES = ['phone', 'pkg', 'domain', 'line', 'name'];
const LOANAPP_CATEGORIES = ['loan_shark', 'scam', 'spam', 'gambling', 'other'];

async function parseReportBody(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return {
      phone: form.get('phone'),
      category: form.get('category'),
      detail: form.get('detail'),
      evidence: form.get('evidence'),
      contact: form.get('contact'),
      consent: form.get('consent') === 'true' || form.get('consent') === 'on',
      ts: form.get('ts'),
      imageFile: form.get('evidenceImage'),
    };
  }
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeLoanappPhone(v) {
  let p = String(v).replace(/[\s\-()]/g, '');
  if (p.startsWith('+66')) p = '0' + p.slice(3);
  if (p.startsWith('66') && p.length >= 11) p = '0' + p.slice(2);
  return p;
}

async function handleLoanappReport(env, body) {
  const type = body.entity_type;
  if (!LOANAPP_TYPES.includes(type)) {
    return json({ ok: false, error: 'invalid entity_type' }, 400);
  }

  let value = (body.value || '').trim();
  if (!value || value.length > 200) return json({ ok: false, error: 'invalid value' }, 400);
  value = type === 'phone' ? normalizeLoanappPhone(value) : value.toLowerCase();
  if (type === 'line' && !value.startsWith('@')) value = '@' + value;

  const category = LOANAPP_CATEGORIES.includes(body.category) ? body.category : 'loan_shark';

  if (type === 'phone') {
    const numKey = `num:${value}`;
    let numRec;
    try { numRec = JSON.parse((await env.SPAM_KV.get(numKey)) || '{}'); } catch { numRec = {}; }
    numRec.reports = (numRec.reports || 0) + 1;
    numRec.categories = numRec.categories || {};
    numRec.categories[category] = (numRec.categories[category] || 0) + 1;
    numRec.lastReport = new Date().toISOString();
    await env.SPAM_KV.put(numKey, JSON.stringify(numRec));
  }

  const key = type === 'phone' && category !== 'loan_shark'
    ? null
    : `loanapp:${type}:${value}`;
  if (!key) return json({ ok: true, key: `num:${value}` });

  const today = new Date().toISOString().slice(0, 10);
  const existing = await env.SPAM_KV.get(key);
  let record;

  if (existing) {
    try { record = JSON.parse(existing); } catch { record = {}; }
    record.reports = (record.reports || 0) + 1;
    record.last_seen = today;
    if (body.name && record.name && body.name !== record.name) {
      record.aliases = [...new Set([...(record.aliases || []), record.name])];
      record.name = body.name;
    }
  } else {
    record = {
      name: (body.name || '').slice(0, 100) || value,
      aliases: [],
      type: category,
      risk: 'high',
      evidence: [],
      related: [],
      reports: 1,
      first_seen: today,
      last_seen: today,
      source: 'user_report',
    };
  }

  if (body.detail) {
    record.evidence = [...new Set([...(record.evidence || []), String(body.detail).slice(0, 200)])].slice(0, 20);
  }

  await env.SPAM_KV.put(key, JSON.stringify(record));
  return json({ ok: true, key, reports: record.reports });
}

export async function handleReportPost({ request, env }) {
  const body = await parseReportBody(request);
  if (!body) return json({ error: 'bad_json' }, 400);

  if (body.entity_type) {
    return handleLoanappReport(env, body);
  }

  const number = normalizePhone(body.number || body.phone);
  const category = mapCategory(body);
  const isDetailed = Boolean(body.detail);

  if (number.length < 9 || number.length > 10) return json({ error: 'invalid_number' }, 400);
  if (!category) return json({ error: 'invalid_category' }, 400);

  let detail = '';
  if (isDetailed) {
    detail = String(body.detail || '').trim();
    if (detail.length < 10) return json({ error: 'detail_too_short' }, 400);
    if (!body.consent) return json({ error: 'consent_required' }, 400);
    if (!String(body.contact || '').trim()) return json({ error: 'contact_required' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:${ip}:${number}:${new Date().toISOString().slice(0, 10)}`;
  if (await env.SPAM_KV.get(rlKey)) return json({ ok: true, deduped: true });
  await env.SPAM_KV.put(rlKey, '1', { expirationTtl: 60 * 60 * 24 * 2 });

  let imageMeta = null;
  const tipId = isDetailed ? newTipId() : null;

  if (isDetailed) {
    const img = body.imageFile;
    if (!img || typeof img.arrayBuffer !== 'function') {
      return json({ error: 'image_required' }, 400);
    }
    const bytes = await img.arrayBuffer();
    if (bytes.byteLength === 0) return json({ error: 'image_required' }, 400);
    if (!isAllowedImage(img)) return json({ error: 'invalid_image_type' }, 400);
    if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: 'image_too_large' }, 400);
    const ext = imageExtension(img);
    const contentType = String(img.type || `image/${ext}`).toLowerCase();
    imageMeta = await storeEvidence(env, tipId, bytes, contentType, ext);
  }

  const extras = isDetailed
    ? {
        id: tipId,
        category: String(body.category || '').toLowerCase(),
        detail: detail.slice(0, 2000),
        evidence: String(body.evidence || '').trim().slice(0, 500),
        contact: String(body.contact || '').trim().slice(0, 200),
        ts: body.ts || new Date().toISOString(),
        status: 'pending',
        imageKey: imageMeta?.key || null,
        imageStorage: imageMeta?.storage || null,
        imageContentType: imageMeta?.contentType || null,
      }
    : null;

  const { data } = await recordReport(env, number, category, extras);
  return json({ ok: true, reports: data.reports, tipId });
}

export async function onRequestPost(ctx) {
  return handleReportPost(ctx);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
