// POST /api/linkcheck  { url }   (GET ?url= also accepted for quick checks)
//   -> { status, host, listed, sources, cached, checkedAt }
//
// Online companion to the app's on-device link checker (SpamInThai Android >= 3.1.1).
// The device heuristics catch gambling / lookalike / bait patterns; this endpoint adds
// the databases the device cannot hold: Google Safe Browsing (malware, phishing,
// unwanted software) plus our own host block / allow lists in KV.
//
// PRIVACY: only the URL is received (never the surrounding message). Nothing is logged
// with the URL in it; the KV cache is keyed by a SHA-256 of the normalised URL and
// stores only the verdict. Google receives the URL as part of the lookup, which the
// app discloses on the online-check button.
//
// Secrets / config (Worker settings → Variables and Secrets):
//   SAFE_BROWSING_KEY   Google Safe Browsing API key (Safe Browsing API must be enabled
//                       on the key's project). Missing key => google: 'unavailable'.
//   LINKCHECK_PROVIDER  optional: 'safebrowsing' (default) | 'webrisk' — the Google
//                       Safe Browsing API is for non-commercial use; switch to Web Risk
//                       (paid) if the app ever becomes a paid product. Web Risk is wired
//                       as a stub so the switch is a config change, not a rewrite.
//
// KV keys:
//   linkcheck:block:<host>   admin-curated danger hosts (value = reason text)
//   linkcheck:allow:<host>   admin-curated hosts never flagged (value = reason text)
//   linkcheck:cache:<sha256> cached verdict, LINKCHECK_CACHE_TTL seconds

import { json } from './tip-utils.js';
import { checkRateLimit, clientIp } from './_security.js';

const LINKCHECK_RL = { max: 30, windowSec: 60, bucket: 'minute' };
const CACHE_TTL_HIT = 60 * 60; // 1 h when a threat was found (lists change)
const CACHE_TTL_MISS = 6 * 60 * 60; // 6 h when nothing was found
const GOOGLE_TIMEOUT_MS = 4000;
const MAX_URL_LEN = 2048;

const SB_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const SB_THREATS = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'];

/** Thai wording per threat type, shown verbatim by the app. */
const THREAT_LABEL = {
  SOCIAL_ENGINEERING: 'เว็บหลอกลวง / ฟิชชิ่ง (ฐานข้อมูล Google)',
  MALWARE: 'เว็บแพร่มัลแวร์ (ฐานข้อมูล Google)',
  UNWANTED_SOFTWARE: 'เว็บแจกซอฟต์แวร์ไม่พึงประสงค์ (ฐานข้อมูล Google)',
  POTENTIALLY_HARMFUL_APPLICATION: 'เว็บแจกแอปอันตราย (ฐานข้อมูล Google)',
};

