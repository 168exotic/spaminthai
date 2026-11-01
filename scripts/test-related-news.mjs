#!/usr/bin/env node
/** Tests for news index + related-news internal links (province/number pages). */
import fs from 'node:fs';
import { NEWS } from '../functions/news/news-index.js';
import { relatedNews, thaiShortDate } from '../functions/news/related-news.js';
import { PROVINCES } from '../functions/province/provinces.js';
import { renderProvincePage } from '../functions/province/render-province-page.js';
import { renderNumberPage } from '../functions/check/render-number-page.js';

let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };

const files = new Set(fs.readdirSync('news').filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => f.replace(/\.html$/, '')));
check('index not empty', NEWS.length > 0);
check('every indexed article exists in news/', NEWS.every((n) => files.has(n.slug)), NEWS.filter((n) => !files.has(n.slug)).map((n) => n.slug).join(','));
check('every province tag is a real slug', NEWS.every((n) => n.provinces.every((s) => PROVINCES.has(s))));
check('sorted newest first', NEWS.every((n, i) => i === 0 || NEWS[i - 1].date >= n.date));
check('titles have no site suffix', NEWS.every((n) => !/SpamInThai\s*$/.test(n.title)));
const missing = [...files].filter((f) => !NEWS.some((n) => n.slug === f));
if (missing.length) console.warn(`  warn - ${missing.length} news file(s) not in index (noindex or new): run node scripts/build-news-index.mjs — ${missing.join(', ')}`);

const fake = [
  { slug: 'a', title: 'A', date: '2026-10-03', provinces: [] },
  { slug: 'b', title: 'B', date: '2026-10-02', provinces: ['phuket'] },
  { slug: 'c', title: 'C', date: '2026-10-01', provinces: [] },
];
const r = relatedNews(['phuket'], 2, fake);
check('local news first', r[0].href === '/news/b' && r[0].local === true, JSON.stringify(r));
check('fills with newest, no dupes', r.length === 2 && r[1].href === '/news/a');
check('no province -> newest', relatedNews([], 1, fake)[0].href === '/news/a');
check('thai date', thaiShortDate('2026-10-28') === '28 ต.ค. 2569', thaiShortDate('2026-10-28'));
check('bad date -> empty', thaiShortDate('x') === '');

const env = { SPAM_KV: { async get() { return null; }, async put() {}, async list() { return { keys: [], list_complete: true }; } } };
const ph = await (await renderProvincePage('chonburi', env)).text();
check('province page has news section', ph.includes('ข่าวเตือนภัยที่เกี่ยวข้อง') && ph.includes('href="/news/'));
check('province page labels local news', ph.includes('ข่าวในชลบุรี'));
check('province page has relatedLink schema', ph.includes('"relatedLink"'));
check('province placeholder has no real-looking number', !/placeholder="เช่น \d{6,}/.test(ph));
const nh = await (await renderNumberPage('0812345678', env)).text();
check('number page has latest news', nh.includes('ข่าวเตือนภัยล่าสุด') && nh.includes('href="/news/'));
check('AdSense untouched on number page', !/ca-pub-/.test(nh) || nh.includes('ca-pub-2455374115304550'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
