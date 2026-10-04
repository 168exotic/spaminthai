// Server-rendered SEO pages: /<province> (77 provinces) and /thailand (index).
// Each province page shows its landline area code, recently reported numbers
// with that prefix (from KV, cached), a check form, safety tips and app CTA.

import { assess } from '../api/risk-assess.js';
import { PROVINCES, REGIONS, ALIASES, sameCode } from './provinces.js';

const SITE = 'https://spaminthai.com';
const OG_IMAGE = SITE + '/assets/og-image.png';
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
const CACHE_TTL = 6 * 60 * 60; // KV cache per area code (keeps KV list ops low)

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmt(n) {
  const d = String(n).replace(/\D/g, '');
  if (d.startsWith('02') && d.length === 9) return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
  if (d.length === 9) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  if (d.length >= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return d;
}

/** Match a request path to a province page, alias redirect or the index. */
export function matchProvincePath(path) {
  const m = path.match(/^\/([a-z-]{2,30})\/?$/);
  if (!m) return null;
  const s = m[1];
  if (s === 'thailand') return { type: 'index' };
  if (PROVINCES.has(s)) return path.endsWith('/') ? { type: 'redirect', to: '/' + s } : { type: 'province', slug: s };
  if (ALIASES[s]) return { type: 'redirect', to: '/' + ALIASES[s] };
  return null;
}

/** Reported numbers whose landline prefix matches `code` (cached in KV). */
export async function reportedForCode(env, code) {
  const cacheKey = 'seo:area:' + code;
  try {
    const cached = await env.SPAM_KV.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    /* fall through */
  }
  const out = [];
  try {
    let cursor;
    const keys = [];
    do {
      const page = await env.SPAM_KV.list({ prefix: 'num:' + code, cursor, limit: 1000 });
      for (const k of page.keys) {
        const digits = k.name.slice(4);
        if (/^\d{9}$/.test(digits)) keys.push(k.name); // landlines are 9 digits
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && keys.length < 400);
    const vals = await Promise.all(
      keys.slice(0, 60).map(async (key) => {
        try {
          const raw = await env.SPAM_KV.get(key);
          return raw ? { number: key.slice(4), data: JSON.parse(raw) } : null;
        } catch {
          return null;
        }
      })
    );
    for (const v of vals) {
      if (!v) continue;
      const a = assess(v.data || {});
      out.push({
        number: v.number,
        reports: v.data.reports || 0,
        lastReport: v.data.lastReport || null,
        verdict: a.verdict,
        label: a.label,
      });
    }
    out.sort((x, y) => (y.reports - x.reports) || String(y.lastReport).localeCompare(String(x.lastReport)));
    const result = { total: keys.length, items: out.slice(0, 20) };
    try {
      await env.SPAM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    } catch {
      /* ignore */
    }
    return result;
  } catch {
    return { total: 0, items: [] };
  }
}

function header() {
  return `<header class="site-header">
  <div class="site-header__inner">
    <a href="/" class="site-brand">
      <picture class="site-brand__logo">
        <source srcset="/assets/logo-64.webp" type="image/webp">
        <img src="/assets/logo-64.png" alt="SpamInThai" width="40" height="40">
      </picture>
      <span class="site-brand__text">
        <span class="site-brand__title">SpamInThai</span>
        <span class="site-brand__tag">Block Scam Calls · SMS · URLs</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="หลัก">
      <a href="/check" class="site-nav__link site-nav__link--primary">เช็คเบอร์โทร</a>
      <a href="/thailand" class="site-nav__link">77 จังหวัด</a>
      <a href="/report" class="site-nav__link">แจ้งเบาะแส</a>
      <a class="site-nav__link site-nav__link--apk" href="${PLAY}" target="_blank" rel="noopener noreferrer">ดาวน์โหลดบน Google Play</a>
    </nav>
  </div>
  <div class="site-header__mobile">
    <a href="/check" class="site-tab">เช็คเบอร์โทร</a>
    <a href="/thailand" class="site-tab site-tab--active">77 จังหวัด</a>
    <a href="${PLAY}" target="_blank" rel="noopener noreferrer" class="site-tab site-tab--apk">ดาวน์โหลดบน Google Play</a>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <div>
      <p class="site-footer__title">SpamInThai — หยุดสแปมในไทยร่วมกัน</p>
      <p class="site-footer__desc">ฐานข้อมูลเบอร์ร้องเรียน คัดกรองภัยสังคมออนไลน์ ด้วยพลังประชาชน</p>
      <p class="site-footer__copy">© 2026 spaminthai</p>
    </div>
    <nav class="site-footer__links" aria-label="ลิงก์">
      <a href="/check">เช็คเบอร์โทร</a>
      <a href="/thailand">เช็คเบอร์ 77 จังหวัด</a>
      <a href="/report">แจ้งเบาะแส</a>
      <a href="${PLAY}" target="_blank" rel="noopener noreferrer">ดาวน์โหลดแอป</a>
      <a href="/blog">บทความ</a>
      <a href="/monthly">สรุปเบอร์มิจฉาชีพรายเดือน</a>
      <a href="/prefix">เช็คตามเลขขึ้นต้น</a>
      <a href="https://t.me/spaminthaich" target="_blank" rel="noopener noreferrer">Telegram เตือนภัย</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>
<script src="/assets/site.js" defer></script>`;
}

const STYLE = `<style>
.pv-wrap{max-width:760px;margin:0 auto;padding:0 20px}
.pv-hero{border-radius:18px;padding:24px;background:#fff;border:1.5px solid var(--color-line)}
.pv-hero h1{font-size:1.45rem;line-height:1.35;margin:0 0 8px}
.pv-hero .lead{color:var(--color-text-muted);margin:0}
.pv-code{display:inline-flex;align-items:center;gap:8px;margin:14px 0 4px;padding:8px 14px;border-radius:12px;background:var(--color-warn-bg);border:1px solid #fcd34d;font-weight:700}
.pv-code b{font-size:1.3rem;letter-spacing:.04em}
.pv-form{display:flex;gap:8px;margin-top:16px}
.pv-form input{flex:1;min-width:0;font:inherit;font-size:1.05rem;padding:12px 14px;border-radius:12px;border:1.5px solid var(--color-line)}
.pv-form button{font:inherit;font-weight:700;padding:12px 18px;border:0;border-radius:12px;background:var(--color-secondary);color:#fff;cursor:pointer;white-space:nowrap}
.pv-sec{margin-top:26px}
.pv-sec h2{font-size:1.15rem;margin:0 0 10px}
.pv-list{list-style:none;padding:0;margin:0;border:1px solid var(--color-line);border-radius:14px;overflow:hidden;background:#fff}
.pv-list li{display:flex;justify-content:space-between;gap:10px;padding:11px 14px;border-top:1px solid var(--color-line)}
.pv-list li:first-child{border-top:0}
.pv-list a{font-weight:700;text-decoration:none}
.pv-tag{font-size:.8rem;border-radius:99px;padding:2px 10px;white-space:nowrap;align-self:center}
.pv-tag.danger{background:var(--color-danger-bg);color:#b91c1c}
.pv-tag.caution{background:var(--color-warn-bg);color:#92400e}
.pv-tag.safe,.pv-tag.unknown{background:var(--color-safe-bg);color:#065f46}
.pv-empty{background:#fff;border:1px dashed var(--color-line);border-radius:14px;padding:14px;color:var(--color-text-muted)}
.pv-tips{padding-left:20px;margin:0}.pv-tips li{margin:6px 0}
.pv-app{margin-top:26px;padding:18px;border-radius:16px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.pv-app p{margin:0;max-width:440px}
.pv-app a{background:#fff;color:#0f172a;font-weight:700;padding:10px 16px;border-radius:12px;text-decoration:none;white-space:nowrap}
.pv-chips{display:flex;flex-wrap:wrap;gap:8px}
.pv-chips a{background:#fff;border:1px solid var(--color-line);border-radius:99px;padding:6px 12px;text-decoration:none;font-size:.92rem}
.pv-region h2{font-size:1.1rem;margin:26px 0 10px}
.pv-grid{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.pv-grid a{display:block;background:#fff;border:1px solid var(--color-line);border-radius:12px;padding:10px 12px;text-decoration:none;color:inherit;height:100%}
.pv-grid a:hover{border-color:var(--color-secondary)}
.pv-grid b{display:block}.pv-grid small{color:var(--color-text-muted)}
</style>`;

export function page({ title, desc, canonical, schema, body, robots = '' }) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">${robots ? `\n<meta name="robots" content="${esc(robots)}">` : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/favicon.png" type="image/png" sizes="64x64">
<link rel="stylesheet" href="/assets/theme.css">
<link rel="stylesheet" href="/assets/layout.css">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
${STYLE}
</head>
<body class="site-body">
${header()}
<main class="site-main site-main--narrow">
<div class="pv-wrap">
${body}
</div>
</main>
${footer()}
</body>
</html>`;
}

export function html(body, status = 200, maxAge = 1800) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

export async function renderProvincePage(slug, env) {
  const p = PROVINCES.get(slug);
  if (!p) return new Response('Not found', { status: 404 });
  const { total, items } = await reportedForCode(env, p.code);
  const shared = sameCode(p.code, slug);
  const canonical = `${SITE}/${slug}`;
  const title = `เช็คเบอร์มิจฉาชีพ ${p.th} — เบอร์ ${p.code} โทรมาจากไหน? | SpamInThai`;
  const desc = `เบอร์บ้านขึ้นต้น ${p.code} คือเบอร์จาก${p.th}${shared.length ? 'และจังหวัดใกล้เคียง' : ''} ตรวจเบอร์แปลกฟรี ดูเบอร์ ${p.code} ที่ถูกรายงานว่าเป็นมิจฉาชีพ/สแปม พร้อมวิธีป้องกันแก๊งคอลเซ็นเตอร์ใน${p.th}`;
  const sharedTxt = shared.length
    ? `รหัส ${p.code} ใช้ร่วมกับ ${shared.map((s) => s.th).join(', ')}`
    : `รหัส ${p.code} ใช้เฉพาะ${p.th}`;

  const list = items.length
    ? `<ul class="pv-list">${items
        .map(
          (it) =>
            `<li><span><a href="/check/${esc(it.number)}">${esc(fmt(it.number))}</a><br><small>${esc(it.label || '')} · รายงาน ${it.reports} ครั้ง</small></span><span class="pv-tag ${esc(it.verdict)}">${it.verdict === 'danger' ? 'อันตราย' : it.verdict === 'caution' ? 'น่าสงสัย' : 'มีรายงาน'}</span></li>`
        )
        .join('')}</ul>${total > items.length ? `<p class="number-seo">แสดง ${items.length} จาก ${total} เบอร์ที่มีรายงาน</p>` : ''}`
    : `<div class="pv-empty">ยังไม่มีเบอร์บ้าน ${esc(p.code)} ที่ถูกรายงานในระบบ ถ้าเจอเบอร์แปลกโทรมา <a href="/report">แจ้งเบาะแสที่นี่</a> เพื่อเตือนคนใน${esc(p.th)}</div>`;

  const neighbors = shared.length
    ? `<section class="pv-sec"><h2>จังหวัดที่ใช้รหัส ${esc(p.code)} เหมือนกัน</h2><div class="pv-chips">${shared
        .map((s) => `<a href="/${s.slug}">${esc(s.th)}</a>`)
        .join('')}</div></section>`
    : '';

  const body = `
<section class="pv-hero">
  <h1>เช็คเบอร์มิจฉาชีพ ${esc(p.th)} (${esc(p.en)})</h1>
  <p class="lead">เบอร์โทรแปลกโทรมา? ตรวจก่อนรับสายจากฐานข้อมูลเบอร์ที่คนไทยช่วยกันรายงาน ฟรี ไม่ต้องสมัคร</p>
  <div class="pv-code">☎️ เบอร์บ้าน${esc(p.th)} ขึ้นต้นด้วย <b>${esc(p.code)}</b></div>
  <p class="lead" style="font-size:.9rem">${esc(sharedTxt)}</p>
  <form class="pv-form" action="/check" method="get" role="search">
    <input type="tel" name="number" inputmode="tel" maxlength="16" placeholder="เช่น ${esc(p.code === '02' ? '021234567' : p.code + '123456')}" aria-label="เบอร์ที่ต้องการตรวจ" required>
    <button type="submit">ตรวจสอบ</button>
  </form>
</section>

<section class="pv-sec">
  <h2>เบอร์ ${esc(p.code)} ที่ถูกรายงานล่าสุด</h2>
  ${list}
</section>

<section class="pv-sec">
  <h2>รู้ไหม? เบอร์มือถือบอกจังหวัดไม่ได้</h2>
  <p>เบอร์บ้าน/สำนักงานจะมีรหัสพื้นที่บอกจังหวัด เช่น <b>${esc(p.code)}</b> ของ${esc(p.th)} แต่เบอร์มือถือ (06, 08, 09) ใช้ได้ทั่วประเทศ มิจฉาชีพจึงมักโทรจากเบอร์มือถือหรือเบอร์ที่แสดงผลปลอม แล้วอ้างว่าเป็นหน่วยงานใน${esc(p.th)} ควรตรวจเบอร์ทุกครั้งก่อนเชื่อ</p>
</section>

<section class="pv-sec">
  <h2>วิธีป้องกันแก๊งคอลเซ็นเตอร์ใน${esc(p.th)}</h2>
  <ul class="pv-tips">
    <li>ตำรวจ ธนาคาร หรือหน่วยงานรัฐ <b>ไม่ขอให้โอนเงินหรือบอกรหัส OTP ทางโทรศัพท์</b></li>
    <li>ถ้าอ้างว่ามีพัสดุผิดกฎหมายหรือบัญชีถูกอายัด ให้วางสาย แล้วโทรกลับหน่วยงานจากเบอร์ทางการเอง</li>
    <li>อย่ากดลิงก์ใน SMS ที่ไม่รู้จัก และอย่าติดตั้งแอปตามที่คนแปลกหน้าบอก</li>
    <li>ถูกหลอกโอนเงิน แจ้ง <b>สายด่วน 1441</b> (ศูนย์ AOC) เพื่ออายัดบัญชีให้เร็วที่สุด</li>
  </ul>
</section>

${neighbors}

<div class="pv-app">
  <p><b>บล็อกสายมิจฉาชีพอัตโนมัติ</b><br>แอป SpamInThai เตือนเบอร์อันตรายก่อนรับสาย ใช้ฟรีบน Android</p>
  <a href="${PLAY}" target="_blank" rel="noopener noreferrer">▶ ดาวน์โหลดบน Google Play</a>
</div>

<section class="pv-sec">
  <h2>เช็คเบอร์จังหวัดอื่น</h2>
  <p><a href="/thailand">ดูครบทั้ง 77 จังหวัด พร้อมรหัสพื้นที่ →</a></p>
</section>`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: title, description: desc, url: canonical, inLanguage: 'th-TH',
        about: { '@type': 'AdministrativeArea', name: p.th, alternateName: p.en, containedInPlace: { '@type': 'Country', name: 'Thailand' } },
        isPartOf: { '@type': 'WebSite', name: 'SpamInThai', url: SITE + '/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SpamInThai', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'เช็คเบอร์ 77 จังหวัด', item: SITE + '/thailand' },
        { '@type': 'ListItem', position: 3, name: p.th } ] },
    ],
  };
  return html(page({ title, desc, canonical, schema, body }));
}

export function renderThailandIndex() {
  const canonical = `${SITE}/thailand`;
  const title = 'เช็คเบอร์มิจฉาชีพ 77 จังหวัด รหัสเบอร์บ้านทุกจังหวัด | SpamInThai';
  const desc = 'รวมรหัสเบอร์บ้าน 77 จังหวัดทั่วไทย เบอร์ 02 053 076 ฯลฯ มาจากจังหวัดไหน พร้อมเช็คเบอร์มิจฉาชีพ/สแปมที่ถูกรายงานในแต่ละจังหวัด ฟรี';
  const regions = REGIONS.map(
    ([region, list]) =>
      `<section class="pv-region"><h2>${esc(region)}</h2><ul class="pv-grid">${list
        .map(([slug, en, th, code]) => `<li><a href="/${slug}"><b>${esc(th)}</b><small>${esc(en)} · ${esc(code)}</small></a></li>`)
        .join('')}</ul></section>`
  ).join('');
  const body = `
<section class="pv-hero">
  <h1>เช็คเบอร์มิจฉาชีพ 77 จังหวัด</h1>
  <p class="lead">เลือกจังหวัดเพื่อดูรหัสเบอร์บ้าน เบอร์ที่ถูกรายงานล่าสุด และวิธีป้องกันแก๊งคอลเซ็นเตอร์ในพื้นที่</p>
  <form class="pv-form" action="/check" method="get" role="search">
    <input type="tel" name="number" inputmode="tel" maxlength="16" placeholder="ใส่เบอร์ที่ต้องการตรวจ" aria-label="เบอร์ที่ต้องการตรวจ" required>
    <button type="submit">ตรวจสอบ</button>
  </form>
</section>
${regions}
<div class="pv-app">
  <p><b>บล็อกสายมิจฉาชีพอัตโนมัติ</b><br>แอป SpamInThai เตือนเบอร์อันตรายก่อนรับสาย ใช้ฟรีบน Android</p>
  <a href="${PLAY}" target="_blank" rel="noopener noreferrer">▶ ดาวน์โหลดบน Google Play</a>
</div>`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: canonical, inLanguage: 'th-TH',
    hasPart: [...PROVINCES.values()].map((p) => ({ '@type': 'WebPage', name: 'เช็คเบอร์มิจฉาชีพ ' + p.th, url: `${SITE}/${p.slug}` })),
  };
  return html(page({ title, desc, canonical, schema, body }), 200, 3600);
}
