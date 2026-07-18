// POST /api/report
// Simple:  { number, category }  — quick category vote from check page
// Detailed: { phone, category, detail, evidence?, contact?, consent } — tip form at /report
// KV binding: SPAM_KV

const QUICK_CATS = new Set(['scam', 'callcenter', 'ads', 'loan', 'safe']);

const FORM_CATS = new Set(['scam', 'loanshark', 'sms', 'impersonate', 'gambling', 'other']);

const FORM_TO_KV = {
  scam: 'scam',
  loanshark: 'loan',
  sms: 'ads',
  impersonate: 'scam',
  gambling: 'ads',
  other: 'scam',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
    },
  });
}

function normalizePhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('66') && n.length >= 11) n = '0' + n.slice(2);
  return n;
}

function mapCategory(body) {
  const raw = String(body.category || '').toLowerCase();
  if (QUICK_CATS.has(raw)) return raw;
  if (FORM_CATS.has(raw)) return FORM_TO_KV[raw];
  return null;
}

async function recordReport(env, number, category, extras = null) {
  const key = 'num:' + number;
  const raw = await env.SPAM_KV.get(key);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };

  data.reports = (data.reports || 0) + 1;
  data.categories = data.categories || {};
  data.categories[category] = (data.categories[category] || 0) + 1;
  data.lastReport = new Date().toISOString();

  await env.SPAM_KV.put(key, JSON.stringify(data));

  if (extras) {
    const tipKey = `tip:${Date.now()}:${number}`;
    await env.SPAM_KV.put(tipKey, JSON.stringify(extras), { expirationTtl: 60 * 60 * 24 * 365 });
  }

  return data;
}

export async function handleReportPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
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
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:${ip}:${number}:${new Date().toISOString().slice(0, 10)}`;
  if (await env.SPAM_KV.get(rlKey)) return json({ ok: true, deduped: true });
  await env.SPAM_KV.put(rlKey, '1', { expirationTtl: 60 * 60 * 24 * 2 });

  const extras = isDetailed
    ? {
        phone: number,
        category: String(body.category || '').toLowerCase(),
        mappedCategory: category,
        detail: detail.slice(0, 2000),
        evidence: String(body.evidence || '').trim().slice(0, 500),
        contact: String(body.contact || '').trim().slice(0, 200),
        ts: body.ts || new Date().toISOString(),
      }
    : null;

  const data = await recordReport(env, number, category, extras);
  return json({ ok: true, reports: data.reports });
}

export async function onRequestPost(ctx) {
  return handleReportPost(ctx);
}
