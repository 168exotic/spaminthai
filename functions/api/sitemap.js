// GET /sitemap.xml — dynamic sitemap with top reported numbers from KV.

const SITE = 'https://spaminthai.com';
const CACHE_KEY = 'seo:sitemap:xml';
const CACHE_TTL_SEC = 8 * 60 * 60; // 8h (~3 refreshes/day)

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/check', priority: '0.95', changefreq: 'daily' },
  { loc: '/guide/check-phone', priority: '0.9', changefreq: 'weekly' },
  { loc: '/report', priority: '0.9', changefreq: 'weekly' },
  { loc: '/download', priority: '0.8', changefreq: 'weekly' },
  { loc: '/guide/call-center-scam', priority: '0.85', changefreq: 'monthly' },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
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

  const numbers = await getTopNumbers(env, 50);
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
