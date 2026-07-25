// GET /admin/api/live-stats — aggregate live usage for the /admin/live dashboard.
// Auth mirrors admin-tips.js / admin-disputes.js exactly (X-Admin-Key vs
// TIP_ADMIN_PASSWORD). Aggregate counts only — never any vid / IP / phone.

import { isAdmin, json } from './tip-utils.js';
import { getLiveStats } from './_analytics.js';

const RATE_LIMIT = 60; // requests / IP / minute
const CACHE_TTL_MS = 15000; // 15s per-isolate cache (KV's minimum TTL is 60s, too coarse)

// Best-effort in-memory cache — caps the heavy KV list scans to ~once per 15s
// within a warm isolate, and never edge-caches the authenticated response.
let memCache = { at: 0, data: null };

// Hash the IP for the rate-limit key — never store it raw.
async function ipHashPrefix(ip) {
  const data = new TextEncoder().encode('spaminthai-adminlive:' + String(ip || 'unknown'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function withinRateLimit(env, ip) {
  if (!env || !env.SPAM_KV) return true;
  const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const key = `rl:adminlive:${await ipHashPrefix(ip)}:${minute}`;
  const cur = parseInt((await env.SPAM_KV.get(key)) || '0', 10) || 0;
  if (cur >= RATE_LIMIT) return false;
  await env.SPAM_KV.put(key, String(cur + 1), { expirationTtl: 60 });
  return true;
}

export async function handleLiveStats({ request, env }) {
  if (!env.TIP_ADMIN_PASSWORD) return json({ error: 'admin_not_configured' }, 401);
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await withinRateLimit(env, ip))) return json({ error: 'rate_limited' }, 429);

  const now = Date.now();
  if (memCache.data && now - memCache.at < CACHE_TTL_MS) {
    return json(memCache.data, 200, { 'Cache-Control': 'no-store' });
  }
  const stats = await getLiveStats(env);
  memCache = { at: now, data: stats };
  return json(stats, 200, { 'Cache-Control': 'no-store' });
}
