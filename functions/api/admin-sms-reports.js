// Admin queue for community SMS reports. Auth mirrors admin-tips / admin-disputes
// (X-Admin-Key vs TIP_ADMIN_PASSWORD, with lockout via guardAdmin).
//   GET   /admin/api/sms-reports?status=pending   -> list
//   PATCH /admin/api/sms-reports/<id>  { action:'approve'|'reject', note? }
// Approve promotes the hash to sms:hash:<hash> (future checks return "spam").

import { isAdmin, json } from './tip-utils.js';
import { guardAdmin } from './_security.js';
import { smsReportKey, smsHashKey, SMS_REPORTS_INDEX } from './sms-utils.js';

export async function handleAdminSmsReportsList({ request, env }) {
  const denied = await guardAdmin(request, env, isAdmin, json);
  if (denied) return denied;

  const status = new URL(request.url).searchParams.get('status') || '';
  const raw = await env.SPAM_KV.get(SMS_REPORTS_INDEX);
  let reports = raw ? JSON.parse(raw) : [];
  if (status) reports = reports.filter((r) => r.status === status);
  return json({ reports });
}

export async function handleAdminSmsReportPatch({ request, env, id }) {
  const denied = await guardAdmin(request, env, isAdmin, json);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const action = body.action;
  if (action !== 'approve' && action !== 'reject') return json({ error: 'invalid_action' }, 400);

  const raw = await env.SPAM_KV.get(smsReportKey(id));
  if (!raw) return json({ error: 'not_found' }, 404);
  const rec = JSON.parse(raw);

  if (action === 'approve') {
    // Promote the hash so future /api/sms-check on it returns "spam".
    await env.SPAM_KV.put(
      smsHashKey(rec.hash),
      JSON.stringify({ reason: rec.reason, source: 'community', approved_at: new Date().toISOString() }),
    );
    rec.status = 'approved';
  } else {
    rec.status = 'rejected';
  }
  rec.adminNote = String(body.note || '').slice(0, 200);
  rec.reviewed_at = new Date().toISOString();
  await env.SPAM_KV.put(smsReportKey(id), JSON.stringify(rec));

  const idxRaw = await env.SPAM_KV.get(SMS_REPORTS_INDEX);
  if (idxRaw) {
    const idx = JSON.parse(idxRaw).map((e) => (e.id === id ? { ...e, status: rec.status } : e));
    await env.SPAM_KV.put(SMS_REPORTS_INDEX, JSON.stringify(idx));
  }
  return json({ ok: true, status: rec.status });
}
