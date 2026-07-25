// Unit tests for functions/api/_security.js
// Run with: npm test
import {
  detectThreat,
  bodyTooLarge,
  checkRateLimit,
  RATE_LIMITS,
  guardAdmin,
  recordAdminFailure,
  isAdminLocked,
  turnstileOk,
  securityHeaders,
  corsOrigin,
} from '../functions/api/_security.js';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  - ${name}`); }
  else { failed++; console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

function req({ method = 'GET', path = '/', query = '', origin = null, contentLength = null } = {}) {
  const url = `https://spaminthai.com${path}${query}`;
  return {
    method,
    url,
    headers: {
      get: (h) => {
        if (h === 'Origin') return origin;
        if (h === 'Content-Length') return contentLength;
        if (h === 'CF-Connecting-IP') return '198.51.100.1';
        return null;
      },
    },
  };
}

// --- detectThreat ---
{
  const url = new URL('https://spaminthai.com/api/lookup?q=0812345678');
  check('clean lookup allowed', detectThreat(req(), url) === null);
}
{
  const r = req({ path: '/api/lookup', query: '?q=%2e%2e%2fetc%2fpasswd' });
  const url = new URL(r.url);
  check('path traversal blocked', detectThreat(r, url) === 'path_traversal');
}
{
  const url = new URL('https://spaminthai.com/.env');
  check('env probe blocked', detectThreat(req(), url) === 'probe');
}
{
  const r = req({ path: '/api/lookup', query: '?q=%3Cscript%3Ealert(1)%3C/script%3E' });
  const url = new URL(r.url);
  check('xss probe blocked', detectThreat(r, url) === 'xss_probe');
}
check('bad method blocked', detectThreat(req({ method: 'TRACE' }), new URL('https://spaminthai.com/')) === 'bad_method');

// --- bodyTooLarge ---
check('small body ok', bodyTooLarge(req({ contentLength: '1024' })) === false);
check('oversized body rejected', bodyTooLarge(req({ contentLength: String(4 * 1024 * 1024) })) === true);

// --- securityHeaders ---
{
  const h = securityHeaders();
  check('HSTS present', h['Strict-Transport-Security']?.includes('max-age'));
  check('CSP present', h['Content-Security-Policy']?.includes("default-src 'self'"));
  check('CSP allows YouTube embed', h['Content-Security-Policy']?.includes('www.youtube.com'));
  check('X-Frame-Options DENY', h['X-Frame-Options'] === 'DENY');
}

// --- corsOrigin ---
check('allowed origin returned', corsOrigin(req({ origin: 'https://spaminthai.com' })) === 'https://spaminthai.com');
check('unknown origin falls back', corsOrigin(req({ origin: 'https://evil.example' })) === 'https://spaminthai.com');

// --- checkRateLimit ---
class MockKV {
  constructor() { this.store = new Map(); }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async put(k, v) { this.store.set(k, String(v)); }
  async delete(k) { this.store.delete(k); }
}

{
  const env = { SPAM_KV: new MockKV() };
  let allowed = 0;
  for (let i = 0; i < RATE_LIMITS.lookup.max + 5; i++) {
    const r = await checkRateLimit(env, 'lookup', '1.2.3.4', RATE_LIMITS.lookup);
    if (r.allowed) allowed++;
  }
  check('lookup rate limit caps at max', allowed === RATE_LIMITS.lookup.max, `allowed=${allowed}`);
}

// --- admin lockout ---
{
  const env = { SPAM_KV: new MockKV(), TIP_ADMIN_PASSWORD: 'secret' };
  const isAdminFn = (r) => r.headers.get('X-Admin-Key') === 'secret';
  const jsonFn = (obj, status, extra = {}) => new Response(JSON.stringify(obj), { status, headers: extra });

  for (let i = 0; i < 5; i++) {
    const badReq = { headers: { get: (h) => (h === 'X-Admin-Key' ? 'wrong' : h === 'CF-Connecting-IP' ? '10.0.0.1' : null) } };
    await guardAdmin(badReq, env, isAdminFn, jsonFn);
  }
  check('admin locked after 5 failures', await isAdminLocked(env, '10.0.0.1'));
  const locked = await guardAdmin(
    { headers: { get: (h) => (h === 'X-Admin-Key' ? 'secret' : h === 'CF-Connecting-IP' ? '10.0.0.1' : null) } },
    env,
    isAdminFn,
    jsonFn,
  );
  check('locked admin gets 429 even with correct key', locked?.status === 429, String(locked?.status));
}

// --- turnstile no-op when secret unset ---
check('turnstile allows when not configured', (await turnstileOk({}, null, '1.2.3.4')) === true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
