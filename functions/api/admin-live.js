// GET /admin/api/live-stats — aggregate live usage for the /admin/live dashboard.
// Auth mirrors admin-tips.js / admin-disputes.js exactly (X-Admin-Key vs
// TIP_ADMIN_PASSWORD). Aggregate counts only — never any vid / IP / phone.

import { isAdmin, json } from './tip-utils.js';
import { getLiveStats } from './_analytics.js';
import { guardAdmin, checkRateLimit, clientIp } from './_security.js';

const RATE_LIMIT = 60; // requests / IP / minute
const CACHE_TTL_MS = 15000; // 15s per-isolate cache (KV's minimum TTL is 60s, too coarse)

// Best-effort in-memory cache — caps the heavy KV list scans to ~once per 15s
// within a warm isolate, and never edge-caches the authenticated response.
let memCache = { at: 0, data: null };

export async function handleLiveStats({ request, env }) {
  const denied = await guardAdmin(request, env, isAdmin, json);
  if (denied) return denied;

  const ip = clientIp(request);
  const rl = await checkRateLimit(env, 'adminlive', ip, {
    max: RATE_LIMIT,
    windowSec: 60,
    bucket: 'minute',
  });
  if (!rl.allowed) return json({ error: 'rate_limited' }, 429);

  const now = Date.now();
  if (memCache.data && now - memCache.at < CACHE_TTL_MS) {
    return json(memCache.data, 200, { 'Cache-Control': 'no-store' });
  }
  const stats = await getLiveStats(env);
  memCache = { at: now, data: stats };
  return json(stats, 200, { 'Cache-Control': 'no-store' });
}
