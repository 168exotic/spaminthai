// Server-rendered SEO page for /check/:number (long-tail Thai search traffic).

import { assess } from '../api/risk-assess.js';
import { identifyCarrier, isValidThaiPhone } from '../api/carrier.js';

const OG_IMAGE = 'https://spaminthai.com/assets/og-image.png';

function fmt(n) {
  const d = String(n).replace(/\D/g, '');
  if (d.length >= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  if (d.length >= 9) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return d;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderNumberPage(number, env) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!isValidThaiPhone(digits)) {
    return new Response('Not found', { status: 404 });
  }

  const raw = await env.SPAM_KV.get('num:' + digits);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };
  const result = { number: digits, ...data, ...assess(data), ...identifyCarrier(digits) };

  const display = fmt(digits);
  const title = `เบอร์ ${display} ใครโทรมา? เบอร์อะไร? เช็คเบอร์ ตรวจเบอร์ | SpamInThai`;
  const desc = `${result.label} — ${result.advice} เช็คเบอร์ ตรวจเบอร์ ${display} ฟรี เบอร์ใคร เบอร์อะไร จากฐานข้อมูลรายงานของคนไทย`;
  const canonical = `https://spaminthai.com/check/${digits}`;
  const verdictClass =
    result.verdict === 'danger' ? 'danger' : result.verdict === 'caution' ? 'warn' : 'safe';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: desc,
    url: canonical,
    inLanguage: 'th-TH',
    isPartOf: { '@type': 'WebSite', name: 'SpamInThai', url: 'https://spaminthai.com/' }
  };

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/favicon.png" type="image/png" sizes="64x64">
<link rel="stylesheet" href="/assets/theme.css">
<link rel="stylesheet" href="/assets/layout.css">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
.number-wrap{max-width:640px;margin:0 auto;padding:0 20px}
.verdict-card{border-radius:16px;padding:24px;border:1.5px solid var(--color-line);background:#fff}
.verdict-card.danger{background:var(--color-danger-bg);border-color:#fca5a5}
.verdict-card.warn{background:var(--color-warn-bg);border-color:#fcd34d}
.verdict-card.safe{background:var(--color-safe-bg);border-color:#6ee7b7}
.verdict-card h1{font-size:1.4rem;margin-bottom:8px}
.verdict-card .meta{color:var(--color-text-muted);font-size:.95rem;margin-top:8px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.stat{background:#fff;border:1px solid var(--color-line);border-radius:10px;padding:10px 14px;min-width:110px}
.stat b{display:block;font-size:1.1rem}
.stat small{color:var(--color-text-muted);font-size:.75rem}
.number-cta{display:inline-block;margin-top:20px;background:var(--color-secondary);color:#fff;padding:12px 20px;border-radius:99px;font-weight:600;text-decoration:none}
.number-cta:hover{background:var(--color-secondary-hover);color:#fff;text-decoration:none}
.number-seo{margin-top:20px;color:var(--color-text-muted);font-size:.9rem}
</style>
</head>
<body class="site-body">
<header class="site-header">
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
      <a href="/report" class="site-nav__link">แจ้งเบาะแส</a>
      <a href="/download" class="site-nav__link">ดาวน์โหลดแอป</a>
      <a class="site-nav__link site-nav__link--apk" href="/download/spaminthai-latest.apk" download>ดาวน์โหลด APK</a>
    </nav>
  </div>
  <div class="site-header__mobile">
    <a href="/check" class="site-tab site-tab--active">เช็คเบอร์โทร</a>
    <a href="/report" class="site-tab">แจ้งเบาะแส</a>
    <a href="/download" class="site-tab site-tab--apk" href="/download/spaminthai-latest.apk" download>ดาวน์โหลด APK</a>
  </div>
</header>
<main class="site-main site-main--narrow">
<div class="number-wrap">
  <article class="verdict-card ${verdictClass}">
    <h1>เบอร์ ${esc(display)} — ${esc(result.label)}</h1>
    <p class="meta">${esc(result.advice)}</p>
    <div class="stats">
      ${result.carrierLabel ? `<div class="stat"><b>${esc(result.carrierLabel)}</b><small>เครือข่าย</small></div>` : ''}
      ${result.reports > 0 ? `<div class="stat"><b>${result.score}/100</b><small>คะแนนความเสี่ยง</small></div>` : ''}
      <div class="stat"><b>${result.reports}</b><small>รายงานทั้งหมด</small></div>
    </div>
    <a class="number-cta" href="/check?number=${esc(digits)}">เช็คเบอร์นี้แบบละเอียด →</a>
    <div class="share-bar" style="margin-top:16px;padding-top:14px;border-top:1px dashed rgba(0,0,0,.08)">
      <p style="font-size:.78rem;color:#64748b;margin:0 0 8px;font-weight:600">แชร์เตือนคนอื่น</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <a class="share-line" style="background:#06C755;color:#fff;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;text-decoration:none" href="https://line.me/R/msg/text/?${encodeURIComponent(`⚠️ เบอร์ ${display} — ${result.label}\nเช็คเบอร์มิจฉาชีพฟรี 👇\n${canonical}?utm_source=line&utm_medium=share&utm_campaign=number_page`)}">LINE</a>
        <a style="background:#1877F2;color:#fff;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;text-decoration:none" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical + '?utm_source=facebook&utm_medium=share&utm_campaign=number_page')}" target="_blank" rel="noopener">Facebook</a>
        <a style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;text-decoration:none" href="/download?utm_source=number_page&utm_medium=cta">ดาวน์โหลดแอป</a>
      </div>
    </div>
  </article>
  <p class="number-seo">ค้นหา <strong>เบอร์ ${esc(display)}</strong> บ่อย — ใช้ SpamInThai <strong>เช็คเบอร์ ตรวจเบอร์</strong> ฟรี <strong>เบอร์ใคร</strong>โทรมา <strong>เบอร์อะไร</strong>น่าสงสัย ก่อนรับสายหรือโอนเงิน</p>
</div>
</main>
<footer class="site-footer">
  <div class="site-footer__inner">
    <div>
      <p class="site-footer__title">SpamInThai — หยุดสแปมในไทยร่วมกัน</p>
      <p class="site-footer__desc">ฐานข้อมูลเบอร์ร้องเรียน คัดกรองภัยสังคมออนไลน์ ด้วยพลังประชาชน</p>
      <p class="site-footer__copy">© 2026 spaminthai</p>
    </div>
    <nav class="site-footer__links" aria-label="ลิงก์">
      <a href="/check">เช็คเบอร์โทร</a>
      <a href="/report">แจ้งเบาะแส</a>
      <a href="/download">ดาวน์โหลดแอป</a>
      <a href="/blog">บทความ</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
