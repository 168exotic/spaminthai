#!/usr/bin/env node
/** Tests for /check/:number SEO page (no real KV). */
import { renderNumberPage, provincesForNumber, categoryBreakdown, buildFaq } from '../functions/check/render-number-page.js';

const store = new Map([
  ['num:0812345678', JSON.stringify({ reports: 6, categories: { scam: 4, callcenter: 2 }, lastReport: new Date().toISOString() })],
  ['num:076123456', JSON.stringify({ reports: 1, categories: { ads: 1 }, lastReport: '2026-01-01T00:00:00Z' })],
]);
const env = { SPAM_KV: { async get(k) { return store.get(k) ?? null; } } };
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';

check('mobile has no province', provincesForNumber('0812345678').length === 0);
check('076 -> Phuket', provincesForNumber('076123456').some((p) => p.slug === 'phuket'));
check('02 -> Bangkok', provincesForNumber('021234567').some((p) => p.slug === 'bangkok'));
const b = categoryBreakdown({ scam: 4, callcenter: 2, safe: 0 }, 6);
check('breakdown sorted + pct', b.length === 2 && b[0].cat === 'scam' && b[0].pct === 67, JSON.stringify(b));
check('faq has 4 items', buildFaq('081-234-5678', { reports: 0, networkType: 'mobile', carrierLabel: 'AIS' }, []).length === 4);

const res = await renderNumberPage('0812345678', env);
const html = await res.text();
check('danger page 200', res.status === 200);
check('title shows verdict + count', /<title>เบอร์ 081-234-5678 เบอร์อันตราย \(6 รายงาน\)/.test(html));
check('FAQPage schema', html.includes('"@type":"FAQPage"'));
check('BreadcrumbList schema', html.includes('"@type":"BreadcrumbList"'));
check('category breakdown', html.includes('ประเภทที่ถูกรายงาน') && html.includes('แก๊งคอลเซ็นเตอร์'));
check('app CTA to Google Play', html.includes('class="num-app"') && html.includes(PLAY));
check('report link prefilled', html.includes('/report?number=0812345678'));
check('dispute link prefilled', html.includes('/dispute?num=0812345678'));
check('Telegram channel link', html.includes('https://t.me/spaminthaich'));
check('danger share card', html.includes('content="https://spaminthai.com/assets/og/number-danger.png"') && html.includes('summary_large_image'));
check('no APK links', !/\.apk|href="\/download/.test(html));
const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check('JSON-LD valid + no raw <', !!ld && !ld[1].includes('<') && Array.isArray(JSON.parse(ld[1])));

const land = await (await renderNumberPage('076123456', env)).text();
check('landline formatted', land.includes('076-123-456'));
check('landline links province page', land.includes('href="/phuket"'));
const bkk = await (await renderNumberPage('021234567', env)).text();
check('Bangkok landline format 02-123-4567', bkk.includes('02-123-4567'));
check('unknown share card', bkk.includes('/assets/og/number-unknown.png'));
check('unknown number title', bkk.includes('ใครโทรมา?') && !bkk.includes('ประเภทที่ถูกรายงาน'));
check('invalid -> 404', (await renderNumberPage('12345', env)).status === 404);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
