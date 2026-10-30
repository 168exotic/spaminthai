// Guards for /llms.txt (AI-readable site summary, llmstxt.org format).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const txt = readFileSync(new URL('../llms.txt', import.meta.url), 'utf8');
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

ok(txt.startsWith('# SpamInThai\n'), 'starts with H1 site name');
ok(/^> .+/m.test(txt), 'has blockquote summary');
ok(txt.includes('มีรายงานจากผู้ใช้'), 'tells AI to cite results as "reported by users"');

// No real phone numbers: any 9-10 digit run (with optional dashes/spaces) is forbidden.
const phoneLike = txt.replace(/id=com\.jarvis\.callblocker/g, '').match(/(?<!\d)0\d(?:[-\s]?\d){7,8}(?!\d)/g);
ok(!phoneLike, `no real phone numbers in llms.txt: ${phoneLike}`);

// Links: only our domain or the Google Play listing; never APK / legacy download page.
const links = [...txt.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]);
ok(links.length >= 10, 'has links');
for (const u of links) {
  ok(u.startsWith('https://spaminthai.com/') ||
     u === 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker', `allowed link: ${u}`);
  ok(!/\.apk|\/download(\/|$)/.test(u), `no APK/download link: ${u}`);
}

console.log(`test-llms-txt: ${n} checks passed`);
