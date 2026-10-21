#!/usr/bin/env node
/**
 * Site policy test (AGENTS.md): mirrors the deploy.yml guards locally so a bad edit fails
 * `npm test` before it reaches main.
 *  - no <a> points at the legacy APK / /download page / GitHub Releases APK
 *  - every Google Play link opens in a new tab with rel="noopener noreferrer"
 *  - AdSense meta + adsbygoogle.js on index, check, news-1..9 and news/*.html
 *  - ads.txt and _headers CSP keep AdSense; app-download.js URLs stay on Google Play
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
const PUB = 'ca-pub-2455374115304550';
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const rel = (p) => path.relative(ROOT, p);

// Same exclusions as deploy.yml's link guard (vps/ is a separate site).
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'vps']);
function walk(dir, test, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), test, out);
    } else if (test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

const files = walk(ROOT, (n) => n.endsWith('.html') || n === 'render-number-page.js');
const LEGACY = /<a\b[^>]*href=["'](?:https?:\/\/(?:www\.)?spaminthai\.com)?\/download(?:\/spaminthai-latest\.apk)?(?:[?#"'])/i;
const GH_APK = /<a\b[^>]*href=["']https:\/\/github\.com\/[^"']*\/releases\/[^"']*\.apk/i;

console.log('== download links ==');
const legacyHits = files.filter((f) => LEGACY.test(fs.readFileSync(f, 'utf8'))).map(rel);
check(`no <a> to /download or APK (${files.length} files)`, legacyHits.length === 0, legacyHits.join(', '));
const ghHits = files.filter((f) => GH_APK.test(fs.readFileSync(f, 'utf8'))).map(rel);
check('no <a> to GitHub Releases APK', ghHits.length === 0, ghHits.join(', '));

const badPlay = [];
let playCount = 0;
for (const f of files) {
  for (const tag of fs.readFileSync(f, 'utf8').match(/<a\b[^>]*play\.google\.com\/store\/apps\/details\?id=com\.jarvis\.callblocker[^>]*>/gi) || []) {
    playCount++;
    if (!/target=["']_blank["']/.test(tag) || !/rel=["'][^"']*noopener[^"']*noreferrer|rel=["'][^"']*noreferrer[^"']*noopener/.test(tag)) badPlay.push(rel(f));
  }
}
check('homepage has a Google Play link', read('index.html').includes(PLAY));
check(`Google Play links use target=_blank + rel=noopener noreferrer (${playCount} links)`, badPlay.length === 0, [...new Set(badPlay)].join(', '));

console.log('== AdSense ==');
const newsDir = path.join(ROOT, 'news');
const adPages = ['index.html', 'check.html', ...Array.from({ length: 9 }, (_, i) => `news-${i + 1}.html`),
  ...fs.readdirSync(newsDir).filter((n) => n.endsWith('.html')).map((n) => `news/${n}`)];
const missing = [];
for (const p of adPages) {
  const html = read(p);
  // news/index.html is a meta-refresh stub to /news-1, not a content page.
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html) && html.length < 2000) continue;
  const head = html.split(/<\/head>/i)[0];
  const meta = head.includes(`<meta name="google-adsense-account" content="${PUB}">`);
  const script = head.includes(`pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB}`);
  if (!meta || !script) missing.push(`${p}${meta ? '' : ' [meta]'}${script ? '' : ' [script]'}`);
}
check(`AdSense meta + script before </head> (${adPages.length} pages)`, missing.length === 0, missing.join(', '));
check('ads.txt has publisher line', /google\.com,\s*pub-2455374115304550,\s*DIRECT/.test(read('ads.txt')));
check('_headers CSP allows pagead2.googlesyndication.com', read('_headers').includes('pagead2.googlesyndication.com'));

console.log('== app download API ==');
const app = await import('../functions/api/app-download.js');
check('PLAY_STORE_URL is Google Play', app.PLAY_STORE_URL === PLAY);
check('ANDROID_INSTALL_URL is Google Play', app.ANDROID_INSTALL_URL === PLAY);
check('ANDROID_INSTALL_GITHUB_URL is Google Play', app.ANDROID_INSTALL_GITHUB_URL === PLAY);
check('PLAY_PROTECT_FALLBACK.url is Google Play', app.PLAY_PROTECT_FALLBACK.url === PLAY);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
