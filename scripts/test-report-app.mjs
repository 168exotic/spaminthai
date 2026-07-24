// Unit tests for the app-source report path (functions/api/report.js handleAppReport)
// Run with: npm test
import { handleAppReport } from '../functions/api/report.js';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  - ${name}`); }
  else { failed++; console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

class MockKV {
  constructor() { this.store = new Map(); }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async put(k, v) { this.store.set(k, String(v)); }
}

const KEY = 'test-app-key-123';
function req(headerKey) {
  return { headers: { get: (h) => (h === 'X-App-Key' ? headerKey : null) } };
}
function env() { return { APP_REPORT_KEY: KEY, SPAM_KV: new MockKV() }; }
const goodBody = { source: 'app', phone: '0655081234', category: 'scam', deviceId: 'dev-1', appVersion: '1.0.20' };

async function status(request, environment, body) {
  const res = await handleAppReport({ request, env: environment, body });
  return res.status;
}

// --- auth ---
check('missing X-App-Key -> 401', (await status(req(null), env(), goodBody)) === 401);
check('wrong key -> 401', (await status(req('nope'), env(), goodBody)) === 401);
{
  const e = env(); delete e.APP_REPORT_KEY;
  check('no APP_REPORT_KEY configured -> 401', (await status(req(KEY), e, goodBody)) === 401);
}

// --- validation ---
check('missing deviceId -> 400', (await status(req(KEY), env(), { ...goodBody, deviceId: '' })) === 400);
check('invalid phone -> 400', (await status(req(KEY), env(), { ...goodBody, phone: '123' })) === 400);

// --- happy path ---
{
  const e = env();
  const res = await handleAppReport({ request: req(KEY), env: e, body: goodBody });
  check('valid app report -> 200', res.status === 200);
  const stored = [...e.SPAM_KV.store.entries()].find(([k]) => k.startsWith('report:0655081234:'));
  check('stores report:<phone>:<ts>', Boolean(stored), 'no report key');
  const rec = stored ? JSON.parse(stored[1]) : {};
  check('record has source=app', rec.source === 'app');
  check('record status pending', rec.status === 'pending');
  check('record appVersion carried', rec.appVersion === '1.0.20');
}

// --- +66 normalization accepted ---
check('+66 phone normalized+accepted -> 200', (await status(req(KEY), env(), { ...goodBody, phone: '+66655081234' })) === 200);

// --- rate limit: 10 ok, 11th blocked (same device) ---
{
  const e = env();
  let ok = 0;
  for (let i = 0; i < 10; i++) {
    const r = await handleAppReport({ request: req(KEY), env: e, body: goodBody });
    if (r.status === 200) ok++;
  }
  check('first 10 reports pass', ok === 10, `ok=${ok}`);
  const r11 = await handleAppReport({ request: req(KEY), env: e, body: goodBody });
  check('11th report -> 429', r11.status === 429, String(r11.status));
  check('429 sets Retry-After', /\d+/.test(r11.headers.get('Retry-After') || ''));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
