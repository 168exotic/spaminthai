// Shared helpers for scam tip reports and admin review.

export const QUICK_CATS = new Set(['scam', 'callcenter', 'ads', 'loan', 'safe']);

export const FORM_CATS = new Set(['scam', 'loanshark', 'sms', 'impersonate', 'gambling', 'other']);

export const FORM_TO_KV = {
  scam: 'scam',
  loanshark: 'loan',
  sms: 'ads',
  impersonate: 'scam',
  gambling: 'ads',
  other: 'scam',
};

export const FORM_CAT_LABELS = {
  scam: 'แก๊งคอลเซ็นเตอร์ / หลอกโอนเงิน',
  loanshark: 'เงินกู้นอกระบบ',
  sms: 'SMS หลอกลวง',
  impersonate: 'แอบอ้างหน่วยงานรัฐ',
  gambling: 'ชักชวนพนันออนไลน์',
  other: 'อื่น ๆ',
};

export const TIP_STATUSES = new Set(['pending', 'reviewed', 'actioned', 'dismissed']);

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      ...extraHeaders,
    },
  });
}

export function normalizePhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('66') && n.length >= 11) n = '0' + n.slice(2);
  return n;
}

export function mapCategory(body) {
  const raw = String(body.category || '').toLowerCase();
  if (QUICK_CATS.has(raw)) return raw;
  if (FORM_CATS.has(raw)) return FORM_TO_KV[raw];
  return null;
}

export function isAdmin(request, env) {
  const key = request.headers.get('X-Admin-Key') || '';
  const expected = env.TIP_ADMIN_PASSWORD || '';
  return Boolean(expected) && key === expected;
}

export function newTipId() {
  return crypto.randomUUID();
}

export async function storeEvidence(env, tipId, bytes, contentType = 'image/jpeg') {
  const r2Key = `evidence/${tipId}.jpg`;
  if (env.EVIDENCE_R2) {
    await env.EVIDENCE_R2.put(r2Key, bytes, { httpMetadata: { contentType } });
    return { storage: 'r2', key: r2Key };
  }
  const kvKey = `evidence:${tipId}`;
  await env.SPAM_KV.put(kvKey, bytes, { expirationTtl: 60 * 60 * 24 * 365 });
  return { storage: 'kv', key: kvKey };
}

export async function getEvidence(env, tip) {
  if (!tip.imageKey) return null;
  if (tip.imageStorage === 'r2' && env.EVIDENCE_R2) {
    return env.EVIDENCE_R2.get(tip.imageKey);
  }
  const kvKey = tip.imageStorage === 'kv' ? tip.imageKey : `evidence:${tip.id}`;
  const obj = await env.SPAM_KV.get(kvKey, 'arrayBuffer');
  if (!obj) return null;
  return new Response(obj, {
    headers: {
      'Content-Type': tip.imageContentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function pushTipIndex(env, entry) {
  const raw = await env.SPAM_KV.get('tips:index');
  const index = raw ? JSON.parse(raw) : [];
  index.unshift(entry);
  await env.SPAM_KV.put('tips:index', JSON.stringify(index.slice(0, 500)));
}

export async function recordReport(env, number, category, extras = null) {
  const key = 'num:' + number;
  const raw = await env.SPAM_KV.get(key);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };

  data.reports = (data.reports || 0) + 1;
  data.categories = data.categories || {};
  data.categories[category] = (data.categories[category] || 0) + 1;
  data.lastReport = new Date().toISOString();

  await env.SPAM_KV.put(key, JSON.stringify(data));

  if (extras) {
    const tipId = extras.id || newTipId();
    const tip = {
      ...extras,
      id: tipId,
      phone: number,
      mappedCategory: category,
      status: extras.status || 'pending',
      ts: extras.ts || new Date().toISOString(),
    };
    await env.SPAM_KV.put(`tip:${tipId}`, JSON.stringify(tip), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await pushTipIndex(env, {
      id: tipId,
      phone: number,
      category: tip.category,
      status: tip.status,
      ts: tip.ts,
      hasImage: Boolean(tip.imageKey),
    });
    return { data, tipId };
  }

  return { data, tipId: null };
}
