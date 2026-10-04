#!/usr/bin/env node
/** Tests for /monthly pages and the numbers sitemap (no real KV). */
import { listMonths, matchMonthlyPath, thaiMonthLabel, bangkokMonth, computeMonthlyStats, renderMonthlyPage, renderMonthlyIndex } from '../functions/monthly/render-monthly-page.js';
import { buildNumbersSitemapIndexXml, buildNumbersSitemapXml, handleNumbersSitemapGet, buildSitemapXml } from '../functions/api/sitemap.js';
import { bulkGetJson } from '../functions/api/kv-scan.js';

const NOW = Date.parse('2026-10-15T05:00:00Z');
const store = new Map([
  ['num:0655084765', JSON.stringify({ reports: 14, categories: { scam: 10, callcenter: 4 }, lastReport: '2026-10-03T10:00:00Z' })],
  ['num:0655059914', JSON.stringify({ reports: 2, categories: { ads: 2 }, lastReport: '2026-10-01T02:00:00Z' })],
  ['num:021234567', JSON.stringify({ reports: 3, categories: { callcenter: 3 }, lastReport: '2026-09-30T18:30:00Z' })], // = Oct 1 01:30 BKK
  ['num:0812345678', JSON.stringify({ reports: 5, categories: { loan: 5 }, lastReport: '2026-09-10T00:00:00Z' })],
  ['num:abc', 'x'],
]);
const env = { SPAM_KV: {
  async get(k) { return typeof k === 'string' ? store.get(k) ?? null : null; },
  async put(k, v) { store.set(k, v); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  async delete(k) { store.delete(k); },
} };
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };

check('months from 2026-07 to current, newest first', JSON.stringify(listMonths(NOW)) === '["2026-10","2026-09","2026-08","2026-07"]', JSON.stringify(listMonths(NOW)));
check('thai label', thaiMonthLabel('2026-10') === 'ตุลาคม 2569');
check('bangkok month boundary', bangkokMonth(Date.parse('2026-09-30T18:30:00Z')) === '2026-10');
check('match month', matchMonthlyPath('/monthly/2026-10', NOW)?.ym === '2026-10');
check('future month -> null', matchMonthlyPath('/monthly/2026-12', NOW) === null);
check('before first month -> null', matchMonthlyPath('/monthly/2026-01', NOW) === null);
check('trailing slash redirect', matchMonthlyPath('/monthly/2026-09/', NOW)?.to === '/monthly/2026-09');
check('bulkGetJson falls back without bulk support', (await bulkGetJson(env, ['num:0655084765'])).get('num:0655084765').reports === 14);

const s = await computeMonthlyStats(env, '2026-10');
check('october counts 3 numbers (incl. BKK-boundary)', s.reported === 3 && s.totalReports === 19, JSON.stringify(s));
check('top number first', s.top[0].number === '0655084765');
check('prefix 065 leads', s.prefixes[0][0] === '065' && s.prefixes[0][1] === 2);
check('category scam leads', s.categories[0][0] === 'scam');

const html = await (await renderMonthlyPage('2026-10', env, NOW)).text();
check('title has thai month', html.includes('<title>เบอร์มิจฉาชีพเดือนตุลาคม 2569'));
check('lists top number', html.includes('/check/0655084765'));
check('links prefix page', html.includes('href="/prefix/065"'));
check('Google Play, no APK', html.includes('play.google.com/store/apps/details?id=com.jarvis.callblocker') && !/\.apk|href="\/download/.test(html));
check('indexable when data', !html.includes('noindex'));
check('current month cached with TTL key', store.has('seo:monthly:2026-10'));

const july = await (await renderMonthlyPage('2026-07', env, NOW)).text();
check('empty month is noindex', july.includes('<meta name="robots" content="noindex,follow">'));
check('future month 404', (await renderMonthlyPage('2027-01', env, NOW)).status === 404);
check('index lists months', renderMonthlyIndex && (await renderMonthlyIndex().text()).includes('href="/monthly/2026-07"'));

const idx = await buildNumbersSitemapIndexXml(env);
check('numbers sitemap index', idx.includes('<sitemapindex') && idx.includes('/sitemap-numbers-1.xml'));
const chunk = await buildNumbersSitemapXml(env, 1);
check('numbers sitemap has all valid numbers', ['0655084765', '0655059914', '021234567', '0812345678'].every((n) => chunk.includes(`/check/${n}<`)) && !chunk.includes('/check/abc'));
check('missing chunk -> 404', (await handleNumbersSitemapGet(env, '/sitemap-numbers-9.xml')).status === 404);
check('other path -> null', (await handleNumbersSitemapGet(env, '/sitemap-numbersx')) === null);
check('main sitemap lists /monthly', (await buildSitemapXml(env)).includes('<loc>https://spaminthai.com/monthly</loc>'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
