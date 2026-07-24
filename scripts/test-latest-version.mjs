// Unit tests for functions/api/latest-version.js
// Run with: npm test
import {
  stripV,
  pickApkAsset,
  parseGithubRelease,
  parseKvOverride,
  resolveLatestVersion,
  handleLatestVersion,
  withinRateLimit,
  RATE_LIMIT_PER_MIN,
} from '../functions/api/latest-version.js';

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  - ${name}`);
  } else {
    failed++;
    console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`);
  }
}

// Minimal in-memory KV double (get/put with the shapes this module uses).
class MockKV {
  constructor() {
    this.store = new Map();
  }
  async get(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  async put(k, v) {
    this.store.set(k, String(v));
  }
}

function mockRequest(ip = '203.0.113.7') {
  return { headers: { get: (h) => (h === 'CF-Connecting-IP' ? ip : null) } };
}

// A fetch double that returns a canned Response.
function fetchReturning(status, body) {
  return async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const RELEASE_FIXTURE = {
  tag_name: 'v1.0.17',
  body: 'UI redesign + in-app updater',
  assets: [
    {
      name: 'source.zip',
      browser_download_url: 'https://example.com/source.zip',
    },
    {
      name: 'spaminthai-v1.0.17.apk',
      browser_download_url:
        'https://github.com/168exotic/spaminthai/releases/download/v1.0.17/spaminthai-v1.0.17.apk',
    },
  ],
};

// --- stripV ---
check('stripV drops leading v', stripV('v1.0.17') === '1.0.17');
check('stripV drops leading V', stripV('V2.3') === '2.3');
check('stripV leaves bare version', stripV('1.0.17') === '1.0.17');
check('stripV handles empty', stripV('') === '');

// --- pickApkAsset ---
check(
  'pickApkAsset prefers .apk over other assets',
  pickApkAsset(RELEASE_FIXTURE.assets) ===
    'https://github.com/168exotic/spaminthai/releases/download/v1.0.17/spaminthai-v1.0.17.apk',
);
check('pickApkAsset returns null on empty', pickApkAsset([]) === null);
check('pickApkAsset returns null on non-array', pickApkAsset(undefined) === null);
check(
  'pickApkAsset falls back to first asset when no apk',
  pickApkAsset([{ browser_download_url: 'https://x/y.bin' }]) === 'https://x/y.bin',
);

// --- parseGithubRelease ---
{
  const r = parseGithubRelease(RELEASE_FIXTURE);
  check('parseGithubRelease version', r && r.version === '1.0.17', JSON.stringify(r));
  check(
    'parseGithubRelease url is the apk',
    r && /spaminthai-v1\.0\.17\.apk$/.test(r.url),
    JSON.stringify(r),
  );
  check('parseGithubRelease notes', r && r.notes === 'UI redesign + in-app updater');
}
check('parseGithubRelease null on null', parseGithubRelease(null) === null);
check(
  'parseGithubRelease null when no tag',
  parseGithubRelease({ assets: RELEASE_FIXTURE.assets }) === null,
);
check(
  'parseGithubRelease null when no downloadable asset',
  parseGithubRelease({ tag_name: 'v1.0.17', assets: [] }) === null,
);

// --- parseKvOverride ---
{
  const o = parseKvOverride(
    JSON.stringify({ version: 'v1.0.17', url: 'https://x/a.apk', notes: 'hi' }),
  );
  check('parseKvOverride json object', o && o.version === '1.0.17' && o.url === 'https://x/a.apk');
}
check('parseKvOverride bare string version', parseKvOverride('1.0.18').version === '1.0.18');
check('parseKvOverride null on empty', parseKvOverride('') === null);
check('parseKvOverride null on versionless object', parseKvOverride('{"url":"x"}') === null);

// --- resolveLatestVersion: KV override wins over GitHub ---
{
  const env = { SPAM_KV: new MockKV() };
  await env.SPAM_KV.put(
    'latest_version',
    JSON.stringify({ version: '1.0.99', url: 'https://x/override.apk', notes: 'forced' }),
  );
  const boom = async () => {
    throw new Error('GitHub should not be called when override present');
  };
  const r = await resolveLatestVersion(env, boom);
  check('resolve: KV override wins', r && r.version === '1.0.99' && r.url === 'https://x/override.apk');
}

// --- resolveLatestVersion: override without url is ignored, falls to GitHub ---
{
  const env = { SPAM_KV: new MockKV() };
  await env.SPAM_KV.put('latest_version', JSON.stringify({ version: '1.0.99' })); // no url
  const r = await resolveLatestVersion(env, fetchReturning(200, RELEASE_FIXTURE));
  check('resolve: urlless override ignored -> GitHub', r && r.version === '1.0.17', JSON.stringify(r));
}

// --- resolveLatestVersion: GitHub path ---
{
  const env = { SPAM_KV: new MockKV() };
  const r = await resolveLatestVersion(env, fetchReturning(200, RELEASE_FIXTURE));
  check('resolve: GitHub happy path', r && r.version === '1.0.17', JSON.stringify(r));
}

// --- resolveLatestVersion: GitHub failure -> null ---
{
  const env = { SPAM_KV: new MockKV() };
  const r = await resolveLatestVersion(env, fetchReturning(403, { message: 'rate limited' }));
  check('resolve: GitHub non-200 -> null', r === null);
}

// --- withinRateLimit: 60/min then blocks ---
{
  const env = { SPAM_KV: new MockKV() };
  let allowed = 0;
  for (let i = 0; i < RATE_LIMIT_PER_MIN + 5; i++) {
    if (await withinRateLimit(env, '198.51.100.4')) allowed++;
  }
  check('rate limit allows exactly 60/min', allowed === RATE_LIMIT_PER_MIN, `allowed=${allowed}`);
}
check('rate limit allows when no KV bound', (await withinRateLimit({}, '1.2.3.4')) === true);

// --- handleLatestVersion: 200 shape via KV override (no network) ---
{
  const env = { SPAM_KV: new MockKV() };
  await env.SPAM_KV.put(
    'latest_version',
    JSON.stringify({ version: '1.0.17', url: 'https://x/a.apk', notes: 'n' }),
  );
  const res = await handleLatestVersion({ request: mockRequest(), env });
  check('handle: 200 status', res.status === 200, String(res.status));
  const body = await res.json();
  check('handle: body has version/url/notes', 'version' in body && 'url' in body && 'notes' in body);
  check('handle: sets cache header', /max-age=300/.test(res.headers.get('Cache-Control') || ''));
}

// --- handleLatestVersion: 429 when over rate limit ---
{
  const env = { SPAM_KV: new MockKV() };
  const minute = new Date().toISOString().slice(0, 16);
  // Pre-fill this IP's bucket to the cap. Hash prefix is opaque, so exhaust via the API.
  for (let i = 0; i < RATE_LIMIT_PER_MIN; i++) {
    await withinRateLimit(env, '198.51.100.9');
  }
  // The handler uses a fresh request from the same IP -> should now be limited.
  const res = await handleLatestVersion({ request: mockRequest('198.51.100.9'), env });
  check('handle: 429 when rate limited', res.status === 429, String(res.status));
  void minute;
}

// --- handleLatestVersion: 503 when nothing resolves (empty KV + failing fetch) ---
{
  const env = { SPAM_KV: new MockKV() };
  const savedFetch = globalThis.fetch;
  globalThis.fetch = fetchReturning(500, { message: 'down' });
  try {
    const res = await handleLatestVersion({ request: mockRequest('192.0.2.50'), env });
    check('handle: 503 when unavailable', res.status === 503, String(res.status));
  } finally {
    globalThis.fetch = savedFetch;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
