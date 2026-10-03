// Server-rendered SEO page for /check/:number (long-tail Thai search traffic).

import { assess } from '../api/risk-assess.js';
import { identifyCarrier, isValidThaiPhone } from '../api/carrier.js';
import { PROVINCES } from '../province/provinces.js';

const SITE = 'https://spaminthai.com';
const OG_IMAGE = SITE + '/assets/og-image.png';
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';

const CATEGORY_LABELS = {
  scam: 'มิจฉาชีพ/หลอกโอนเงิน',
  callcenter: 'แก๊งคอลเซ็นเตอร์',
  loan: 'เงินกู้',
  ads: 'โฆษณา/ขายของ',
  safe: 'เบอร์ปกติ'
};

function fmt(n) {
  const d = String(n).replace(/\D/g, '');
  if (d.startsWith('02') && d.length === 9) return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
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

/** Provinces that use this landline's area code (empty for mobiles). */
export function provincesForNumber(digits) {
  if (!/^0\d{8}$/.test(digits) || !/^0[2-57]/.test(digits)) return [];
  const code = digits.startsWith('02') ? '02' : digits.slice(0, 3);
  return [...PROVINCES.values()].filter((p) => p.code === code);
}

/** Thai date (e.g. "3 ต.ค. 2569") or null. */
function thaiDate(value) {
  const ts = typeof value === 'string' ? Date.parse(value) : Number(value);
  if (!value || !Number.isFinite(ts)) return null;
  try {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
  } catch {
    return null;
  }
}

/** Per-category report counts, largest first. */
export function categoryBreakdown(categories, reports) {
  const total = Math.max(Number(reports) || 0, 1);
  return Object.entries(categories || {})
    .map(([cat, count]) => ({ cat, label: CATEGORY_LABELS[cat] || 'อื่น ๆ', count: Number(count) || 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((x) => ({ ...x, pct: Math.min(100, Math.round((x.count / total) * 100)) }));
}

/** Question/answer pairs shown on the page and emitted as FAQPage schema. */
export function buildFaq(display, result, provinces) {
  const faq = [];
  if (result.reports > 0) {
    const top = result.topCategory ? ` ส่วนใหญ่ถูกรายงานว่าเป็น "${CATEGORY_LABELS[result.topCategory] || result.topCategory}"` : '';
    faq.push({
      q: `เบอร์ ${display} เป็นมิจฉาชีพไหม?`,
      a: `เบอร์ ${display} มีรายงานจากผู้ใช้ ${result.reports} ครั้ง${top} ระบบประเมินว่า "${result.label}" (คะแนนความเสี่ยง ${result.score}/100) — ${result.advice}`
    });
  } else {
    faq.push({
      q: `เบอร์ ${display} เป็นมิจฉาชีพไหม?`,
      a: `ยังไม่มีผู้ใช้รายงานเบอร์ ${display} ในฐานข้อมูล SpamInThai แต่ไม่ได้แปลว่าปลอดภัย 100% เพราะมิจฉาชีพเปลี่ยนเบอร์บ่อย ห้ามให้รหัส OTP หรือโอนเงินให้ผู้ที่อ้างเป็นเจ้าหน้าที่ทางโทรศัพท์`
    });
  }
  if (result.networkType === 'landline') {
    const where = provinces.length ? ` รหัสพื้นที่นี้ใช้ใน${provinces.map((p) => p.th).join(', ')}` : '';
    faq.push({
      q: `เบอร์ ${display} เป็นเบอร์ที่ไหน เครือข่ายอะไร?`,
      a: `เบอร์ ${display} เป็นเบอร์โทรศัพท์บ้าน/สำนักงาน${where} ระวัง: มิจฉาชีพสามารถปลอมเบอร์บ้านหรือใช้ VoIP โทรเข้ามาได้`
    });
  } else if (result.carrierLabel) {
    faq.push({
      q: `เบอร์ ${display} เป็นเครือข่ายอะไร?`,
      a: `เบอร์ ${display} เป็นเบอร์มือถือ ขึ้นต้นด้วยเลขที่ออกให้เครือข่าย ${result.carrierLabel} (เจ้าของอาจย้ายค่ายเบอร์เดิมไปแล้ว)`
    });
  }
  faq.push({
    q: `ถ้าถูกเบอร์ ${display} หลอกโอนเงินต้องทำอย่างไร?`,
    a: 'โทรสายด่วน 1441 (ศูนย์ AOC) ทันทีเพื่ออายัดบัญชีปลายทาง แจ้งธนาคารของคุณ แล้วแจ้งความออนไลน์ที่ thaipoliceonline.go.th พร้อมเก็บหลักฐานการโอนและแชตไว้'
  });
  faq.push({
    q: `จะบล็อกเบอร์ ${display} อัตโนมัติได้อย่างไร?`,
    a: 'ติดตั้งแอป SpamInThai บน Google Play (Android) แอปจะเตือนและบล็อกเบอร์มิจฉาชีพที่มีคนรายงานไว้ก่อนคุณรับสาย ฟรี'
  });
  return faq;
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
  const provinces = result.networkType === 'landline' ? provincesForNumber(digits) : [];
  const breakdown = categoryBreakdown(result.categories, result.reports);
  const lastSeen = thaiDate(result.lastReport);
  const faq = buildFaq(display, result, provinces);

  const status = result.reports > 0 ? `${result.label} (${result.reports} รายงาน)` : 'ใครโทรมา?';
  const title = `เบอร์ ${display} ${status} เช็คเบอร์ ตรวจเบอร์ | SpamInThai`;
  const desc = `เบอร์ ${display} ${result.carrierLabel ? '(' + result.carrierLabel + ') ' : ''}${result.label} — ${result.advice} เช็คเบอร์ ตรวจเบอร์ใครโทรมาฟรี จากฐานข้อมูลรายงานของคนไทย`;
  const canonical = `${SITE}/check/${digits}`;
  const verdictClass =
    result.verdict === 'danger' ? 'danger' : result.verdict === 'caution' ? 'warn' : 'safe';

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: desc,
      url: canonical,
      inLanguage: 'th-TH',
      isPartOf: { '@type': 'WebSite', name: 'SpamInThai', url: SITE + '/' }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'เช็คเบอร์โทร', item: SITE + '/check' },
        { '@type': 'ListItem', position: 3, name: `เบอร์ ${display}`, item: canonical }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    }
  ];

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
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
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
.crumbs{font-size:.85rem;color:var(--color-text-muted);margin:0 0 12px}
.crumbs a{color:inherit}
.num-sec{margin-top:24px}
.num-sec h2{font-size:1.1rem;margin:0 0 10px}
.cat-row{margin:8px 0}
.cat-row span{display:flex;justify-content:space-between;font-size:.9rem}
.cat-bar{height:8px;border-radius:99px;background:var(--color-line);overflow:hidden;margin-top:4px}
.cat-bar i{display:block;height:100%;background:var(--color-secondary)}
.num-app{margin-top:24px;padding:18px;border-radius:16px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.num-app p{margin:0;max-width:420px}
.num-app a{background:#fff;color:#0f172a;font-weight:700;padding:10px 16px;border-radius:12px;text-decoration:none;white-space:nowrap}
.num-faq details{background:#fff;border:1px solid var(--color-line);border-radius:12px;padding:12px 14px;margin:8px 0}
.num-faq summary{font-weight:700;cursor:pointer}
.num-faq p{margin:8px 0 0;color:var(--color-text-muted)}
.num-actions{display:flex;flex-wrap:wrap;gap:8px}
.num-actions a{background:#fff;border:1px solid var(--color-line);border-radius:99px;padding:8px 14px;text-decoration:none;font-size:.92rem}
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
      <a href="https://play.google.com/store/apps/details?id=com.jarvis.callblocker" target="_blank" rel="noopener noreferrer" class="site-nav__link">ดาวน์โหลดแอป</a>
      <a class="site-nav__link site-nav__link--apk" href="https://play.google.com/store/apps/details?id=com.jarvis.callblocker" target="_blank" rel="noopener noreferrer">ดาวน์โหลดบน Google Play</a>
    </nav>
  </div>
  <div class="site-header__mobile">
    <a href="/check" class="site-tab site-tab--active">เช็คเบอร์โทร</a>
    <a href="/report" class="site-tab">แจ้งเบาะแส</a>
    <a href="https://play.google.com/store/apps/details?id=com.jarvis.callblocker" target="_blank" rel="noopener noreferrer" class="site-tab site-tab--apk">ดาวน์โหลดบน Google Play</a>
  </div>
</header>
<main class="site-main site-main--narrow">
<div class="number-wrap">
  <nav class="crumbs" aria-label="breadcrumb"><a href="/">หน้าแรก</a> › <a href="/check">เช็คเบอร์โทร</a> › เบอร์ ${esc(display)}</nav>
  <article class="verdict-card ${verdictClass}">
    <h1>เบอร์ ${esc(display)} — ${esc(result.label)}</h1>
    <p class="meta">${esc(result.advice)}</p>
    <div class="stats">
      ${result.carrierLabel ? `<div class="stat"><b>${esc(result.carrierLabel)}</b><small>เครือข่าย</small></div>` : ''}
      ${result.reports > 0 ? `<div class="stat"><b>${result.score}/100</b><small>คะแนนความเสี่ยง</small></div>` : ''}
      <div class="stat"><b>${result.reports}</b><small>รายงานทั้งหมด</small></div>
      ${lastSeen ? `<div class="stat"><b>${esc(lastSeen)}</b><small>รายงานล่าสุด</small></div>` : ''}
    </div>
    <a class="number-cta" href="/check?number=${esc(digits)}">เช็คเบอร์นี้แบบละเอียด →</a>
    <div class="share-bar" style="margin-top:16px;padding-top:14px;border-top:1px dashed rgba(0,0,0,.08)">
      <p style="font-size:.78rem;color:#64748b;margin:0 0 8px;font-weight:600">แชร์เตือนคนอื่น</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <a class="share-line" style="background:#06C755;color:#fff;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;text-decoration:none" href="https://line.me/R/msg/text/?${encodeURIComponent(`⚠️ เบอร์ ${display} — ${result.label}\nเช็คเบอร์มิจฉาชีพฟรี 👇\n${canonical}?utm_source=line&utm_medium=share&utm_campaign=number_page`)}">LINE</a>
        <a style="background:#1877F2;color:#fff;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;text-decoration:none" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical + '?utm_source=facebook&utm_medium=share&utm_campaign=number_page')}" target="_blank" rel="noopener">Facebook</a>
        <a style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;text-decoration:none" href="https://play.google.com/store/apps/details?id=com.jarvis.callblocker" target="_blank" rel="noopener noreferrer">ดาวน์โหลดแอป</a>
      </div>
    </div>
  </article>
  ${breakdown.length ? `<section class="num-sec">
    <h2>ประเภทที่ถูกรายงาน</h2>
    ${breakdown.map((b) => `<div class="cat-row"><span><b>${esc(b.label)}</b><small>${b.count} ครั้ง</small></span><div class="cat-bar"><i style="width:${b.pct}%"></i></div></div>`).join('')}
  </section>` : ''}
  <aside class="num-app">
    <p><b>${result.verdict === 'danger' || result.verdict === 'caution' ? 'บล็อกเบอร์นี้อัตโนมัติ' : 'รู้ก่อนรับสายทุกครั้ง'}</b><br>แอป SpamInThai เตือนเบอร์มิจฉาชีพก่อนคุณรับสาย ฟรีบน Android</p>
    <a href="${PLAY}" target="_blank" rel="noopener noreferrer">ดาวน์โหลดบน Google Play</a>
  </aside>
  <section class="num-sec">
    <h2>เคยถูกเบอร์ ${esc(display)} โทรมา?</h2>
    <div class="num-actions">
      <a href="/report?number=${esc(digits)}">แจ้งเบาะแสเบอร์นี้</a>
      <a href="/dispute?num=${esc(digits)}">นี่คือเบอร์ของฉัน (ขอแก้ไขข้อมูล)</a>
      <a href="/guide/call-center-scam">วิธีสังเกตแก๊งคอลเซ็นเตอร์</a>
      ${provinces.map((p) => `<a href="/${p.slug}">เบอร์ร้องเรียน${esc(p.th)}</a>`).join('')}
    </div>
  </section>
  <section class="num-sec num-faq">
    <h2>คำถามที่พบบ่อยเกี่ยวกับเบอร์ ${esc(display)}</h2>
    ${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
  </section>
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
      <a href="https://play.google.com/store/apps/details?id=com.jarvis.callblocker" target="_blank" rel="noopener noreferrer">ดาวน์โหลดแอป</a>
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
