// GET /admin/api/live-stats — aggregate live usage for the /admin/live dashboard.
// Auth mirrors admin-tips.js / admin-disputes.js exactly (X-Admin-Key vs
// TIP_ADMIN_PASSWORD). Aggregate counts only — never any vid / IP / phone.

import { isAdmin, json } from './tip-utils.js';
import { getLiveStats } from './_analytics.js';

const RATE_LIMIT = 60; // requests / IP / minute
const CACHE_KEY = 'live_stats:cache';
const CACHE_TTL = 15; // seconds

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

  // 15s result cache in KV: caps the heavy KV list scans to once per window,
  // without ever edge-caching an authenticated response.
  const cached = await env.SPAM_KV.get(CACHE_KEY);
  if (cached) {
    try {
      return json(JSON.parse(cached), 200, { 'Cache-Control': 'no-store' });
    } catch {
      // fall through and recompute
    }
  }
  const stats = await getLiveStats(env);
  await env.SPAM_KV.put(CACHE_KEY, JSON.stringify(stats), { expirationTtl: CACHE_TTL });
  return json(stats, 200, { 'Cache-Control': 'no-store' });
}
