#!/usr/bin/env node
/** Unit tests for /api/linkcheck (mock KV + mock Safe Browsing). */

import { normalizeUrl, checkLink, handleLinkCheck } from '../functions/api/linkcheck.js';

function mockKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async put(k, v) {
      store.set(k, v);
    },
    async delete(k) {
      store.delete(k);
    },
    async list() {
      return { keys: [], list_complete: true };
    },
  };
}

/** fetch stub: flags any URL containing "phish" as SOCIAL_ENGINEERING. */
let googleCalls = 0;
async function fakeFetch(url, init) {
  googleCalls++;
  const body = JSON.parse(init.body);
  const target = body.threatInfo.threatEntries[0].url;
  const matches = target.includes('phish') ? [{ threatType: 'SOCIAL_ENGINEERING', threat: { url: target } }] : [];
  return { ok: true, status: 200, async json() { return matches.length ? { matches } : {}; } };
}
async function failingFetch() {
  throw new TypeError('network down');
}

let passed = 0;
let failed = 0;
function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  ok  - ${label}`);
    passed++;
  } else {
    console.error(`  FAIL - ${label}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function main() {
  // normalisation
  check('bare domain gets https', normalizeUrl('mimi888.fun')?.url === 'https://mimi888.fun/');
  check('www stripped from host', normalizeUrl('https://www.scb.co.th/x')?.host === 'scb.co.th');
  check('trailing punctuation removed', normalizeUrl('https://example.com/a).')?.url === 'https://example.com/a');
  check('non-http rejected', normalizeUrl('mailto:a@b.com') === null);
  check('garbage rejected', normalizeUrl('hello world') === null);

  // danger via Google
  const env = { SPAM_KV: mockKv(), SAFE_BROWSING_KEY: 'test-key' };
  const r1 = await checkLink('http://bad.example/phish.html', env, { fetchImpl: fakeFetch });
  check('google match => danger', r1.status === 'danger' && r1.listed === true, JSON.stringify(r1));
  check('thai reason attached', r1.reasons.some((x) => x.includes('ฟิชชิ่ง')));
  check('cached after first call', [...env.SPAM_KV.store.keys()].some((k) => k.startsWith('linkcheck:cache:')));

  // cache hit skips Google
  const before = googleCalls;
  const r1b = await checkLink('http://bad.example/phish.html', env, { fetchImpl: fakeFetch });
  check('second call served from cache', r1b.cached === true && googleCalls === before);

  // not found
  const r2 = await checkLink('https://www.scb.co.th/', env, { fetchImpl: fakeFetch });
  check('clean url => not_found (never "safe")', r2.status === 'not_found' && r2.listed === false);
  check('google reported as checked', r2.sources.google.checked === true);

  // own block list wins even without Google
  const env2 = { SPAM_KV: mockKv({ 'linkcheck:block:mimi888.fun': 'เว็บพนันที่มีรายงาน' }) };
  const r3 = await checkLink('https://mimi888.fun/promo', env2, { fetchImpl: fakeFetch });
  check('own block list => danger without key', r3.status === 'danger' && r3.sources.spaminthai.block === true);
  check('parent-domain block applies to subdomain', (await checkLink('https://m.mimi888.fun/', env2, { fetchImpl: fakeFetch })).status === 'danger');

  // allow list
  const env3 = { SPAM_KV: mockKv({ 'linkcheck:allow:spaminthai.com': 'เว็บของเรา' }), SAFE_BROWSING_KEY: 'k' };
  const r4 = await checkLink('https://spaminthai.com/phish', env3, { fetchImpl: fakeFetch });
  check('allow list short-circuits google', r4.status === 'allowed' && r4.sources.google.checked === false);

  // provider down => unavailable, not cached
  const env4 = { SPAM_KV: mockKv(), SAFE_BROWSING_KEY: 'k' };
  const r5 = await checkLink('https://unknown.example/', env4, { fetchImpl: failingFetch });
  check('network failure => unavailable', r5.status === 'unavailable' && r5.sources.google.reason === 'network');
  check('unavailable is not cached', ![...env4.SPAM_KV.store.keys()].some((k) => k.startsWith('linkcheck:cache:')));

  // no key configured
  const r6 = await checkLink('https://unknown.example/', { SPAM_KV: mockKv() }, { fetchImpl: fakeFetch });
  check('missing key => unavailable with reason no_key', r6.status === 'unavailable' && r6.sources.google.reason === 'no_key');

  // HTTP handler: validation + GET/POST
  const envH = { SPAM_KV: mockKv(), SAFE_BROWSING_KEY: 'k' };
  const bad = await handleLinkCheck({ request: new Request('https://spaminthai.com/api/linkcheck', { method: 'POST', body: '{"url":"not a url"}', headers: { 'Content-Type': 'application/json' } }), env: envH });
  check('invalid url => 400', bad.status === 400);
  const missing = await handleLinkCheck({ request: new Request('https://spaminthai.com/api/linkcheck', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), env: envH });
  check('missing url => 400', missing.status === 400);
  const get = await handleLinkCheck({ request: new Request('https://spaminthai.com/api/linkcheck?url=mimi888.fun'), env: envH });
  check('GET ?url= answers 200 json', get.status === 200 && (await get.json()).host === 'mimi888.fun');

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
