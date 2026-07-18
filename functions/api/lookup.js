// GET /api/lookup?number=0812345678
// KV binding: SPAM_KV  (key: num:<เบอร์> -> JSON {reports, categories, lastReport})
//
// Returns the raw community report data plus a server-computed risk assessment
// (score 0-100, verdict, Thai label + advice) and carrier/network info so the
// website widgets and the Android app all share one consistent source of truth.

import { identifyCarrier } from './carrier.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const number = (url.searchParams.get('number') || '').replace(/\D/g, '');

  if (number.length < 9 || number.length > 10) {
    return json({ error: 'invalid_number' }, 400);
  }

  const raw = await env.SPAM_KV.get('num:' + number);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };

  return json({ number, ...data, ...assess(data), ...identifyCarrier(number) }, 200, 60); // cache at edge 60 sec
}

// How much each report category contributes to the risk score. Scam and
// call-center reports weigh the most; "safe" votes pull the score back down.
const WEIGHTS = { scam: 26, callcenter: 22, loan: 15, ads: 9, safe: -18 };
const DEFAULT_WEIGHT = 12;

// Human-facing category names (Thai) for picking the dominant report reason.
const CATEGORY_LABELS = {
  scam: 'มิจฉาชีพ/หลอกโอนเงิน',
  callcenter: 'แก๊งคอลเซ็นเตอร์',
  ads: 'โฆษณา/ขายของ',
  loan: 'เงินกู้',
  safe: 'เบอร์ปกติ'
};

// How recently a number was reported changes how alarming it is — scammers
// rotate numbers quickly, so a report from last week matters more than one
// from six months ago.
const FRESHNESS_LABELS = {
  hot: 'รายงานล่าสุดภายใน 7 วัน',
  recent: 'รายงานภายใน 30 วัน',
  normal: null,
  stale: 'รายงานเก่า — อาจเปลี่ยนเจ้าของแล้ว'
};

export function recencyModifier(lastReport, now = Date.now()) {
  if (lastReport == null) return { boost: 0, freshness: null, freshnessLabel: null };
  const ts = typeof lastReport === 'string' ? Date.parse(lastReport) : Number(lastReport);
  if (!Number.isFinite(ts)) return { boost: 0, freshness: null, freshnessLabel: null };

  const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return { boost: 0, freshness: null, freshnessLabel: null };
  if (ageDays <= 7) {
    return { boost: 12, freshness: 'hot', freshnessLabel: FRESHNESS_LABELS.hot };
  }
  if (ageDays <= 30) {
    return { boost: 6, freshness: 'recent', freshnessLabel: FRESHNESS_LABELS.recent };
  }
  if (ageDays >= 120) {
    return { boost: -6, freshness: 'stale', freshnessLabel: FRESHNESS_LABELS.stale };
  }
  return { boost: 0, freshness: 'normal', freshnessLabel: null };
}

// Pure risk assessment. Exported for unit testing.
// Input:  { reports, categories, lastReport }
// Output: { score, verdict, label, advice, topCategory, freshness, freshnessLabel }
export function assess(data, now = Date.now()) {
  const reports = Number(data && data.reports) || 0;
  const categories = (data && data.categories) || {};

  const safeVotes = Number(categories.safe) || 0;
  const badVotes = Math.max(0, reports - safeVotes);

  let raw = 0;
  for (const [cat, count] of Object.entries(categories)) {
    const n = Number(count) || 0;
    raw += (cat in WEIGHTS ? WEIGHTS[cat] : DEFAULT_WEIGHT) * n;
  }

  const { boost, freshness, freshnessLabel } = recencyModifier(data && data.lastReport, now);
  const score = Math.max(0, Math.min(100, Math.round(raw + boost)));

  // Dominant "bad" category (ignore safe votes).
  let topCategory = null;
  let topCount = 0;
  for (const [cat, count] of Object.entries(categories)) {
    const n = Number(count) || 0;
    if (cat !== 'safe' && n > topCount) {
      topCount = n;
      topCategory = cat;
    }
  }

  let verdict, label, advice;
  if (reports === 0) {
    verdict = 'unknown';
    label = 'ยังไม่พบรายงาน';
    advice = 'ยังไม่มีข้อมูลเบอร์นี้ — ไม่ได้แปลว่าปลอดภัย 100% มิจฉาชีพเปลี่ยนเบอร์บ่อย';
  } else if (score >= 55 || badVotes >= 5) {
    verdict = 'danger';
    label = 'เบอร์อันตราย';
    advice = 'มีรายงานจำนวนมาก — ไม่ควรรับสาย และห้ามโอนเงินเด็ดขาด';
  } else if (score >= 15 || badVotes >= 1) {
    verdict = 'caution';
    label = 'เบอร์น่าสงสัย';
    advice = 'มีคนรายงานว่าผิดปกติ — รับสายด้วยความระมัดระวัง';
  } else {
    verdict = 'safe';
    label = 'น่าจะเป็นเบอร์ปกติ';
    advice = 'มีผู้ใช้ยืนยันว่าเป็นเบอร์ปกติ แต่ควรใช้วิจารณญาณเสมอ';
  }

  if (topCategory && (verdict === 'danger' || verdict === 'caution')) {
    const catLabel = CATEGORY_LABELS[topCategory] || topCategory;
    advice = `ส่วนใหญ่ถูกรายงานว่าเป็น "${catLabel}" — ${advice}`;
  }

  if (freshnessLabel && (verdict === 'danger' || verdict === 'caution')) {
    advice = `${freshnessLabel} — ${advice}`;
  }

  return { score, verdict, label, advice, topCategory, freshness, freshnessLabel };
}

function json(obj, status = 200, cacheSec = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      ...(cacheSec ? { 'Cache-Control': `public, max-age=${cacheSec}` } : {})
    }
  });
}
