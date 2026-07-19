// Admin API for scam tip review (/api/admin/tips, evidence)

import {
  isAdmin,
  json,
  getEvidence,
  TIP_STATUSES,
  FORM_CAT_LABELS,
} from './tip-utils.js';

function adminGuard(request, env) {
  if (!env.TIP_ADMIN_PASSWORD) {
    return json({ error: 'admin_not_configured' }, 503);
  }
  if (!isAdmin(request, env)) {
    return json({ error: 'unauthorized' }, 401);
  }
  return null;
}

export async function handleAdminTipsList({ request, env }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get('status');
  const indexRaw = await env.SPAM_KV.get('tips:index');
  let tips = indexRaw ? JSON.parse(indexRaw) : [];

  if (status && TIP_STATUSES.has(status)) {
    tips = tips.filter((t) => t.status === status);
  }

  return json({ tips, labels: FORM_CAT_LABELS });
}

export async function handleAdminTipGet({ request, env, tipId }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);
  return json(JSON.parse(raw));
}

export async function handleAdminTipPatch({ request, env, tipId }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

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
  const denied = adminGuard(request, env);
  if (denied) return denied;

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);

  const tip = JSON.parse(raw);
  const response = await getEvidence(env, tip);
  if (!response) return json({ error: 'no_evidence' }, 404);
  return response;
}
