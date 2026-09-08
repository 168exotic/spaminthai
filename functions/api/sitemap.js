// GET /sitemap.xml — dynamic sitemap with top reported numbers from KV.

const SITE = 'https://spaminthai.com';
const CACHE_KEY = 'seo:sitemap:xml';
const CACHE_TTL_SEC = 60 * 60; // 1h (per spec) — sitemap refreshes hourly

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/check', priority: '0.95', changefreq: 'daily' },
  { loc: '/guide/check-phone', priority: '0.9', changefreq: 'weekly' },
  { loc: '/guide/block-spam-android', priority: '0.88', changefreq: 'weekly' },
  { loc: '/guide/spam-numbers', priority: '0.87', changefreq: 'daily' },
  { loc: '/report', priority: '0.9', changefreq: 'weekly' },
  { loc: '/download', priority: '0.8', changefreq: 'weekly' },
  { loc: '/guide/call-center-scam', priority: '0.85', changefreq: 'monthly' },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
  { loc: '/blog', priority: '0.7', changefreq: 'weekly' },
  { loc: '/news', priority: '0.8', changefreq: 'daily' },
];

const BLOG_SLUGS = [
  'call-center-scam-guide-2568',
  'numbers-065-scam',
  'fake-bank-sms',
  'report-hotlines-1441-1155-1212',
  'scammed-what-to-do',
  'voip-697-698-scam',
  'best-spam-checker-apps-2568',
  'pdpa-reporting-numbers',
  'silent-unknown-callers-android-iphone',
  'new-scam-tricks-2568-07',
  'berkhrai-check-caller',
  'truat-ber-free',
];

const NEWS_SLUGS = [
  'acsc-august-weekly-2569',
  'acsc-elderly-protection-2569',
  'acsc-july-summer-spike-2569',
  'acsc-june-monthly-2569',
  'acsc-may-monthly-2569',
  'acsc-rescue-students-2-7m-2569',
  'acsc-stats-aug-sep-2569',
  'acsc-stats-february-2569',
  'acsc-stats-january-2569',
  'acsc-weekly-492m-march-2569',
  'acsc-weekly-april-2569',
  'aoc-1441-scam-report-guide-2025',
  'call-center-account-mule-2569',
  'call-center-bangkok-raid-2569',
  'call-center-bust-9-suspects-2569',
  'call-center-chiang-rai-network-2569',
  'call-center-khon-kaen-bust-2569',
  'cib-money-laundering-ring-2569',
  'cib-romance-scam-2569',
  'cib-sim-box-raid-2569',
  'deepfake-politician-impersonation-2569',
  'deepfake-scam-warning-2025',
  'deepfake-video-call-scam-2569',
  'fake-concert-ticket-bts-2569',
  'fake-concert-ticket-kpop-2569',
  'hotline-1441-report-guide-2569',
  'hotline-1441-success-stories-2569',
  'investment-scam-crypto-app-2569',
  'investment-scam-forex-2569',
  'investment-scam-gold-trading-2569',
  'investment-scam-line-group-2025',
  'job-scam-line-recruitment-2569',
  'job-scam-package-delivery-2569',
  'job-scam-remote-work-2569',
  'korean-scam-center-samut-prakan-2025-09',
  'mgronline-online-shopping-scam-2569',
  'money-laundering-crypto-exchange-2569',
  'money-laundering-sim-box-2569',
  'parcel-redelivery-scam-2569',
  'poipet-border-rescue-2569',
  'poipet-scam-compound-2569',
  'poipet-thai-workers-trapped-2569',
  'romance-scam-dating-app-2569',
  'sim-box-mae-sot-raid-2569',
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(loc, { priority, changefreq, lastmod }) {
  const full = loc.startsWith('http') ? loc : SITE + loc;
  return `  <url>
    <loc>${escXml(full)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function getTopNumbers(env, limit = 50) {
  const cached = await env.SPAM_KV.get('seo:top-numbers');
  if (cached) {
    try {
      const list = JSON.parse(cached);
      if (Array.isArray(list) && list.length) {
        return list.slice(0, limit).map((x) => String(x.number || x).replace(/\D/g, '')).filter(Boolean);
      }
    } catch { /* fall through */ }
  }

  const scored = [];
  let cursor;
  do {
    const page = await env.SPAM_KV.list({ prefix: 'num:', cursor, limit: 500 });
    const values = await Promise.all(
      page.keys.map(async (k) => {
        const number = k.name.slice(4);
        const raw = await env.SPAM_KV.get(k.name);
        if (!raw) return null;
        try {
          const data = JSON.parse(raw);
          return { number, reports: data.reports || 0 };
        } catch {
          return null;
        }
      })
    );
    for (const v of values) {
      if (v) scored.push(v);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && scored.length < 500);

  scored.sort((a, b) => b.reports - a.reports);
  return scored.slice(0, limit).map((x) => x.number);
}

export async function buildSitemapXml(env) {
  const lastmod = today();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const page of STATIC_PAGES) {
    lines.push(urlEntry(page.loc, { ...page, lastmod }));
  }

  for (const slug of BLOG_SLUGS) {
    lines.push(urlEntry(`/blog/${slug}`, { priority: '0.75', changefreq: 'monthly', lastmod }));
  }

  for (const slug of NEWS_SLUGS) {
    lines.push(urlEntry(`/news/${slug}`, { priority: '0.78', changefreq: 'weekly', lastmod }));
  }

  const numbers = await getTopNumbers(env, 200);
  for (const num of numbers) {
    if (num.length < 9 || num.length > 10) continue;
    lines.push(urlEntry(`/check/${num}`, {
      priority: '0.7',
      changefreq: 'weekly',
      lastmod,
    }));
  }

  lines.push('</urlset>');
  return lines.join('\n');
}

export async function handleSitemapGet(env) {
  const cached = await env.SPAM_KV.get(CACHE_KEY);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TTL_SEC}`,
      },
    });
  }

  const xml = await buildSitemapXml(env);
  await env.SPAM_KV.put(CACHE_KEY, xml, { expirationTtl: CACHE_TTL_SEC });

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SEC}`,
    },
  });
}

/** Bust sitemap cache (called after report or by cron ping). */
export async function invalidateSitemapCache(env) {
  await env.SPAM_KV.delete(CACHE_KEY);
}
