// POST /api/report — JSON or multipart (with optional JPG evidence)
// GET  /api/admin/tips — list tips (admin)
// GET  /api/admin/tips/:id — single tip (admin)
// PATCH /api/admin/tips/:id — update status (admin)
// GET  /api/admin/evidence/:id — serve evidence image (admin)

import {
  MAX_IMAGE_BYTES,
  isAdmin,
  json,
  mapCategory,
  newTipId,
  normalizePhone,
  recordReport,
  storeEvidence,
  getEvidence,
  TIP_STATUSES,
  FORM_CAT_LABELS,
} from './tip-utils.js';

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

function isJpeg(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return type === 'image/jpeg' || type === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
}

export async function handleReportPost({ request, env }) {
  const body = await parseReportBody(request);
  if (!body) return json({ error: 'bad_json' }, 400);

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
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:${ip}:${number}:${new Date().toISOString().slice(0, 10)}`;
  if (await env.SPAM_KV.get(rlKey)) return json({ ok: true, deduped: true });
  await env.SPAM_KV.put(rlKey, '1', { expirationTtl: 60 * 60 * 24 * 2 });

  let imageMeta = null;
  const tipId = isDetailed ? newTipId() : null;

  if (isDetailed && body.imageFile) {
    if (!isJpeg(body.imageFile)) return json({ error: 'invalid_image_type' }, 400);
    const bytes = await body.imageFile.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: 'image_too_large' }, 400);
    if (bytes.byteLength > 0) {
      imageMeta = await storeEvidence(env, tipId, bytes);
    }
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
        imageContentType: 'image/jpeg',
      }
    : null;

  const { data } = await recordReport(env, number, category, extras);
  return json({ ok: true, reports: data.reports, tipId });
}

export async function handleAdminTipsList({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

  const status = new URL(request.url).searchParams.get('status');
  const indexRaw = await env.SPAM_KV.get('tips:index');
  let tips = indexRaw ? JSON.parse(indexRaw) : [];

  if (status && TIP_STATUSES.has(status)) {
    tips = tips.filter((t) => t.status === status);
  }

  return json({ tips, labels: FORM_CAT_LABELS });
}

export async function handleAdminTipGet({ request, env, tipId }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);
  return json(JSON.parse(raw));
}

export async function handleAdminTipPatch({ request, env, tipId }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const status = String(body.status || '');
  if (!TIP_STATUSES.has(status)) return json({ error: 'invalid_status' }, 400);

  const tipKey = `tip:${tipId}`;
  const raw = await env.SPAM_KV.get(tipKey);
  if (!raw) return json({ error: 'not_found' }, 404);

  const tip = JSON.parse(raw);
  tip.status = status;
  tip.reviewedAt = new Date().toISOString();
  if (body.note) tip.adminNote = String(body.note).slice(0, 500);

  await env.SPAM_KV.put(tipKey, JSON.stringify(tip), { expirationTtl: 60 * 60 * 24 * 365 });

  const indexRaw = await env.SPAM_KV.get('tips:index');
  if (indexRaw) {
    const index = JSON.parse(indexRaw).map((entry) =>
      entry.id === tipId ? { ...entry, status } : entry,
    );
    await env.SPAM_KV.put('tips:index', JSON.stringify(index));
  }

  return json({ ok: true, tip });
}

export async function handleAdminEvidence({ request, env, tipId }) {
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);

  const tip = JSON.parse(raw);
  const response = await getEvidence(env, tip);
  if (!response) return json({ error: 'no_evidence' }, 404);
  return response;
}

export async function onRequestPost(ctx) {
  return handleReportPost(ctx);
}
