// Admin API for scam tip review (/api/admin/tips, evidence)

import {
  isAdmin,
  json,
  getEvidence,
  TIP_STATUSES,
  FORM_CAT_LABELS,
} from './tip-utils.js';
import { guardAdmin } from './_security.js';
import { isEmailAddress, mailConfigured, mailProvider } from './mail.js';
import { autoAckEnabled, sendTipAckById, tipAckRecipient } from './tip-ack-mail.js';

async function adminGuard(request, env) {
  return guardAdmin(request, env, isAdmin, json);
}

/** What the admin UI needs to know about outbound mail (never the keys themselves). */
function mailStatus(env) {
  return {
    configured: mailConfigured(env),
    provider: mailProvider(env),
    autoAck: autoAckEnabled(env),
    from: env.MAIL_FROM || 'SpamInThai <admin@spaminthai.com>',
  };
}

export async function handleAdminTipsList({ request, env }) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get('status');
  const indexRaw = await env.SPAM_KV.get('tips:index');
  let tips = indexRaw ? JSON.parse(indexRaw) : [];

  if (status && TIP_STATUSES.has(status)) {
    tips = tips.filter((t) => t.status === status);
  }

  return json({ tips, labels: FORM_CAT_LABELS, mail: mailStatus(env) });
}

/**
 * POST /api/admin/tips/:id/ack-email  — send (or re-send) the "ได้รับเรื่องแล้ว" email.
 * Body (optional): { to: "someone@example.com" } to override the reporter's contact.
 * Always a forced send: the admin pressed the button on purpose.
 */
export async function handleAdminTipAckEmail({ request, env, tipId }) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;

  if (!mailConfigured(env)) return json({ error: 'mail_not_configured', mail: mailStatus(env) }, 503);

  let body = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const override = String(body.to || '').trim();
  if (override && !isEmailAddress(override)) return json({ error: 'invalid_email' }, 400);

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);
  const tip = JSON.parse(raw);
  if (!tipAckRecipient(tip, override)) return json({ error: 'no_email', contact: tip.contact || null }, 400);

  const res = await sendTipAckById(env, tipId, { to: override || undefined, force: true });
  if (!res.ok) {
    return json({ ok: false, error: res.error || 'send_failed', ackEmail: res.ackEmail || null }, 502);
  }
  return json({ ok: true, ackEmail: res.ackEmail });
}

export async function handleAdminTipGet({ request, env, tipId }) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);
  return json(JSON.parse(raw));
}

export async function handleAdminTipPatch({ request, env, tipId }) {
  const denied = await adminGuard(request, env);
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
  const denied = await adminGuard(request, env);
  if (denied) return denied;

  const raw = await env.SPAM_KV.get(`tip:${tipId}`);
  if (!raw) return json({ error: 'not_found' }, 404);

  const tip = JSON.parse(raw);
  const response = await getEvidence(env, tip);
  if (!response) return json({ error: 'no_evidence' }, 404);
  return response;
}
