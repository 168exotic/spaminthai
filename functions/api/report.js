// POST /api/report
// body: { entity_type: "phone"|"pkg"|"domain"|"line", value, name?, category?, detail? }
// สร้าง/อัปเดต record + นับ reports สะสม

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function normalizePhone(v) {
  let p = v.replace(/[\s\-()]/g, '');
  if (p.startsWith('+66')) p = '0' + p.slice(3);
  if (p.startsWith('66') && p.length >= 11) p = '0' + p.slice(2);
  return p;
}

const VALID_TYPES = ['phone', 'pkg', 'domain', 'line', 'name'];
const VALID_CATEGORIES = ['loan_shark', 'scam', 'spam', 'gambling', 'other'];

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400); }

  const type = body.entity_type;
  if (!VALID_TYPES.includes(type)) return json({ ok: false, error: 'invalid entity_type' }, 400);

  let value = (body.value || '').trim();
  if (!value || value.length > 200) return json({ ok: false, error: 'invalid value' }, 400);
  value = type === 'phone' ? normalizePhone(value) : value.toLowerCase();
  if (type === 'line' && !value.startsWith('@')) value = '@' + value;

  const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'loan_shark';

  // เบอร์โทร: อัปเดต key เดิม num:<เบอร์> ให้ระบบเก่าเห็นด้วยเสมอ
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
    ? null // สแปมทั่วไปจบที่ num: แล้ว
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}
