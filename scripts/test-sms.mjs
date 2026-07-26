// Unit tests for the SMS-blocking backend (v2.0.0, Path D). Run with: npm test
import { isValidHash, cleanTokens, resolveVerdict, DEFAULT_SPAM_KEYWORDS } from '../functions/api/sms-utils.js';
import { handleSmsCheck } from '../functions/api/sms-check.js';
import { handleSmsReport } from '../functions/api/sms-report.js';
import { handleSmsKeywords } from '../functions/api/sms-keywords.js';
import { handleAdminSmsReportsList, handleAdminSmsReportPatch } from '../functions/api/admin-sms-reports.js';
import { trackEvent, getLiveStats } from '../functions/api/_analytics.js';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  - ${name}`); }
  else { failed++; console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

class MockKV {
  constructor() { this.store = new Map(); }
  async get(k) { return this.store.has(k) ? this.store.get(k) : null; }
  async put(k, v, opts) {
    if (opts && opts.expirationTtl != null && opts.expirationTtl < 60) throw new Error(`ttl<60: ${opts.expirationTtl}`);
    this.store.set(k, String(v));
  }
  async delete(k) { this.store.delete(k); }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    return { keys: [...this.store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}
const HASH = 'a'.repeat(64);
function req({ body, ip = '203.0.113.9', adminKey, url = 'https://spaminthai.com/x', method = 'POST' } = {}) {
  return {
    url, method,
    headers: { get: (h) => (h === 'CF-Connecting-IP' ? ip : h === 'X-Admin-Key' ? adminKey : null) },
    json: async () => body,
  };
}
const status = async (fn, request, env, extra = {}) => (await fn({ request, env, ...extra })).status;

// --- sms-utils ---
check('valid 64-hex hash', isValidHash(HASH) === true);
check('reject bad hash', isValidHash('nope') === false);
check('reject wrong-length hash', isValidHash('a'.repeat(63)) === false);
check('cleanTokens caps + lowercases', cleanTokens(['  ABC ', 123, 'x'.repeat(99)]).length === 2);
check('resolveVerdict safe', resolveVerdict({ safeHit: true }).verdict === 'safe');
check('resolveVerdict spam(community)', resolveVerdict({ spamHit: true }).source === 'community');
check('resolveVerdict keyword', resolveVerdict({ keywordHit: true }).source === 'keyword');
check('resolveVerdict unknown', resolveVerdict({}).verdict === 'unknown');

// --- sms-check ---
{
  const env = { SPAM_KV: new MockKV() };
  await env.SPAM_KV.put(`sms:hash:${HASH}`, JSON.stringify({ source: 'community' }));
  const r = await (await handleSmsCheck({ request: req({ body: { hash: HASH } }), env })).json();
  check('community spam hit -> spam', r.verdict === 'spam' && r.source === 'community', JSON.stringify(r));
}
{
  const env = { SPAM_KV: new MockKV() };
  await env.SPAM_KV.put(`sms:safe:${HASH}`, '1');
  const r = await (await handleSmsCheck({ request: req({ body: { hash: HASH } }), env })).json();
  check('safe hit -> safe', r.verdict === 'safe');
}
{
  const env = { SPAM_KV: new MockKV() };
  const r = await (await handleSmsCheck({ request: req({ body: { hash: HASH, tokens: ['เงินกู้ด่วนอนุมัติ'] } }), env })).json();
  check('keyword token -> spam(keyword)', r.verdict === 'spam' && r.source === 'keyword', JSON.stringify(r));
}
{
  const env = { SPAM_KV: new MockKV() };
  const r = await (await handleSmsCheck({ request: req({ body: { hash: HASH, tokens: ['helloworld'] } }), env })).json();
  check('no signal -> unknown', r.verdict === 'unknown');
}
check('invalid hash -> 400', (await status(handleSmsCheck, req({ body: { hash: 'x' } }), { SPAM_KV: new MockKV() })) === 400);
{
  const env = { SPAM_KV: new MockKV() };
  let ok = 0;
  for (let i = 0; i < 60; i++) if ((await status(handleSmsCheck, req({ body: { hash: HASH } }), env)) === 200) ok++;
  check('sms-check 60/min pass', ok === 60, `ok=${ok}`);
  check('sms-check 61st -> 429', (await status(handleSmsCheck, req({ body: { hash: HASH } }), env)) === 429);
}

// --- sms-report ---
{
  const env = { SPAM_KV: new MockKV() };
  const res = await handleSmsReport({ request: req({ body: { hash: HASH, reason: 'เงินกู้เถื่อน', tokens: ['เงินกู้'] } }), env });
  const b = await res.json();
  check('valid report -> ok+id', res.status === 200 && b.ok && b.id, JSON.stringify(b));
  check('report stored', env.SPAM_KV.store.has(`sms:report:${b.id}`));
  check('report index pushed', JSON.parse(env.SPAM_KV.store.get('sms:reports:index')).length === 1);
  const rec = JSON.parse(env.SPAM_KV.store.get(`sms:report:${b.id}`));
  check('report stores NO body field', !('body' in rec) && rec.hash === HASH);
}
check('report invalid hash -> 400', (await status(handleSmsReport, req({ body: { hash: 'x', reason: 'aaa' } }), { SPAM_KV: new MockKV() })) === 400);
check('report short reason -> 400', (await status(handleSmsReport, req({ body: { hash: HASH, reason: 'a' } }), { SPAM_KV: new MockKV() })) === 400);

// --- sms-keywords ---
{
  const r = await (await handleSmsKeywords({ env: { SPAM_KV: new MockKV() } })).json();
  check('keywords returns defaults', Array.isArray(r.keywords) && r.keywords.length === DEFAULT_SPAM_KEYWORDS.length && r.count > 0);
}

// --- admin sms-reports auth + approve ---
const PW = 'admin-secret';
check('admin no password -> 503', (await status(handleAdminSmsReportsList, req({ adminKey: PW, url: 'https://spaminthai.com/admin/api/sms-reports', method: 'GET' }), { SPAM_KV: new MockKV() })) === 503);
check('admin wrong key -> 401', (await status(handleAdminSmsReportsList, req({ adminKey: 'bad', url: 'https://spaminthai.com/admin/api/sms-reports', method: 'GET' }), { TIP_ADMIN_PASSWORD: PW, SPAM_KV: new MockKV() })) === 401);
{
  const env = { TIP_ADMIN_PASSWORD: PW, SPAM_KV: new MockKV() };
  const rep = await handleSmsReport({ request: req({ body: { hash: HASH, reason: 'สแปมเงินกู้' } }), env });
  const id = (await rep.json()).id;
  check('admin list returns pending', (await (await handleAdminSmsReportsList({ request: req({ adminKey: PW, url: 'https://spaminthai.com/admin/api/sms-reports?status=pending', method: 'GET' }), env })).json()).reports.length === 1);
  const pr = await handleAdminSmsReportPatch({ request: req({ adminKey: PW, body: { action: 'approve' }, method: 'PATCH' }), env, id });
  check('approve -> 200', pr.status === 200);
  check('approve promotes sms:hash', env.SPAM_KV.store.has(`sms:hash:${HASH}`));
}

// --- analytics sms_adoption ---
{
  const env = { SPAM_KV: new MockKV() };
  const now = new Date('2026-07-26T10:00:00Z');
  await trackEvent(env, { event: 'heartbeat', source: 'app', vid: 'a' + 'S'.repeat(20), app_version: '2.0.0', sms_enabled: true }, now);
  const s = await getLiveStats(env, now);
  check('sms_enabled -> smson marker + adoption', s.sms_enabled_devices === 1 && s.sms_adoption === 100, JSON.stringify({ d: s.sms_enabled_devices, a: s.sms_adoption }));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
