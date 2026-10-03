#!/usr/bin/env node
/** Tests for province SEO pages (no real KV). */
import { PROVINCES, REGIONS, ALIASES } from '../functions/province/provinces.js';
import { matchProvincePath, renderProvincePage, renderThailandIndex, reportedForCode } from '../functions/province/render-province-page.js';

const store = new Map([
  ['num:076123456', JSON.stringify({ reports: 5, categories: { scam: 5 }, lastReport: new Date().toISOString() })],
  ['num:076999888', JSON.stringify({ reports: 1, categories: { ads: 1 }, lastReport: '2026-01-01T00:00:00Z' })],
  ['num:0812345678', JSON.stringify({ reports: 2 })],
]);
const env = { SPAM_KV: {
  async get(k) { return store.get(k) ?? null; },
  async put(k, v) { store.set(k, v); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
} };
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };

check('77 provinces', PROVINCES.size === 77, String(PROVINCES.size));
check('regions cover all', REGIONS.reduce((n, [, l]) => n + l.length, 0) === 77);
check('all codes valid', [...PROVINCES.values()].every((p) => /^0\d{1,2}$/.test(p.code)));
check('aliases point to real slugs', Object.values(ALIASES).every((s) => PROVINCES.has(s)));
check('match province', matchProvincePath('/phuket')?.slug === 'phuket');
check('match index', matchProvincePath('/thailand')?.type === 'index');
check('alias redirect', matchProvincePath('/phangnhga')?.to === '/phang-nga');
check('compact redirect', matchProvincePath('/chiangmai')?.to === '/chiang-mai');
check('trailing slash redirect', matchProvincePath('/bangkok/')?.to === '/bangkok');
for (const p of ['/check', '/report', '/download', '/blog', '/news-1', '/privacy', '/terms', '/admin', '/guide', '/', '/api/lookup']) {
  check('no clash ' + p, matchProvincePath(p) === null);
}
const r = await reportedForCode(env, '076');
check('area list only landlines w/ prefix', r.total === 2 && r.items[0].number === '076123456', JSON.stringify(r));
check('area list cached', store.has('seo:area:076'));
const res = await renderProvincePage('phuket', env);
const html = await res.text();
check('page 200', res.status === 200);
check('page has Thai name + code', html.includes('ภูเก็ต') && html.includes('076'));
check('page lists reported number', html.includes('/check/076123456'));
check('page links neighbour Phang Nga', html.includes('href="/phang-nga"'));
check('page has Google Play link', html.includes('play.google.com/store/apps/details?id=com.jarvis.callblocker'));
check('no APK links', !/spaminthai-latest\.apk|href="\/download"/.test(html));
const empty = await (await renderProvincePage('yala', env)).text();
check('empty province shows report CTA', empty.includes('/report'));
check('unknown province 404', (await renderProvincePage('nowhere', env)).status === 404);
const idx = await renderThailandIndex().text();
check('index lists 77 links', (idx.match(/<li><a href="\/[a-z-]+">/g) || []).length === 77);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
