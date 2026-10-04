#!/usr/bin/env node
/** Tests for /prefix SEO pages (no real KV). */
import { MOBILE_PREFIXES } from '../functions/api/carrier.js';
import { matchPrefixPath, renderPrefixPage, renderPrefixIndex, reportedForPrefix } from '../functions/prefix/render-prefix-page.js';
import { matchProvincePath } from '../functions/province/render-province-page.js';
import { buildSitemapXml } from '../functions/api/sitemap.js';

const store = new Map([
  ['num:0655084765', JSON.stringify({ reports: 14, categories: { scam: 14 }, lastReport: new Date().toISOString() })],
  ['num:0655059914', JSON.stringify({ reports: 2, categories: { ads: 2 }, lastReport: '2026-01-01T00:00:00Z' })],
  ['num:065123456', JSON.stringify({ reports: 3 })], // 9 digits: not a mobile, must be ignored
  ['num:0812345678', JSON.stringify({ reports: 5 })],
]);
const env = { SPAM_KV: {
  async get(k) { return store.get(k) ?? null; },
  async put(k, v) { store.set(k, v); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
} };
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';

check('30 mobile prefixes', MOBILE_PREFIXES.length === 30, String(MOBILE_PREFIXES.length));
check('match index', matchPrefixPath('/prefix')?.type === 'index');
check('match prefix', matchPrefixPath('/prefix/065')?.prefix === '065');
check('trailing slash redirect', matchPrefixPath('/prefix/065/')?.to === '/prefix/065');
check('unknown prefix -> null', matchPrefixPath('/prefix/070') === null && matchPrefixPath('/prefix/abc') === null);
check('/prefix does not clash with provinces', matchProvincePath('/prefix') === null);

const r = await reportedForPrefix(env, '065');
check('only 10-digit 065 numbers, most reported first', r.total === 2 && r.items[0].number === '0655084765', JSON.stringify(r));
check('prefix list cached', store.has('seo:prefix:065'));

const res = await renderPrefixPage('065', env);
const html = await res.text();
check('page 200', res.status === 200);
check('title targets "เบอร์ 065 มิจฉาชีพ"', /<title>เบอร์ 065 มิจฉาชีพ/.test(html));
check('carrier shown (AIS)', html.includes('ค่าย AIS'));
check('lists reported number', html.includes('/check/0655084765') && html.includes('065-508-4765'));
check('links related blog', html.includes('/blog/numbers-065-scam'));
check('links sibling prefixes', html.includes('href="/prefix/061"'));
check('Google Play CTA, no APK', html.includes(PLAY) && !/\.apk|href="\/download/.test(html));
check('canonical', html.includes('<link rel="canonical" href="https://spaminthai.com/prefix/065">'));
check('invalid prefix -> 404', (await renderPrefixPage('070', env)).status === 404);

const empty = await (await renderPrefixPage('099', env)).text();
check('empty prefix shows report CTA', empty.includes('ยังไม่มีเบอร์ 099'));

const idx = await renderPrefixIndex().text();
check('index links all prefixes', MOBILE_PREFIXES.every((p) => idx.includes(`href="/prefix/${p}"`)));

const xml = await buildSitemapXml(env);
check('sitemap has /prefix pages', xml.includes('<loc>https://spaminthai.com/prefix</loc>') && xml.includes('/prefix/065</loc>'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