/**
 * Normalise what people paste: bare domains, trailing punctuation, upper-case hosts.
 * Returns { url, host } or null when it is not an http(s) URL.
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[\s​]+/g, '');
  if (!s || s.length > MAX_URL_LEN) return null;
  s = s.replace(/[.,;:!?)\]}'"]+$/, '');
  const scheme = s.match(/^([a-z][a-z0-9+.-]*):(\/\/)?/i);
  if (scheme && scheme[2]) {
    if (!/^https?$/i.test(scheme[1])) return null;
  } else if (scheme && /^(mailto|tel|sms|javascript|data|file|intent|ftp)$/i.test(scheme[1])) {
    return null;
  } else {
    s = `https://${s}`;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname || !u.hostname.includes('.')) return null;
  u.hash = '';
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  return { url: u.toString(), host };
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Google Safe Browsing Lookup API v4. Returns { checked, threats[] }. */
export async function googleSafeBrowsing(url, env, fetchImpl = fetch) {
  const key = env?.SAFE_BROWSING_KEY;
  if (!key) return { checked: false, reason: 'no_key', threats: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${SB_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        client: { clientId: 'spaminthai', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: SB_THREATS,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!res.ok) return { checked: false, reason: `http_${res.status}`, threats: [] };
    const data = await res.json().catch(() => ({}));
    const threats = [...new Set((data.matches || []).map((m) => m.threatType).filter(Boolean))];
    return { checked: true, threats };
  } catch (e) {
    return { checked: false, reason: e?.name === 'AbortError' ? 'timeout' : 'network', threats: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** Placeholder for the paid Google Web Risk API (same shape). */
async function googleWebRisk() {
  return { checked: false, reason: 'webrisk_not_configured', threats: [] };
}

/** Our own curated lists in KV (exact host or any parent domain). */
export async function ownLists(host, env) {
  const kv = env?.SPAM_KV;
  if (!kv) return { block: null, allow: null };
  const parts = host.split('.');
  const candidates = [];
  for (let i = 0; i < parts.length - 1; i++) candidates.push(parts.slice(i).join('.'));
  for (const h of candidates) {
    const [block, allow] = await Promise.all([
      kv.get(`linkcheck:block:${h}`),
      kv.get(`linkcheck:allow:${h}`),
    ]);
    if (allow) return { block: null, allow: { host: h, reason: allow } };
    if (block) return { block: { host: h, reason: block }, allow: null };
  }
  return { block: null, allow: null };
}

/**
 * Core check, pure enough to unit-test: resolves verdict from Google + own lists.
 * status: 'danger' | 'not_found' | 'allowed' | 'unavailable'
 */
export async function checkLink(rawUrl, env, { fetchImpl = fetch, now = Date.now } = {}) {
  const norm = normalizeUrl(rawUrl);
  if (!norm) return { error: 'invalid_url' };

  const kv = env?.SPAM_KV;
  const cacheKey = `linkcheck:cache:${await sha256Hex(norm.url)}`;
  if (kv) {
    const hit = await kv.get(cacheKey);
    if (hit) {
      try {
        return { ...JSON.parse(hit), cached: true };
      } catch {
        /* fall through */
      }
    }
  }

  const own = await ownLists(norm.host, env);
  const reasons = [];
  let status = 'not_found';
  let google = { checked: false, reason: 'skipped', threats: [] };

  if (own.allow) {
    status = 'allowed';
    reasons.push(`อยู่ในรายชื่อเว็บที่ SpamInThai ยืนยันแล้ว (${own.allow.host})`);
  } else {
    if (own.block) {
      status = 'danger';
      reasons.push(`อยู่ในรายชื่อเว็บอันตรายของ SpamInThai: ${own.block.reason}`);
    }
    const provider = (env?.LINKCHECK_PROVIDER || 'safebrowsing').toLowerCase();
    google = provider === 'webrisk' ? await googleWebRisk() : await googleSafeBrowsing(norm.url, env, fetchImpl);
    if (google.threats.length) {
      status = 'danger';
      for (const t of google.threats) reasons.push(THREAT_LABEL[t] || `ฐานข้อมูล Google: ${t}`);
    } else if (status !== 'danger' && !google.checked) {
      status = 'unavailable';
    }
  }

  const result = {
    status,
    host: norm.host,
    listed: status === 'danger',
    reasons,
    sources: {
      google: { checked: google.checked, threats: google.threats, ...(google.reason ? { reason: google.reason } : {}) },
      spaminthai: { block: Boolean(own.block), allow: Boolean(own.allow) },
    },
    checkedAt: new Date(now()).toISOString(),
    cached: false,
  };

  // Never cache "unavailable": the next request should retry the provider.
  if (kv && status !== 'unavailable') {
    const ttl = status === 'danger' ? CACHE_TTL_HIT : CACHE_TTL_MISS;
    await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });
  }
  return result;
}

export async function handleLinkCheck({ request, env }) {
  let raw = null;
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    raw = body?.url;
  } else {
    raw = new URL(request.url).searchParams.get('url');
  }
  if (typeof raw !== 'string' || !raw.trim()) return json({ error: 'missing_url' }, 400);

  const ip = clientIp(request);
  const rl = await checkRateLimit(env, 'linkcheck', ip, LINKCHECK_RL);
  if (!rl.allowed) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter || 60) });

  const result = await checkLink(raw, env);
  if (result.error) return json(result, 400);
  return json(result, 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPost(ctx) {
  return handleLinkCheck(ctx);
}

export async function onRequestGet(ctx) {
  return handleLinkCheck(ctx);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
