// Anonymous usage analytics (KV: SPAM_KV). No PII — only a random visitor id.
//
// Powers /admin/live. The Android app (v1.0.15+) already POSTs heartbeats to
// /api/event with a random vid ("a"+uuid); this module records them so the
// admin dashboard can show live / 24h / 7d device counts.
//
// Key scheme (all in SPAM_KV, all self-expiring — nothing to clean up):
//   pres:<vid>          TTL 120s   -> "live now" (device pinged in last ~2 min)
//   d1:<vid>            TTL 24h    -> unique devices in the last 24h
//   w1:<vid>            TTL 7d     -> unique devices in the last 7d
//   hbthr:<vid>         TTL 30s    -> throttle the heavier writes below
//   hs:<hour>:<vid>     TTL ~25h   -> per-hour dedup marker
//   hc:<hour>           TTL ~25h   -> per-hour unique-device counter (cheap read)
// where <hour> = "YYYY-MM-DDTHH" in Asia/Bangkok.

const EVENTS = new Set(['pageview', 'download', 'lookup', 'app_open', 'heartbeat']);
const SOURCES = new Set(['web', 'app']);

const PRESENCE_TTL = 120;
const HEARTBEAT_MIN_INTERVAL = 60;
const DAY_TTL = 24 * 60 * 60;
const WEEK_TTL = 7 * 24 * 60 * 60;
const HOUR_TTL = 25 * 60 * 60;

const VID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function isValidVersion(v) {
  return typeof v === 'string' && v.length <= 10 && VERSION_RE.test(v);
}

export function isValidVid(source, vid) {
  if (!vid || !VID_RE.test(vid)) return false;
  if (source === 'app' && !vid.startsWith('a')) return false;
  if (source === 'web' && !vid.startsWith('w')) return false;
  return true;
}

export function todayBangkok(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

// "YYYY-MM-DDTHH" in Asia/Bangkok.
export function hourBangkok(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(d).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  let hh = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hh}`;
}

// The last 24 hour-bucket labels, oldest first, ending with the current hour.
export function last24Hours(now = new Date()) {
  const out = [];
  for (let i = 23; i >= 0; i--) {
    out.push(hourBangkok(new Date(now.getTime() - i * 60 * 60 * 1000)));
  }
  return out;
}

async function has(env, key) {
  return (await env.SPAM_KV.get(key)) !== null;
}

async function incHourly(env, vid, hour) {
  const marker = `hs:${hour}:${vid}`;
  if (await has(env, marker)) return;
  await env.SPAM_KV.put(marker, '1', { expirationTtl: HOUR_TTL });
  const cKey = `hc:${hour}`;
  const cur = parseInt((await env.SPAM_KV.get(cKey)) || '0', 10) || 0;
  await env.SPAM_KV.put(cKey, String(cur + 1), { expirationTtl: HOUR_TTL });
}

async function recordHeartbeat(env, vid, now = new Date(), appVersion = null) {
  // Always refresh presence so the device stays "live".
  await env.SPAM_KV.put(`pres:${vid}`, '1', { expirationTtl: PRESENCE_TTL });

  // Throttle the heavier dedup writes (heartbeats arrive ~every 60s).
  if (await has(env, `hbthr:${vid}`)) return;
  await env.SPAM_KV.put(`hbthr:${vid}`, '1', { expirationTtl: HEARTBEAT_MIN_INTERVAL });

  if (!(await has(env, `d1:${vid}`))) await env.SPAM_KV.put(`d1:${vid}`, '1', { expirationTtl: DAY_TTL });
  if (!(await has(env, `w1:${vid}`))) await env.SPAM_KV.put(`w1:${vid}`, '1', { expirationTtl: WEEK_TTL });
  // v1.0.21: per-version dedup marker (refreshed each window -> rolling 24h).
  // No PII: <version> is a public app version, <vid> is the random visitor id.
  if (isValidVersion(appVersion)) {
    await env.SPAM_KV.put(`ver:${appVersion}:${vid}`, '1', { expirationTtl: DAY_TTL });
  }
  await incHourly(env, vid, hourBangkok(now));
}

export async function trackEvent(env, { event, source = 'app', vid, app_version }, now = new Date()) {
  if (!EVENTS.has(event)) return { ok: false, error: 'invalid_event' };
  const src = SOURCES.has(source) ? source : 'app';
  if (!isValidVid(src, vid)) return { ok: false, error: 'invalid_vid' };
  // An invalid app_version is simply ignored (heartbeat still records).
  await recordHeartbeat(env, vid, now, app_version);
  return { ok: true };
}

async function countPrefix(env, prefix) {
  let count = 0;
  let cursor;
  do {
    const list = await env.SPAM_KV.list({ prefix, cursor, limit: 1000 });
    count += list.keys.length;
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return count;
}

// Unique devices per app_version in the last 24h, from ver:<version>:<vid> keys.
// Returns null when no version data exists (older app builds send no version).
async function versionDist(env) {
  const counts = {};
  let cursor;
  do {
    const list = await env.SPAM_KV.list({ prefix: 'ver:', cursor, limit: 1000 });
    for (const k of list.keys) {
      const rest = k.name.slice('ver:'.length); // "<version>:<vid>"
      const idx = rest.indexOf(':');
      if (idx > 0) {
        const ver = rest.slice(0, idx);
        counts[ver] = (counts[ver] || 0) + 1;
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return Object.keys(counts).length ? counts : null;
}

export async function getLiveStats(env, now = new Date()) {
  const hours = last24Hours(now);
  const hourly = [];
  for (const h of hours) {
    hourly.push({ hour: h, count: parseInt((await env.SPAM_KV.get(`hc:${h}`)) || '0', 10) || 0 });
  }
  const [liveNow, active24h, active7d, version_dist] = await Promise.all([
    countPrefix(env, 'pres:'),
    countPrefix(env, 'd1:'),
    countPrefix(env, 'w1:'),
    versionDist(env),
  ]);
  return {
    live_now: liveNow,
    active_24h: active24h,
    active_7d: active7d,
    hourly,
    version_dist,
    last_updated: now.toISOString(),
  };
}
