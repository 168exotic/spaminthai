#!/usr/bin/env node
/**
 * SEO maintenance: verify sitemap + ping search engines.
 * Runs 3×/day via .github/workflows/seo-triple-daily.yml
 *
 * Usage: node scripts/seo-ping.mjs [baseUrl]
 */

const BASE = (process.argv[2] || process.env.SITE_URL || 'https://spaminthai.com').replace(/\/$/, '');
const SITEMAP = `${BASE}/sitemap.xml`;

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '7f3a9e2b1c4d8e6f0a5b3c9d1e7f4a2';
const INDEXNOW_HOST = new URL(BASE).hostname;

const PING_TARGETS = [
  { name: 'Bing', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}` },
  { name: 'Google', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}` },
];

async function indexNow(urls) {
  if (!INDEXNOW_KEY || urls.length === 0) return;
  const body = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 100),
  };
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    console.log(`IndexNow: HTTP ${r.status} (${urls.length} URLs)`);
  } catch (err) {
    console.warn(`IndexNow failed: ${err.message}`);
  }
}

function fmtPhone(n) {
  const d = String(n).replace(/\D/g, '');
  if (d.length >= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length >= 9) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

async function main() {
  console.log(`SEO ping — ${new Date().toISOString()}`);
  console.log(`Sitemap: ${SITEMAP}`);

  const smRes = await fetch(SITEMAP, { headers: { 'User-Agent': 'SpamInThai-SEO-Bot/1.0' } });
  const smText = await smRes.text();
  if (!smRes.ok) {
    console.error(`FAIL: sitemap HTTP ${smRes.status}`);
    process.exit(1);
  }
  const urlCount = (smText.match(/<loc>/g) || []).length;
  const hasCheckUrls = smText.includes('/check/');
  const today = new Date().toISOString().slice(0, 10);
  const hasToday = smText.includes(`<lastmod>${today}</lastmod>`);
  console.log(`OK: sitemap ${urlCount} URLs, check pages=${hasCheckUrls}, lastmod today=${hasToday}`);

  if (urlCount < 5) {
    console.error('FAIL: sitemap too small');
    process.exit(1);
  }

  const samples = [...smText.matchAll(/<loc>https?:\/\/[^<]+\/check\/(\d{9,10})<\/loc>/g)]
    .slice(0, 3)
    .map((m) => fmtPhone(m[1]));
  if (samples.length) console.log(`Sample check URLs: ${samples.join(', ')}`);

  for (const { name, url } of PING_TARGETS) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      console.log(`${name} ping: HTTP ${r.status}`);
    } catch (err) {
      console.warn(`${name} ping failed: ${err.message}`);
    }
  }

  const pages = [
    '/',
    '/check',
    '/download',
    '/guide/check-phone',
    '/guide/call-center-scam',
    '/guide/block-spam-android',
    '/guide/spam-numbers',
  ];
  for (const p of pages) {
    const r = await fetch(`${BASE}${p}`, { method: 'HEAD' });
    console.log(`HEAD ${p}: ${r.status}`);
  }

  const indexUrls = pages.map((p) => `${BASE}${p}`);
  const checkUrls = [...smText.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u.includes('/check/'))
    .slice(0, 20);
  await indexNow([...indexUrls, ...checkUrls]);

  console.log('SEO ping complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
