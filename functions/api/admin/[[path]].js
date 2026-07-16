// Admin API — ทุก route ต้องผ่าน auth ก่อน
// ไม่ผ่าน → 404 (ไม่เปิดเผยว่ามี admin)

import { isAdminAuthorized } from '../../_lib/auth.js';
import { json } from '../../_lib/response.js';
import { sendAlert } from '../../_lib/alert.js';

const CATS = ['scam', 'callcenter', 'ads', 'loan', 'safe'];

export async function onRequest({ request, env, params }) {
  const authorized = await isAdminAuthorized(request, env);
  if (!authorized) {
    await sendAlert(env, 'admin_unauth', `มีคนพยายามเข้า /api/admin/${params.path || ''} โดยไม่มี auth`);
    return new Response('Not Found', { status: 404 });
  }

  const path = params.path || '';
  const method = request.method;

  if (method === 'GET' && path === 'queue') return listQueue(env);
  if (method === 'POST' && path === 'approve') return approve(request, env);
  if (method === 'POST' && path === 'reject') return reject(request, env);

  return new Response('Not Found', { status: 404 });
}

/** ดึงรายการ pending จาก QUEUE_KV */
async function listQueue(env) {
  if (!env.QUEUE_KV) return json({ items: [] });

  const list = await env.QUEUE_KV.list({ prefix: 'pending:' });
  const items = [];

  for (const key of list.keys) {
    const raw = await env.QUEUE_KV.get(key.name);
    if (!raw) continue;
    const entry = JSON.parse(raw);
    const dupes = await countDupes(env, entry.phone);
    items.push({ id: key.name, ...entry, dupes });
  }

  items.sort((a, b) => b.ts - a.ts);
  return json({ items, total: items.length });
}

/** นับ report ซ้ำของเบอร์เดียวกันในคิว */
async function countDupes(env, phone) {
  const list = await env.QUEUE_KV.list({ prefix: 'pending:' });
  let count = 0;
  for (const key of list.keys) {
    const raw = await env.QUEUE_KV.get(key.name);
    if (raw && JSON.parse(raw).phone === phone) count++;
  }
  return count;
}

/** อนุมัติ report — ย้ายเข้า SPAM_KV แล้วลบจากคิว */
async function approve(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const ids = body.all ? await getAllPendingIds(env) : [body.id].filter(Boolean);
  let approved = 0;

  for (const id of ids) {
    const raw = await env.QUEUE_KV.get(id);
    if (!raw) continue;

    const entry = JSON.parse(raw);
    const key = 'num:' + entry.phone;
    const existing = await env.SPAM_KV.get(key);
    const data = existing ? JSON.parse(existing) : { reports: 0, categories: {}, lastReport: null };

    data.reports += 1;
    data.categories[entry.category] = (data.categories[entry.category] || 0) + 1;
    data.lastReport = Date.now();

    await env.SPAM_KV.put(key, JSON.stringify(data));
    await env.QUEUE_KV.delete(id);
    await writeAudit(env, 'approve', id, entry);
    approved++;
  }

  return json({ ok: true, approved });
}

/** ปฏิเสธ report — ลบจากคิว */
async function reject(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const id = body.id;
  if (!id) return json({ error: 'missing_id' }, 400);

  const raw = await env.QUEUE_KV.get(id);
  if (raw) {
    await writeAudit(env, 'reject', id, JSON.parse(raw));
    await env.QUEUE_KV.delete(id);
  }

  return json({ ok: true });
}

async function getAllPendingIds(env) {
  const list = await env.QUEUE_KV.list({ prefix: 'pending:' });
  return list.keys.map((k) => k.name);
}

/** เขียน audit log ลง QUEUE_KV */
async function writeAudit(env, action, reportId, entry) {
  const auditKey = `audit:${Date.now()}`;
  await env.QUEUE_KV.put(auditKey, JSON.stringify({
    action,
    reportId,
    phone: entry.phone,
    category: entry.category,
    ts: Date.now()
  }), { expirationTtl: 60 * 60 * 24 * 90 });
}
