// Shared helpers for the SMS-blocking backend (v2.0.0, Path D).
//
// PRIVACY: the SMS body NEVER reaches the server. The app sends only a SHA-256
// hash of the normalized body, plus optional keyword tokens for fuzzy matching.
// Nothing here stores or logs message content.
//
// KV model (SPAM_KV):
//   sms:hash:<hash>     approved community spam hash  -> verdict "spam"
//   sms:safe:<hash>     allowlisted (e.g. bank OTP)   -> verdict "safe"
//   sms:report:<ULID>   pending community report (hash + tokens + reason)
//   sms:reports:index   most-recent-first list for the admin queue
//   sms:keywords:top    curated JSON array of Thai spam keywords (5-min cache)

const HASH_RE = /^[a-f0-9]{64}$/i;

export const MAX_TOKENS = 20;
export const MAX_TOKEN_LEN = 40;
export const REASON_MAX = 300;

// On-device bootstrap mirrors this; kept here so /api/sms-keywords always has data.
export const DEFAULT_SPAM_KEYWORDS = [
  'เงินกู้', 'กู้ด่วน', 'อนุมัติไว', 'ดอกเบี้ยต่ำ', 'สินเชื่อ',
  'ถูกรางวัล', 'คุณได้รับสิทธิ์', 'กดลิงก์', 'ยืนยันตัวตน', 'บัญชีถูกระงับ',
  'พัสดุตกค้าง', 'ภาษี', 'โอนเงิน', 'เว็บพนัน', 'สมัครฟรี',
  'เครดิตฟรี', 'รับทรัพย์', 'ปลดหนี้', 'ลงทุน', 'กำไร',
];

export function isValidHash(h) {
  return typeof h === 'string' && HASH_RE.test(h);
}

/** Clean the optional token list — never persisted from the check path. */
export function cleanTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim().toLowerCase().slice(0, MAX_TOKEN_LEN))
    .filter(Boolean)
    .slice(0, MAX_TOKENS);
}

export const smsHashKey = (h) => `sms:hash:${h}`;
export const smsSafeKey = (h) => `sms:safe:${h}`;
export const smsReportKey = (id) => `sms:report:${id}`;
export const SMS_REPORTS_INDEX = 'sms:reports:index';
export const SMS_KEYWORDS_KEY = 'sms:keywords:top';

/**
 * Pure verdict resolver, given the KV lookups already done by the handler.
 * @returns {{verdict:'spam'|'safe'|'unknown', confidence:number, source:string}}
 */
export function resolveVerdict({ safeHit, spamHit, keywordHit }) {
  if (safeHit) return { verdict: 'safe', confidence: 1, source: 'allowlist' };
  if (spamHit) return { verdict: 'spam', confidence: 0.95, source: 'community' };
  if (keywordHit) return { verdict: 'spam', confidence: 0.6, source: 'keyword' };
  return { verdict: 'unknown', confidence: 0, source: 'none' };
}

export async function loadKeywords(env) {
  try {
    const raw = env?.SPAM_KV ? await env.SPAM_KV.get(SMS_KEYWORDS_KEY) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr.map(String).slice(0, 200);
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SPAM_KEYWORDS;
}
