// Admin API for dispute review (/api/admin/disputes, dispute-evidence).
// Auth + shape mirror admin-tips.js exactly (X-Admin-Key vs TIP_ADMIN_PASSWORD).

import { isAdmin, json } from './tip-utils.js';
import {
  DISPUTE_STATUSES,
  DISPUTE_INDEX_KEY,
  RELATIONSHIP_LABELS,
  CONTACT_CHANNEL_LABELS,
  disputeKey,
  getDisputeEvidence,
  updateDisputeIndex,
} from './dispute-utils.js';

function adminGuard(request, env) {
  if (!env.TIP_ADMIN_PASSWORD) {
    return json({ error: 'admin_not_configured' }, 503);
  }
  if (!isAdmin(request, env)) {
    return json({ error: 'unauthorized' }, 401);
  }
  return null;
}

export async function handleAdminDisputesList({ request, env }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get('status');
  const raw = await env.SPAM_KV.get(DISPUTE_INDEX_KEY);
  let disputes = raw ? JSON.parse(raw) : [];

  if (status && DISPUTE_STATUSES.has(status)) {
    disputes = disputes.filter((d) => d.status === status);
  }

  return json({
    disputes,
    relationshipLabels: RELATIONSHIP_LABELS,
    contactLabels: CONTACT_CHANNEL_LABELS,
  });
}

export async function handleAdminDisputeGet({ request, env, id }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

  const raw = await env.SPAM_KV.get(disputeKey(id));
  if (!raw) return json({ error: 'not_found' }, 404);
  return json(JSON.parse(raw));
}

export async function handleAdminDisputePatch({ request, env, id }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const status = String(body.status || '');
  if (!DISPUTE_STATUSES.has(status)) return json({ error: 'invalid_status' }, 400);

  // Approve/Reject both require an admin note.
  const note = String(body.note || '').trim();
  if ((status === 'approved' || status === 'rejected') && !note) {
    return json({ error: 'note_required' }, 400);
  }

  const key = disputeKey(id);
  const raw = await env.SPAM_KV.get(key);
  if (!raw) return json({ error: 'not_found' }, 404);

  const dispute = JSON.parse(raw);
  dispute.status = status;
  dispute.reviewedAt = new Date().toISOString();
  if (note) dispute.adminNote = note.slice(0, 500);

  await env.SPAM_KV.put(key, JSON.stringify(dispute), { expirationTtl: 60 * 60 * 24 * 365 });
  await updateDisputeIndex(env, id, { status });

  // Approve -> flag the number record so /check shows a caveat.
  // Reject -> clear the flag if THIS dispute set it.
  await applyToNumberRecord(env, dispute, status, note);

  return json({ ok: true, dispute });
}

async function applyToNumberRecord(env, dispute, status, note) {
  const numKey = 'num:' + dispute.num;
  const raw = await env.SPAM_KV.get(numKey);
  let rec;
  try {
    rec = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };
  } catch {
    rec = { reports: 0, categories: {}, lastReport: null };
  }

  if (status === 'approved') {
    rec.disputed_status = 'approved';
    rec.disputed_at = new Date().toISOString();
    rec.disputed_note = note.slice(0, 300);
    rec.disputed_by = dispute.id;
  } else if (status === 'rejected' && rec.disputed_by === dispute.id) {
    delete rec.disputed_status;
    delete rec.disputed_at;
    delete rec.disputed_note;
    delete rec.disputed_by;
  } else {
    return; // nothing to change on the number record
  }

  await env.SPAM_KV.put(numKey, JSON.stringify(rec));
}

export async function handleAdminDisputeEvidence({ request, env, id }) {
  const denied = adminGuard(request, env);
  if (denied) return denied;

  const raw = await env.SPAM_KV.get(disputeKey(id));
  if (!raw) return json({ error: 'not_found' }, 404);

  const dispute = JSON.parse(raw);
  const response = await getDisputeEvidence(env, dispute);
  if (!response) return json({ error: 'no_evidence' }, 404);
  return response;
}
