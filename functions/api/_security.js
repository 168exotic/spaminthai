// Central security layer for SpamInThai — headers, abuse detection, rate limits.
// Used by _worker.js (global middleware) and individual API handlers.

export const SITE_ORIGIN = 'https://spaminthai.com';

export const ALLOWED_ORIGINS = new Set([
  SITE_ORIGIN,
  'https://www.spaminthai.com',
  'https://xn--42c7b1ab1c2gya5e.com',
]);

/** Preset rate limits: max requests per window per hashed IP. */
export const RATE_LIMITS = {
  lookup: { max: 120, windowSec: 60, bucket: 'minute' },
  report: { max: 30, windowSec: 3600, bucket: 'hour' },
  event: { max: 60, windowSec: 60, bucket: 'minute' },
};

const ADMIN_FAIL_MAX = 5;
const ADMIN_LOCK_SEC = 15 * 60;

const PROBE_PATHS =
  /^\/(\.env|\.git|wp-admin|wp-login|phpmyadmin|xmlrpc|admin\.php|config\.php|\.well-known\/security\.txt)/i;

// Repo-internal files. `wrangler pages deploy .` publishes the whole directory and
// Pages ignores .assetsignore (that file only works for Workers Static Assets), so
// these must be refused at the edge or they are world-readable (package.json, docs/,
// scripts/, terraform/, handoff notes, wrangler config ...). Never add a public page here.
const INTERNAL_PATHS =
  /^\/(package(-lock)?\.json|wrangler\.(jsonc?|toml)|tsconfig\.json|\.assetsignore|\.gitignore|\.gitattributes|\.github|\.cursor|\.claude|\.vscode|agents\.md|claude\.md|deploy-guide\.md|handoff[^/]*\.md|releasing\.md|changelog\.md|readme\.md|terraform|scripts|docs|data|vps|functions|node_modules|_worker\.js|_headers|_redirects|\.dev\.vars)(\/|$)/i;

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** SHA-256 hash of IP + salt; truncated hex — never store raw IPs in KV. */
export async function ipHash(ip, salt = 'spaminthai-sec-v1') {
  const data = new TextEncoder().encode(`${salt}:${String(ip || 'unknown')}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function bucketLabel(bucket) {
  const d = new Date();
  if (bucket === 'hour') return d.toISOString().slice(0, 13);
  return d.toISOString().slice(0, 16); // minute: YYYY-MM-DDTHH:MM
}

/**
 * KV-backed sliding-window rate limiter.
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
export async function checkRateLimit(env, namespace, ip, { max, windowSec, bucket }) {
  if (!env?.SPAM_KV) return { allowed: true };
  const h = await ipHash(ip, `rl:${namespace}`);
  const key = `sec:rl:${namespace}:${h}:${bucketLabel(bucket)}`;
  const current = parseInt((await env.SPAM_KV.get(key)) || '0', 10);
  if (current >= max) return { allowed: false, retryAfter: windowSec };
  await env.SPAM_KV.put(key, String(current + 1), { expirationTtl: windowSec });
  return { allowed: true };
}

export function securityHeaders() {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-XSS-Protection': '1; mode=block',
    // Keep identical to the /* Content-Security-Policy in _headers (scripts/test-csp.mjs enforces it).
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://adservice.google.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://www.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://i.ytimg.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.gstatic.com https://www.google.com https://*.adtrafficquality.google",
      "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google https://cloudflareinsights.com https://www.google.com",
      "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://*.adtrafficquality.google https://www.facebook.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  };
}

export function corsOrigin(request) {
  const origin = request?.headers?.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  return SITE_ORIGIN;
}

/** Fresh per-request CSP nonce: 128 random bits, base64. */
export function cspNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Static CSP with 'nonce-<n>' added to script-src. */
export function cspWithNonce(nonce) {
  return securityHeaders()['Content-Security-Policy'].replace(
    /(^|; )script-src 'self'/,
    `$1script-src 'self' 'nonce-${nonce}'`,
  );
}

export function isHtmlResponse(response) {
  return /^\s*text\/html\b/i.test(response?.headers?.get('Content-Type') || '');
}

/**
 * Apply security headers to any Response (static assets, API, HTML).
 * HTML gets exactly one CSP header carrying a fresh nonce (replacing any static CSP from
 * _headers / the handler) so Cloudflare-injected inline scripts (JS detections,
 * window.__CF$cv$params) can run: Cloudflare copies the nonce from this response header.
 */
export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(securityHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  if (isHtmlResponse(response)) {
    headers.set('Content-Security-Policy', cspWithNonce(cspNonce()));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function jsonSec(data, status = 200, request = null, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': request ? corsOrigin(request) : SITE_ORIGIN,
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

/**
 * Detect common attack probes before routing.
 * @returns {string|null} threat code or null if clean
 */
export function detectThreat(request, url) {
  const raw = String(request?.url || '') + url.pathname + url.search;

  if (/\.\.|%2e%2e|%252e/i.test(raw)) return 'path_traversal';
  if (/%00|\\0/i.test(raw)) return 'null_byte';
  if (url.search.length > 2048) return 'query_too_long';
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* keep raw */ }
  if (/(?:union\s+select|<script|javascript:|onerror=|onload=|%3Cscript)/i.test(raw + decoded)) {
    return 'xss_probe';
  }
  if (PROBE_PATHS.test(url.pathname)) return 'probe';
  let pathDecoded = url.pathname;
  try { pathDecoded = decodeURIComponent(url.pathname); } catch { /* keep raw */ }
  if (INTERNAL_PATHS.test(url.pathname) || INTERNAL_PATHS.test(pathDecoded)) return 'internal_path';

  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST' && method !== 'OPTIONS') {
    return 'bad_method';
  }

  return null;
}

/** Reject oversized POST bodies before parsing (multipart evidence max ~3 MB). */
export function bodyTooLarge(request, maxBytes = 3 * 1024 * 1024) {
  const cl = request.headers.get('Content-Length');
  if (!cl) return false;
  const n = parseInt(cl, 10);
  return Number.isFinite(n) && n > maxBytes;
}

// --- Admin brute-force lockout (5 failures / 15 min) -----------------------

export async function isAdminLocked(env, ip) {
  if (!env?.SPAM_KV) return false;
  const h = await ipHash(ip, 'admin-lock');
  return (await env.SPAM_KV.get(`sec:admin:lock:${h}`)) === '1';
}

export async function recordAdminFailure(env, ip) {
  if (!env?.SPAM_KV) return;
  const h = await ipHash(ip, 'admin-lock');
  const failKey = `sec:admin:fail:${h}`;
  const count = parseInt((await env.SPAM_KV.get(failKey)) || '0', 10) + 1;
  await env.SPAM_KV.put(failKey, String(count), { expirationTtl: ADMIN_LOCK_SEC });
  if (count >= ADMIN_FAIL_MAX) {
    await env.SPAM_KV.put(`sec:admin:lock:${h}`, '1', { expirationTtl: ADMIN_LOCK_SEC });
  }
}

export async function clearAdminFailures(env, ip) {
  if (!env?.SPAM_KV) return;
  const h = await ipHash(ip, 'admin-lock');
  await env.SPAM_KV.delete(`sec:admin:fail:${h}`);
  await env.SPAM_KV.delete(`sec:admin:lock:${h}`);
}

/**
 * Admin auth with lockout. Returns null on success, or a Response to return.
 * @param {Function} isAdminFn — tip-utils.isAdmin
 */
export async function guardAdmin(request, env, isAdminFn, jsonFn) {
  const ip = clientIp(request);
  if (await isAdminLocked(env, ip)) {
    return jsonFn({ error: 'locked_out' }, 429, { 'Retry-After': String(ADMIN_LOCK_SEC) });
  }
  if (!env.TIP_ADMIN_PASSWORD) {
    return jsonFn({ error: 'admin_not_configured' }, 503);
  }
  if (!isAdminFn(request, env)) {
    await recordAdminFailure(env, ip);
    return jsonFn({ error: 'unauthorized' }, 401);
  }
  await clearAdminFailures(env, ip);
  return null;
}

// --- Turnstile (shared with dispute + report web forms) ---------------------

export async function turnstileOk(env, token, ip) {
  if (!env?.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}
