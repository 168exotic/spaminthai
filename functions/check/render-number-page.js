// Server-rendered SEO page for /check/:number (long-tail Thai search traffic).

import { assess } from '../api/risk-assess.js';
import { identifyCarrier } from '../api/carrier.js';

const OG_IMAGE = 'https://spaminthai.com/assets/og-image.svg';

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
  if (digits.length < 9 || digits.length > 10) {
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
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
:root{--indigo:#4F46E5;--ink:#1E1B4B;--muted:#6B7280;--bg:#F8F9FF;--line:#E5E7F5;--danger:#DC2626;--danger-bg:#FEF2F2;--warn:#D97706;--warn-bg:#FFFBEB;--safe:#059669;--safe-bg:#ECFDF5}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,'IBM Plex Sans Thai',sans-serif;background:var(--bg);color:var(--ink);line-height:1.65}
a{color:var(--indigo);text-decoration:none}
.wrap{max-width:640px;margin:0 auto;padding:24px 20px}
header{padding:16px 0;border-bottom:1px solid var(--line);margin-bottom:24px}
.logo{font-weight:700;font-size:1.1rem;color:var(--ink)}
.logo span{color:var(--indigo)}
.card{border-radius:16px;padding:24px;border:1.5px solid var(--line);background:#fff}
.card.danger{background:var(--danger-bg);border-color:#FCA5A5}
.card.warn{background:var(--warn-bg);border-color:#FCD34D}
.card.safe{background:var(--safe-bg);border-color:#6EE7B7}
h1{font-size:1.4rem;margin-bottom:8px}
.meta{color:var(--muted);font-size:.95rem;margin-top:8px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.stat{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:110px}
.stat b{display:block;font-size:1.1rem}
.stat small{color:var(--muted);font-size:.75rem}
.cta{display:inline-block;margin-top:20px;background:var(--indigo);color:#fff;padding:12px 20px;border-radius:99px;font-weight:600}
footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:.85rem;color:var(--muted)}
footer a{margin-right:12px}
</style>
</head>
<body>
<div class="wrap">
  <header><a class="logo" href="/">Spam<span>InThai</span></a></header>
  <main class="card ${verdictClass}">
    <h1>เบอร์ ${esc(display)} — ${esc(result.label)}</h1>
    <p class="meta">${esc(result.advice)}</p>
    <div class="stats">
      ${result.carrierLabel ? `<div class="stat"><b>${esc(result.carrierLabel)}</b><small>เครือข่าย</small></div>` : ''}
      ${result.reports > 0 ? `<div class="stat"><b>${result.score}/100</b><small>คะแนนความเสี่ยง</small></div>` : ''}
      <div class="stat"><b>${result.reports}</b><small>รายงานทั้งหมด</small></div>
    </div>
    <a class="cta" href="/check?number=${esc(digits)}">เช็คเบอร์นี้แบบละเอียด →</a>
  </main>
  <p style="margin-top:20px;color:var(--muted);font-size:.9rem">ค้นหา <strong>เบอร์ ${esc(display)}</strong> บ่อย — ใช้ SpamInThai <strong>เช็คเบอร์ ตรวจเบอร์</strong> ฟรี <strong>เบอร์ใคร</strong>โทรมา <strong>เบอร์อะไร</strong>น่าสงสัย ก่อนรับสายหรือโอนเงิน</p>
  <footer>
    <a href="/check">เช็คเบอร์โทร</a>
    <a href="/download">ดาวน์โหลดแอป</a>
    <a href="/guide/call-center-scam">วิธีรับมือแก๊งคอลเซ็นเตอร์</a>
    <a href="/privacy">ความเป็นส่วนตัว</a>
  </footer>
</div>
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
