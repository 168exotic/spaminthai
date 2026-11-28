// Guards for /llms-full.txt (full-text AI reference; short index is /llms.txt).
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const txt = readFileSync(new URL('../llms-full.txt', import.meta.url), 'utf8');
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

ok(txt.startsWith('# SpamInThai'), 'starts with H1 site name');
ok(/^> .+/m.test(txt), 'has blockquote summary');
ok(txt.includes('มีรายงานจากผู้ใช้'), 'tells AI to cite results as "reported by users"');
ok(txt.includes('https://spaminthai.com/llms.txt'), 'points back to the short index');

// No real phone numbers (9-10 digit runs, optional dashes/spaces).
const phoneLike = txt.replace(/id=com\.jarvis\.callblocker/g, '').match(/(?<!\d)0\d(?:[-\s]?\d){7,8}(?!\d)/g);
ok(!phoneLike, `no real phone numbers: ${phoneLike}`);

// Links: only our domain or the Google Play listing; never APK / legacy download page.
const links = [...txt.matchAll(/https?:\/\/[^\s)`>]+/g)].map(m => m[0]);
ok(links.length >= 10, 'has links');
for (const u of links) {
  ok(u.startsWith('https://spaminthai.com/') ||
     u === 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker', `allowed link: ${u}`);
  ok(!/\.apk|\/download(\/|$)/.test(u), `no APK/download link: ${u}`);
}

// Every "ที่มา" source page must exist in the repo (static page or known route).
const routes = new Set(['check', 'monthly', 'prefix', 'thailand', 'news-1', 'blog/', 'llms.txt']);
for (const u of links.filter(l => l.startsWith('https://spaminthai.com/'))) {
  const p = u.replace('https://spaminthai.com/', '');
  if (routes.has(p) || p.startsWith('check/')) continue;
  const file = new URL(`../${p}.html`, import.meta.url);
  ok(existsSync(file), `source page exists in repo: ${p}.html`);
}

// Never accuse: no definitive wording about number owners.
ok(!/เจ้าของเบอร์(นี้)?เป็นมิจฉาชีพ(?!\s*และ)/.test(txt.replace('ไม่ใช่การยืนยันว่าเจ้าของเบอร์เป็นมิจฉาชีพ', '')), 'no accusation of owners');

console.log(`test-llms-full: ${n} checks passed`);
