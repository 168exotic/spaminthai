// GET /api/latest-version — tells the Android app the newest published APK.
//
// Resolution order:
//   1) KV key `latest_version` (manual override) — version must match APK versionName.
//   2) Canonical install metadata from app-download.js (not GitHub tag — tags like
//      v2.0.3 can differ from APK versionName 2.0.2 and cause endless update prompts).
//
// Response shape:
//   { "version": "2.0.2", "url": "...", "notes": "..." }

import { json } from './tip-utils.js';
import {
  ANDROID_INSTALL_CHANGELOG,
  ANDROID_INSTALL_URL,
  ANDROID_INSTALL_VERSION,
} from './app-download.js';

export const GITHUB_LATEST_URL =
  'https://api.github.com/repos/168exotic/spaminthai/releases/latest';
export const LATEST_VERSION_KV_KEY = 'latest_version';
export const RATE_LIMIT_PER_MIN = 60;
export const CACHE_SECONDS = 300;

export function stripV(tag) {
  return String(tag || '').replace(/^v/i, '').trim();
}

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

export function parseGithubRelease(release) {
  if (!release || typeof release !== 'object') return null;
  const version = stripV(release.tag_name);
  if (!version) return null;
  const url = pickApkAsset(release.assets);
  if (!url) return null;
  return { version, url, notes: String(release.body || '') };
}

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

/** What the Android app compares against BuildConfig.VERSION_NAME. */
export function canonicalLatestVersion(override = null) {
  if (override && override.url) {
    return {
      version: override.version || ANDROID_INSTALL_VERSION,
      url: override.url,
      notes: override.notes || ANDROID_INSTALL_CHANGELOG,
    };
  }
  return {
    version: ANDROID_INSTALL_VERSION,
    url: ANDROID_INSTALL_URL,
    notes: ANDROID_INSTALL_CHANGELOG,
  };
}

async function ipHashPrefix(ip) {
  const data = new TextEncoder().encode('spaminthai-lv-v1:' + String(ip || 'unknown'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export async function withinRateLimit(env, ip) {
  if (!env || !env.SPAM_KV) return true;
  const minute = new Date().toISOString().slice(0, 16);
  const key = `latest_version:rl:${await ipHashPrefix(ip)}:${minute}`;
  const current = parseInt((await env.SPAM_KV.get(key)) || '0', 10);
  if (current >= RATE_LIMIT_PER_MIN) return false;
  await env.SPAM_KV.put(key, String(current + 1), { expirationTtl: 60 });
  return true;
}

export async function resolveLatestVersion(env) {
  if (env && env.SPAM_KV) {
    const override = parseKvOverride(await env.SPAM_KV.get(LATEST_VERSION_KV_KEY));
    if (override && override.url) return canonicalLatestVersion(override);
  }
  return canonicalLatestVersion();
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

export async function onRequestGet(ctx) {
  return handleLatestVersion(ctx);
}
