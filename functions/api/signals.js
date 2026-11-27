// POST /api/v1/signals  — Passive Spam Signal Collection (v3.1.6)
//
// The SpamInThai app, when the user has opted in (default OFF), posts batches of
// HASHED call signals. Privacy guarantees enforced here:
//   * only h = SHA-256(E.164 + SIGNAL_SALT) is accepted/stored — never a raw number,
//   * install_id is an anonymous id used ONLY for rate-limiting + distinct counting,
//   * no contact names / device identifiers are accepted in any field.
//
// Auth: X-App-Key == env.APP_REPORT_KEY (same shared app key as /api/report).
// Rate limit: 500 signals / install / UTC-day (configurable in signal_config).
//
// Aggregation (hourly cron, see _worker.js scheduled()) rebuilds number_risk from
// call_signals using the thresholds in signal_config (scoring_v1) — NOT hardcoded.

import { json } from './tip-utils.js';

export const SIGNAL_EVENTS = ['rejected', 'short_call', 'blocked', 'reported'];

const HEX64 = /^[a-f0-9]{64}$/;
const PREFIX4 = /^\d{4}$/;
const INSTALL_ID = /^[A-Za-z0-9._-]{8,64}$/;

const DEFAULT_CONFIG = {
  neg_events: ['rejected', 'short_call', 'blocked'],
  suspicious: { installs_24h: 3 },
  likely_spam: { installs_7d: 10 },
  spam: { require_reported: true, installs_7d: 5 },
};
const DEFAULT_DAILY_CAP = 500;
const DEFAULT_RETENTION_DAYS = 180;
const MAX_BATCH = 50;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function utcDay(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** Read scoring config from D1 (falls back to defaults if the row/binding is absent). */
async function loadConfig(env) {
  const out = {
    scoring: DEFAULT_CONFIG,
    dailyCap: DEFAULT_DAILY_CAP,
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
  if (!env?.SIGNAL_DB) return out;
  try {
    const rows = await env.SIGNAL_DB.prepare(
      "SELECT k, v FROM signal_config WHERE k IN ('scoring_v1','daily_cap_per_install','retention_days')",
    ).all();
    for (const r of rows?.results || []) {
      if (r.k === 'scoring_v1') out.scoring = { ...DEFAULT_CONFIG, ...JSON.parse(r.v) };
      else if (r.k === 'daily_cap_per_install') out.dailyCap = parseInt(r.v, 10) || DEFAULT_DAILY_CAP;
      else if (r.k === 'retention_days') out.retentionDays = parseInt(r.v, 10) || DEFAULT_RETENTION_DAYS;
    }
  } catch {
    /* keep defaults */
  }
  return out;
}

// ---- hashing ---------------------------------------------------------------

/** SHA-256 hex of the given string. */
export async function sha256hex(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonical signal hash of a Thai number. Input is the E.164 form (+66XXXXXXXXX);
 * the Android client hashes the identical string so the digests line up.
 * Returns null when no salt is configured (feature disabled) or the number is empty.
 */
export async function signalHash(env, e164) {
  if (!env?.SIGNAL_SALT || !e164) return null;
  return sha256hex(`${e164}${env.SIGNAL_SALT}`);
}

/** Thai local (0XXXXXXXXX) -> E.164 (+66XXXXXXXXX). Returns null if not a Thai local number. */
export function thaiLocalToE164(local) {
  if (!local) return null;
  const d = String(local).replace(/\D/g, '');
  if (/^0\d{8,9}$/.test(d)) return `+66${d.slice(1)}`;
  if (/^66\d{8,9}$/.test(d)) return `+${d}`;
  return null;
}

// ---- ingest ----------------------------------------------------------------

export async function handleSignalsPost({ request, env }) {
  if (!env?.SIGNAL_DB) return json({ error: 'signals_unavailable' }, 503);

  const key = request.headers.get('X-App-Key');
  if (!env.APP_REPORT_KEY || !key || key !== env.APP_REPORT_KEY) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const installId = String(request.headers.get('X-Install-Id') || body.install_id || '').trim();
  if (!INSTALL_ID.test(installId)) return json({ error: 'invalid_install_id' }, 400);

  const list = Array.isArray(body.signals) ? body.signals : null;
  if (!list || list.length === 0) return json({ error: 'empty_batch' }, 400);
  if (list.length > MAX_BATCH) return json({ error: 'batch_too_large', max: MAX_BATCH }, 400);

  const now = nowSec();
  const lowerBound = now - 3 * 86400; // reject events older than 3 days or in the future
  const upperBound = now + 86400;

  const valid = [];
  for (const s of list) {
    if (!s || typeof s !== 'object') continue;
    const h = typeof s.h === 'string' ? s.h.toLowerCase() : '';
    if (!HEX64.test(h)) continue;
    if (!SIGNAL_EVENTS.includes(s.e)) continue;
    const t = Number(s.t);
    if (!Number.isInteger(t) || t < lowerBound || t > upperBound) continue;
    const p = typeof s.p === 'string' && PREFIX4.test(s.p) ? s.p : null;
    valid.push({ h, e: s.e, t, p });
  }
  if (valid.length === 0) return json({ error: 'no_valid_signals' }, 400);

  const { dailyCap } = await loadConfig(env);
  const day = utcDay();

  // Per-install daily cap.
  let used = 0;
  try {
    const row = await env.SIGNAL_DB.prepare(
      'SELECT count FROM install_daily WHERE install_id = ? AND day = ?',
    ).bind(installId, day).first();
    used = row ? Number(row.count) : 0;
  } catch {
    used = 0;
  }
  const remaining = dailyCap - used;
  if (remaining <= 0) {
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': '3600' });
  }

  const accepted = valid.slice(0, remaining);
  const stmt = env.SIGNAL_DB.prepare(
    'INSERT INTO call_signals (h, event, ts, prefix, install_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const batch = accepted.map((s) => stmt.bind(s.h, s.e, s.t, s.p, installId, now));
  batch.push(
    env.SIGNAL_DB.prepare(
      `INSERT INTO install_daily (install_id, day, count) VALUES (?, ?, ?)
       ON CONFLICT(install_id, day) DO UPDATE SET count = count + excluded.count`,
    ).bind(installId, day, accepted.length),
  );

  try {
    await env.SIGNAL_DB.batch(batch);
  } catch (e) {
    return json({ error: 'write_failed' }, 500);
  }

  return json({
    ok: true,
    accepted: accepted.length,
    dropped: list.length - accepted.length,
  });
}

// ---- aggregation (hourly) --------------------------------------------------

/**
 * Rebuild number_risk from the last 7 days of call_signals and purge old data.
 * Safe to run on demand (admin trigger) or on the cron schedule.
 */
export async function runAggregation(env) {
  if (!env?.SIGNAL_DB) return { ok: false, error: 'no_db' };
  const cfg = (await loadConfig(env)).scoring;
  const now = nowSec();
  const d1 = now - 86400;
  const d7 = now - 7 * 86400;

  const neg = (cfg.neg_events || DEFAULT_CONFIG.neg_events)
    .filter((e) => SIGNAL_EVENTS.includes(e))
    .map((e) => `'${e}'`)
    .join(',') || "'rejected','short_call','blocked'";

  const suspicious24h = Number(cfg.suspicious?.installs_24h ?? 3);
  const likely7d = Number(cfg.likely_spam?.installs_7d ?? 10);
  const spam7d = Number(cfg.spam?.installs_7d ?? 5);
  const spamNeedsReport = cfg.spam?.require_reported !== false;

  const scoreCase =
    `CASE ` +
    `WHEN ${spamNeedsReport ? 'has_reported = 1 AND ' : ''}installs_7d >= ${spam7d} THEN 'spam' ` +
    `WHEN installs_7d >= ${likely7d} THEN 'likely_spam' ` +
    `WHEN installs_24h >= ${suspicious24h} THEN 'suspicious' ` +
    `ELSE 'none' END`;

  const upsert = `
    INSERT INTO number_risk (h, score, reports_24h, installs_24h, installs_7d, last_seen, updated_at)
    SELECT h, ${scoreCase}, reports_24h, installs_24h, installs_7d, last_seen, ${now}
    FROM (
      SELECT h,
        COUNT(DISTINCT CASE WHEN event='reported' AND created_at>=${d1} THEN install_id END) AS reports_24h,
        COUNT(DISTINCT CASE WHEN event IN (${neg}) AND created_at>=${d1} THEN install_id END) AS installs_24h,
        COUNT(DISTINCT install_id) AS installs_7d,
        MAX(ts) AS last_seen,
        MAX(CASE WHEN event='reported' THEN 1 ELSE 0 END) AS has_reported
      FROM call_signals
      WHERE created_at >= ${d7}
      GROUP BY h
    ) AS agg
    WHERE true
    ON CONFLICT(h) DO UPDATE SET
      score=excluded.score, reports_24h=excluded.reports_24h, installs_24h=excluded.installs_24h,
      installs_7d=excluded.installs_7d, last_seen=excluded.last_seen, updated_at=excluded.updated_at`;

  const purgeStale = `DELETE FROM number_risk WHERE h NOT IN (SELECT DISTINCT h FROM call_signals WHERE created_at >= ${d7})`;
  const retentionDays = (await loadConfig(env)).retentionDays;
  const purgeOld = `DELETE FROM call_signals WHERE created_at < ${now - retentionDays * 86400}`;
  const purgeCounters = `DELETE FROM install_daily WHERE day < '${utcDay(2)}'`;

  try {
    await env.SIGNAL_DB.batch([
      env.SIGNAL_DB.prepare(upsert),
      env.SIGNAL_DB.prepare(purgeStale),
      env.SIGNAL_DB.prepare(purgeOld),
      env.SIGNAL_DB.prepare(purgeCounters),
    ]);
    return { ok: true, at: now };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/** Pure scoring from aggregate counts, using the (config-driven) thresholds. */
export function computeScore(scoring, { installs7d, installs24h, hasReported }) {
  const spam7d = Number(scoring.spam?.installs_7d ?? 5);
  const spamNeedsReport = scoring.spam?.require_reported !== false;
  const likely7d = Number(scoring.likely_spam?.installs_7d ?? 10);
  const susp24h = Number(scoring.suspicious?.installs_24h ?? 3);
  if ((!spamNeedsReport || hasReported) && installs7d >= spam7d) return 'spam';
  if (installs7d >= likely7d) return 'likely_spam';
  if (installs24h >= susp24h) return 'suspicious';
  return 'none';
}

/**
 * Recompute number_risk for a single hash over the 7-day window and upsert it.
 * Keeps lookups correct in near-real-time even if the hourly job is lagging
 * (Cloudflare Pages has no native cron). Returns the computed risk or null.
 */
async function refreshNumberRiskForHash(env, h, now) {
  const { scoring } = await loadConfig(env);
  const d1 = now - 86400;
  const d7 = now - 7 * 86400;
  const neg = (scoring.neg_events || DEFAULT_CONFIG.neg_events).filter((e) => SIGNAL_EVENTS.includes(e));
  const placeholders = neg.map(() => '?').join(',') || "''";
  const row = await env.SIGNAL_DB.prepare(
    `SELECT
       COUNT(DISTINCT CASE WHEN event='reported' AND created_at>=? THEN install_id END) AS reports_24h,
       COUNT(DISTINCT CASE WHEN event IN (${placeholders}) AND created_at>=? THEN install_id END) AS installs_24h,
       COUNT(DISTINCT install_id) AS installs_7d,
       MAX(ts) AS last_seen,
       MAX(CASE WHEN event='reported' THEN 1 ELSE 0 END) AS has_reported
     FROM call_signals WHERE h=? AND created_at>=?`,
  ).bind(d1, ...neg, d1, h, d7).first();

  const installs7d = Number(row?.installs_7d) || 0;
  if (installs7d === 0) {
    await env.SIGNAL_DB.prepare('DELETE FROM number_risk WHERE h=?').bind(h).run();
    return null;
  }
  const installs24h = Number(row.installs_24h) || 0;
  const reports24h = Number(row.reports_24h) || 0;
  const lastSeen = row.last_seen ? Number(row.last_seen) : null;
  const score = computeScore(scoring, { installs7d, installs24h, hasReported: Number(row.has_reported) === 1 });
  await env.SIGNAL_DB.prepare(
    `INSERT INTO number_risk (h, score, reports_24h, installs_24h, installs_7d, last_seen, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(h) DO UPDATE SET score=excluded.score, reports_24h=excluded.reports_24h,
       installs_24h=excluded.installs_24h, installs_7d=excluded.installs_7d,
       last_seen=excluded.last_seen, updated_at=excluded.updated_at`,
  ).bind(h, score, reports24h, installs24h, installs7d, lastSeen, now).run();
  return { score, installs_7d: installs7d, reports_24h: reports24h, last_seen: lastSeen };
}

/**
 * Risk lookup used by /api/lookup to enrich a phone result with crowdsourced
 * signal data. Hashes the E.164 number with SIGNAL_SALT and reads number_risk,
 * lazily recomputing when the cached row is missing or older than 15 minutes.
 * Never returns raw signals. Returns null when disabled or not found.
 */
export async function lookupSignalRisk(env, e164) {
  if (!env?.SIGNAL_DB || !env?.SIGNAL_SALT || !e164) return null;
  try {
    const h = await signalHash(env, e164);
    if (!h) return null;
    const now = nowSec();
    let row = await env.SIGNAL_DB.prepare(
      'SELECT score, reports_24h, installs_7d, last_seen, updated_at FROM number_risk WHERE h = ?',
    ).bind(h).first();
    if (!row || now - (Number(row.updated_at) || 0) > 900) {
      const fresh = await refreshNumberRiskForHash(env, h, now);
      if (!fresh) return null;
      return fresh;
    }
    if (!row.installs_7d) return null;
    return {
      score: row.score || 'none',
      installs_7d: Number(row.installs_7d) || 0,
      reports_24h: Number(row.reports_24h) || 0,
      last_seen: row.last_seen ? Number(row.last_seen) : null,
    };
  } catch {
    return null;
  }
}

// ---- admin / test trigger --------------------------------------------------

/**
 * POST /api/v1/aggregate — manual/cron aggregation trigger.
 * Authorized by SIGNAL_ADMIN_KEY (dedicated cron/admin key) or, as a fallback,
 * the shared APP_REPORT_KEY. Keeping a separate admin key lets the scheduled
 * GitHub Action authenticate without shipping the app key.
 */
export async function handleAggregateTrigger({ request, env }) {
  const key = request.headers.get('X-App-Key');
  const allowed =
    (env.SIGNAL_ADMIN_KEY && key === env.SIGNAL_ADMIN_KEY) ||
    (env.APP_REPORT_KEY && key === env.APP_REPORT_KEY);
  if (!allowed) {
    return json({ error: 'unauthorized' }, 401);
  }
  const res = await runAggregation(env);
  return json(res, res.ok ? 200 : 500);
}

export function signalsOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Key, X-Install-Id',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
