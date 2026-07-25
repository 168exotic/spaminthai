// Unit tests for /admin/live analytics (functions/api/_analytics.js + admin-live.js)
// Run with: npm test
import { trackEvent, getLiveStats, isValidVid, isValidVersion, last24Hours } from '../functions/api/_analytics.js';
import { handleLiveStats } from '../functions/api/admin-live.js';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  - ${name}`); }
  else { failed++; console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

class MockKV {
  constructor() { this.store = new Map(); }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async put(k, v, opts) {
    if (opts && opts.expirationTtl != null && opts.expirationTtl < 60) {
      throw new Error(`KV expirationTtl must be >= 60 (got ${opts.expirationTtl})`);
    }
    this.store.set(k, String(v));
  }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    const keys = [...this.store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
    return { keys, list_complete: true, cursor: undefined };
  }
}
const envKV = () => ({ SPAM_KV: new MockKV() });
const NOW = new Date('2026-07-25T10:30:00Z');

// --- isValidVid ---
check('valid app vid', isValidVid('app', 'a' + '0'.repeat(20)) === true);
check('app vid must start with a', isValidVid('app', 'w12345678') === false);
check('web vid must start with w', isValidVid('web', 'a12345678') === false);
check('short vid rejected', isValidVid('app', 'a12') === false);

// --- trackEvent heartbeat records presence/d1/w1/hourly ---
{
  const env = envKV();
  const vid = 'a' + '1'.repeat(24);
  const r = await trackEvent(env, { event: 'heartbeat', source: 'app', vid }, NOW);
  check('heartbeat ok', r.ok === true, JSON.stringify(r));
  check('presence set', env.SPAM_KV.store.has(`pres:${vid}`));
  check('d1 set', env.SPAM_KV.store.has(`d1:${vid}`));
  check('w1 set', env.SPAM_KV.store.has(`w1:${vid}`));
  const hourKeys = [...env.SPAM_KV.store.keys()].filter((k) => k.startsWith('hc:'));
  check('hourly counter set', hourKeys.length === 1 && env.SPAM_KV.store.get(hourKeys[0]) === '1');
}

// --- invalid vid rejected ---
check('heartbeat bad vid -> invalid_vid',
  (await trackEvent(envKV(), { event: 'heartbeat', source: 'app', vid: 'nope' }, NOW)).error === 'invalid_vid');
check('unknown event rejected',
  (await trackEvent(envKV(), { event: 'wat', source: 'app', vid: 'a'.repeat(10) }, NOW)).error === 'invalid_event');

// --- getLiveStats shape + counts ---
{
  const env = envKV();
  // two distinct devices this hour, plus one re-ping (throttled -> still 1 unique)
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + 'A'.repeat(20) }, NOW);
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + 'B'.repeat(20) }, NOW);
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + 'A'.repeat(20) }, NOW); // dup
  const s = await getLiveStats(env, NOW);
  check('live_now = 2 unique devices', s.live_now === 2, String(s.live_now));
  check('active_24h = 2', s.active_24h === 2, String(s.active_24h));
  check('active_7d = 2', s.active_7d === 2, String(s.active_7d));
  check('hourly has 24 buckets', Array.isArray(s.hourly) && s.hourly.length === 24);
  const curBucket = s.hourly[s.hourly.length - 1];
  check('current hour count = 2', curBucket.count === 2, JSON.stringify(curBucket));
  check('version_dist null (no app_version yet)', s.version_dist === null);
  check('has last_updated', typeof s.last_updated === 'string' && s.last_updated.length > 0);
}

check('last24Hours returns 24 labels', last24Hours(NOW).length === 24);

// --- app_version / version_dist (v1.0.21) ---
check('valid semver version', isValidVersion('1.0.21') === true);
check('reject non-semver version', isValidVersion('1.0') === false);
check('reject overlong version (>10 chars)', isValidVersion('100.200.300') === false);
check('reject non-string version', isValidVersion(null) === false);
{
  const env = envKV();
  const vid = 'a' + 'V'.repeat(20);
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid, app_version: '1.0.21' }, NOW);
  const verKeys = [...env.SPAM_KV.store.keys()].filter((k) => k.startsWith('ver:'));
  check('valid app_version -> ver key stored', verKeys.length === 1 && verKeys[0] === `ver:1.0.21:${vid}`, verKeys.join(','));
}
{
  const env = envKV();
  const r = await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + 'X'.repeat(20), app_version: 'garbage' }, NOW);
  check('invalid app_version -> heartbeat still ok', r.ok === true);
  check('invalid app_version -> not stored', [...env.SPAM_KV.store.keys()].filter((k) => k.startsWith('ver:')).length === 0);
}
{
  const env = envKV();
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + '1'.repeat(20), app_version: '1.0.21' }, NOW);
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + '2'.repeat(20), app_version: '1.0.21' }, NOW);
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + '3'.repeat(20), app_version: '1.0.20' }, NOW);
  const s = await getLiveStats(env, NOW);
  check('version_dist aggregates unique devices per version',
    s.version_dist && s.version_dist['1.0.21'] === 2 && s.version_dist['1.0.20'] === 1, JSON.stringify(s.version_dist));
}
{
  const env = envKV();
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + '9'.repeat(20) }, NOW); // no version
  const s = await getLiveStats(env, NOW);
  check('version_dist null when no version data', s.version_dist === null);
}

// --- handleLiveStats auth + rate limit ---
function req(key, ip = '203.0.113.5') {
  return { headers: { get: (h) => (h === 'X-Admin-Key' ? key : h === 'CF-Connecting-IP' ? ip : null) } };
}
const PW = 'admin-secret';
async function status(request, env) { return (await handleLiveStats({ request, env })).status; }

check('no TIP_ADMIN_PASSWORD -> 401', (await status(req(PW), { SPAM_KV: new MockKV() })) === 401);
check('wrong key -> 401', (await status(req('bad'), { TIP_ADMIN_PASSWORD: PW, SPAM_KV: new MockKV() })) === 401);
{
  const env = { TIP_ADMIN_PASSWORD: PW, SPAM_KV: new MockKV() };
  const res = await handleLiveStats({ request: req(PW), env });
  check('valid admin -> 200', res.status === 200);
  const body = await res.json();
  check('body has live_now/active_24h/active_7d/hourly', ['live_now', 'active_24h', 'active_7d', 'hourly'].every((k) => k in body));
}
{
  // admin_not_configured error surfaces for the login page
  const res = await handleLiveStats({ request: req(''), env: { SPAM_KV: new MockKV() } });
  const body = await res.json();
  check('admin_not_configured error when password unset', body.error === 'admin_not_configured');
}
{
  // rate limit: 60/min/IP
  const env = { TIP_ADMIN_PASSWORD: PW, SPAM_KV: new MockKV() };
  let ok = 0;
  for (let i = 0; i < 60; i++) { if ((await handleLiveStats({ request: req(PW), env })).status === 200) ok++; }
  check('first 60 admin calls pass', ok === 60, `ok=${ok}`);
  check('61st -> 429', (await handleLiveStats({ request: req(PW), env })).status === 429);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
