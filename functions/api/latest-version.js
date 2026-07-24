// GET /api/latest-version — tells the Android app the newest published APK.
//
// Resolution order:
//   1) KV key `latest_version` (manual override) — lets us bump the version
//      the instant a public release is published, without a redeploy. Set it
//      via wrangler/CI (see scripts/prepare-weekly-release.mjs pattern).
//   2) GitHub: repos/168exotic/spaminthai/releases/latest (edge-cached 5 min).
//
// Response shape (version has no leading "v"):
//   { "version": "1.0.17",
//     "url": "https://github.com/168exotic/spaminthai/releases/download/v1.0.17/spaminthai-v1.0.17.apk",
//     "notes": "..." }
//
// Rate limit: 60 req / IP / minute (KV minute-bucket), mirroring the dispute
// limiter. The IP is SHA-256 hashed + truncated — never stored raw (no PII).

import { json } from './tip-utils.js';

export const GITHUB_LATEST_URL =
  'https://api.github.com/repos/168exotic/spaminthai/releases/latest';
export const LATEST_VERSION_KV_KEY = 'latest_version';
export const RATE_LIMIT_PER_MIN = 60;
export const CACHE_SECONDS = 300;

// Strip a single leading "v"/"V" from a tag like "v1.0.17".
export function stripV(tag) {
  return String(tag || '').replace(/^v/i, '').trim();
}

// Choose the .apk asset; fall back to the first asset that has a download URL.
export function pickApkAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const apk = list.find(
    (a) =>
      a &&
      typeof a.browser_download_url === 'string' &&
      /\.apk$/i.test(a.browser_download_url),
  );
  const chosen = apk || list.find((a) => a && a.browser_download_url);
  return chosen ? chosen.browser_download_url : null;
}

// Pure: GitHub "latest release" JSON -> our contract (or null if unusable).
export function parseGithubRelease(release) {
  if (!release || typeof release !== 'object') return null;
  const version = stripV(release.tag_name);
  if (!version) return null;
  const url = pickApkAsset(release.assets);
  if (!url) return null;
  return { version, url, notes: String(release.body || '') };
}

// Pure: normalize a KV override value into the contract (or null).
// Accepts either a JSON object { version, url, notes } or a bare version string.
export function parseKvOverride(raw) {
  if (!raw) return null;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    const v = stripV(raw);
    return v ? { version: v, url: '', notes: '' } : null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const version = stripV(obj.version);
  if (!version) return null;
  return {
    version,
    url: String(obj.url || ''),
    notes: String(obj.notes || ''),
  };
}

// Minute-bucket rate limit; 60/IP/min. Hash the IP (never store it raw).
async function ipHashPrefix(ip) {
  const data = new TextEncoder().encode('spaminthai-lv-v1:' + String(ip || 'unknown'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export async function withinRateLimit(env, ip) {
  if (!env || !env.SPAM_KV) return true; // no KV (preview/test) -> allow
  const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const key = `latest_version:rl:${await ipHashPrefix(ip)}:${minute}`;
  const current = parseInt((await env.SPAM_KV.get(key)) || '0', 10);
  if (current >= RATE_LIMIT_PER_MIN) return false;
  await env.SPAM_KV.put(key, String(current + 1), { expirationTtl: 60 });
  return true;
}

// Core resolver — testable with a mock env + an injected fetch.
export async function resolveLatestVersion(env, fetchImpl = fetch) {
  // 1) Manual override (only honored when it carries a usable download URL).
  if (env && env.SPAM_KV) {
    const override = parseKvOverride(await env.SPAM_KV.get(LATEST_VERSION_KV_KEY));
    if (override && override.url) return override;
  }
  // 2) GitHub latest release (edge-cached).
  const res = await fetchImpl(GITHUB_LATEST_URL, {
    headers: {
      'User-Agent': 'spaminthai-worker',
      Accept: 'application/vnd.github+json',
    },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  });
  if (!res || !res.ok) return null;
  const release = await res.json();
  return parseGithubRelease(release);
}

export async function handleLatestVersion({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await withinRateLimit(env, ip))) {
    return json({ error: 'rate_limited' }, 429);
  }
  let payload = null;
  try {
    payload = await resolveLatestVersion(env);
  } catch {
    payload = null;
  }
  if (!payload) return json({ error: 'unavailable' }, 503);
  return json(payload, 200, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
}

// Pages Functions entry — used if/when the site migrates off _worker.js.
export async function onRequestGet(ctx) {
  return handleLatestVersion(ctx);
}
