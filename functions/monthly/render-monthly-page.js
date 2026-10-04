// Server-rendered monthly summaries: /monthly (index) and /monthly/YYYY-MM.
// Targets searches like "เบอร์มิจฉาชีพล่าสุด ตุลาคม 2569". Stats are computed from
// KV (numbers whose latest report falls in the month) and cached per month:
// the current month refreshes every 6h, past months are frozen once computed.

import { assess } from '../api/risk-assess.js';
import { identifyCarrier, MOBILE_PREFIXES } from '../api/carrier.js';
import { getAllNumbersCached, bulkGetJson } from '../api/kv-scan.js';
import { esc, fmt, page, html } from '../province/render-province-page.js';

const SITE = 'https://spaminthai.com';
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
const FIRST_MONTH = '2026-07'; // first month with Search Console data for the site
const CURRENT_TTL = 6 * 60 * 60;
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const CATEGORY_LABELS = { scam: 'มิจฉาชีพ/หลอกโอนเงิน', callcenter: 'แก๊งคอลเซ็นเตอร์', loan: 'เงินกู้', ads: 'โฆษณา/ขายของ', safe: 'เบอร์ปกติ' };

/** "YYYY-MM" in Bangkok time. */
export function bangkokMonth(ts = Date.now()) {
  return new Date(Number(ts) + BKK_OFFSET_MS).toISOString().slice(0, 7);
}

/** "ตุลาคม 2569" */
export function thaiMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

/** Months from FIRST_MONTH to the current Bangkok month, newest first. */
export function listMonths(now = Date.now()) {
  const out = [];
  const end = bangkokMonth(now);
  let [y, m] = FIRST_MONTH.split('-').map(Number);
  for (let ym = FIRST_MONTH; ym <= end; ) {
    out.push(ym);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    ym = `${y}-${String(m).padStart(2, '0')}`;
  }
  return out.reverse();
}

export function matchMonthlyPath(path, now = Date.now()) {
  if (path === '/monthly' || path === '/monthly/') return { type: 'index' };
  const m = path.match(/^\/monthly\/(\d{4}-\d{2})\/?$/);
  if (!m || !listMonths(now).includes(m[1])) return null;
  return path.endsWith('/') ? { type: 'redirect', to: '/monthly/' + m[1] } : { type: 'month', ym: m[1] };
}

function prefixOf(number) {
  return number.startsWith('02') ? '02' : number.slice(0, 3);
}

/** Aggregate stats for numbers whose latest report is in `ym`. */
export async function computeMonthlyStats(env, ym) {
  const numbers = await getAllNumbersCached(env);
  const values = await bulkGetJson(env, numbers.map((n) => 'num:' + n));
  let reported = 0, totalReports = 0, danger = 0, caution = 0;
  const categories = {}, prefixes = {}, carriers = {};
  const top = [];
  for (const n of numbers) {
    const d = values.get('num:' + n);
    if (!d || !(d.reports > 0) || !d.lastReport) continue;
    const ts = typeof d.lastReport === 'string' ? Date.parse(d.lastReport) : Number(d.lastReport);
    if (!Number.isFinite(ts) || bangkokMonth(ts) !== ym) continue;
    const a = assess(d);
    reported += 1;
    totalReports += d.reports;
    if (a.verdict === 'danger') danger += 1;
    if (a.verdict === 'caution') caution += 1;
    for (const [c, v] of Object.entries(d.categories || {})) {
      if (c !== 'safe') categories[c] = (categories[c] || 0) + (Number(v) || 0);
    }
    const p = prefixOf(n);
    prefixes[p] = (prefixes[p] || 0) + 1;
    const { carrierLabel } = identifyCarrier(n);
    if (carrierLabel) carriers[carrierLabel] = (carriers[carrierLabel] || 0) + 1;
    top.push({ number: n, reports: d.reports, verdict: a.verdict, label: a.label });
  }
  const sortObj = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]);
  top.sort((x, y) => y.reports - x.reports);
  return {
    ym, reported, totalReports, danger, caution,
    categories: sortObj(categories),
    prefixes: sortObj(prefixes).slice(0, 10),
    carriers: sortObj(carriers),
    top: top.slice(0, 20),
    computedAt: new Date().toISOString(),
  };
}

export async function getMonthlyStats(env, ym, now = Date.now()) {
  const key = 'seo:monthly:' + ym;
  try {
    const cached = await env.SPAM_KV.get(key);
    if (cached) return JSON.parse(cached);
  } catch { /* recompute */ }
  const stats = await computeMonthlyStats(env, ym);
  try {
    const isCurrent = ym === bangkokMonth(now);
    await env.SPAM_KV.put(key, JSON.stringify(stats), isCurrent ? { expirationTtl: CURRENT_TTL } : {});
  } catch { /* ignore */ }
  return stats;
}

function tag(verdict) {
  return verdict === 'danger' ? 'อันตราย' : verdict === 'caution' ? 'น่าสงสัย' : 'มีรายงาน';
}

function monthNav(ym) {
  return `<div class="pv-chips">${listMonths()
    .map((m) => (m === ym ? `<b style="padding:6px 12px">${esc(thaiMonthLabel(m))}</b>` : `<a href="/monthly/${m}">${esc(thaiMonthLabel(m))}</a>`))
    .join('')}</div>`;
}

const STAT_STYLE = `<style>
.mo-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:16px}
@media(min-width:640px){.mo-stats{grid-template-columns:repeat(4,1fr)}}
.mo-stat{background:#fff;border:1px solid var(--color-line);border-radius:14px;padding:12px 14px}
.mo-stat b{display:block;font-size:1.5rem}.mo-stat small{color:var(--color-text-muted)}
.mo-bar{margin:8px 0}.mo-bar span{display:flex;justify-content:space-between;font-size:.92rem}
.mo-bar div{height:8px;border-radius:99px;background:var(--color-line);overflow:hidden;margin-top:4px}
.mo-bar i{display:block;height:100%;background:var(--color-primary)}
</style>`;

export async function renderMonthlyPage(ym, env, now = Date.now()) {
  if (!listMonths(now).includes(ym)) return new Response('Not found', { status: 404 });
  const s = await getMonthlyStats(env, ym, now);
  const label = thaiMonthLabel(ym);
  const isCurrent = ym === bangkokMonth(now);
  const canonical = `${SITE}/monthly/${ym}`;
  const title = `เบอร์มิจฉาชีพเดือน${label}: สรุปเบอร์ที่ถูกรายงาน${s.reported ? ` ${s.reported} เบอร์` : ''} | SpamInThai`;
  const desc = s.reported
    ? `สรุปเบอร์มิจฉาชีพเดือน${label} มี ${s.reported} เบอร์ถูกรายงานรวม ${s.totalReports} ครั้ง เบอร์อันตราย ${s.danger} เบอร์ เลขขึ้นต้นที่โดนรายงานมากสุด ${s.prefixes.slice(0, 3).map(([p]) => p).join(', ')} พร้อมรายชื่อเบอร์ที่ควรระวัง`
    : `สรุปเบอร์มิจฉาชีพเดือน${label} จากฐานข้อมูลที่คนไทยช่วยกันรายงาน`;
  const maxCat = s.categories.length ? s.categories[0][1] : 1;

  const body = s.reported
    ? `
<nav class="number-seo" aria-label="breadcrumb" style="margin:0 0 12px"><a href="/">หน้าแรก</a> › <a href="/monthly">สรุปรายเดือน</a> › ${esc(label)}</nav>
<section class="pv-hero">
  <h1>เบอร์มิจฉาชีพเดือน${esc(label)}</h1>
  <p class="lead">สรุปเบอร์ที่คนไทยรายงานเข้ามาในเดือน${esc(label)}${isCurrent ? ' (อัปเดตทุก 6 ชั่วโมง)' : ''} นับจากรายงานล่าสุดของแต่ละเบอร์</p>
  <div class="mo-stats">
    <div class="mo-stat"><b>${s.reported.toLocaleString('en-US')}</b><small>เบอร์ที่ถูกรายงาน</small></div>
    <div class="mo-stat"><b>${s.totalReports.toLocaleString('en-US')}</b><small>รายงานรวม</small></div>
    <div class="mo-stat"><b>${s.danger.toLocaleString('en-US')}</b><small>เบอร์อันตราย</small></div>
    <div class="mo-stat"><b>${s.caution.toLocaleString('en-US')}</b><small>เบอร์น่าสงสัย</small></div>
  </div>
</section>

${s.categories.length ? `<section class="pv-sec"><h2>หลอกแบบไหนมากที่สุด</h2>${s.categories
  .map(([c, v]) => `<div class="mo-bar"><span><b>${esc(CATEGORY_LABELS[c] || 'อื่น ๆ')}</b><small>${v} รายงาน</small></span><div><i style="width:${Math.round((v / maxCat) * 100)}%"></i></div></div>`)
  .join('')}</section>` : ''}

<section class="pv-sec">
  <h2>เลขขึ้นต้นที่ถูกรายงานมากที่สุด</h2>
  <div class="pv-chips">${s.prefixes
    .map(([p, v]) => (MOBILE_PREFIXES.includes(p) ? `<a href="/prefix/${p}">เบอร์ ${esc(p)} · ${v} เบอร์</a>` : `<span style="padding:6px 12px">เบอร์ ${esc(p)} · ${v} เบอร์</span>`))
    .join('')}</div>
</section>

<section class="pv-sec">
  <h2>เบอร์ที่ถูกรายงานมากที่สุดเดือน${esc(label)}</h2>
  <ul class="pv-list">${s.top
    .map((it) => `<li><span><a href="/check/${esc(it.number)}">${esc(fmt(it.number))}</a><br><small>${esc(it.label || '')} · รายงาน ${it.reports} ครั้ง</small></span><span class="pv-tag ${esc(it.verdict)}">${tag(it.verdict)}</span></li>`)
    .join('')}</ul>
</section>

<section class="pv-sec">
  <h2>วิธีป้องกันตัว</h2>
  <ul class="pv-tips">
    <li>ตำรวจ ธนาคาร หรือหน่วยงานรัฐ <b>ไม่ขอให้โอนเงินหรือบอกรหัส OTP ทางโทรศัพท์</b></li>
    <li>เบอร์แปลกโทรมา <a href="/check">เช็คเบอร์ก่อนรับสาย</a> ทุกครั้ง</li>
    <li>ถูกหลอกโอนเงิน แจ้ง <b>สายด่วน 1441</b> (ศูนย์ AOC) เพื่ออายัดบัญชีให้เร็วที่สุด</li>
  </ul>
</section>

<div class="pv-app">
  <p><b>บล็อกเบอร์มิจฉาชีพอัตโนมัติ</b><br>แอป SpamInThai เตือนเบอร์อันตรายก่อนรับสาย ใช้ฟรีบน Android</p>
  <a href="${PLAY}" target="_blank" rel="noopener noreferrer">▶ ดาวน์โหลดบน Google Play</a>
</div>

<section class="pv-sec"><h2>สรุปเดือนอื่น</h2>${monthNav(ym)}</section>`
    : `
<section class="pv-hero">
  <h1>เบอร์มิจฉาชีพเดือน${esc(label)}</h1>
  <p class="lead">ยังไม่มีรายงานในเดือนนี้ เจอเบอร์แปลก <a href="/report">แจ้งเบาะแสที่นี่</a> หรือ <a href="/check">เช็คเบอร์</a></p>
</section>
<section class="pv-sec"><h2>สรุปเดือนอื่น</h2>${monthNav(ym)}</section>`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: title, description: desc, url: canonical, inLanguage: 'th-TH', dateModified: s.computedAt,
        isPartOf: { '@type': 'WebSite', name: 'SpamInThai', url: SITE + '/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SpamInThai', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'สรุปเบอร์มิจฉาชีพรายเดือน', item: SITE + '/monthly' },
        { '@type': 'ListItem', position: 3, name: label } ] },
    ],
  };
  return html(page({ title, desc, canonical, schema, body: STAT_STYLE + body, robots: s.reported ? '' : 'noindex,follow' }), 200, isCurrent ? 1800 : 86400);
}

export function renderMonthlyIndex() {
  const canonical = `${SITE}/monthly`;
  const title = 'สรุปเบอร์มิจฉาชีพรายเดือน 2569 | SpamInThai';
  const desc = 'สรุปเบอร์มิจฉาชีพและแก๊งคอลเซ็นเตอร์ที่คนไทยรายงานในแต่ละเดือน เลขขึ้นต้นที่โดนรายงานมากสุด รูปแบบการหลอก และรายชื่อเบอร์ที่ควรระวัง';
  const months = listMonths();
  const body = `
<section class="pv-hero">
  <h1>สรุปเบอร์มิจฉาชีพรายเดือน</h1>
  <p class="lead">เลือกเดือนเพื่อดูสถิติเบอร์ที่ถูกรายงาน เลขขึ้นต้นที่ต้องระวัง และเบอร์อันตรายที่ถูกรายงานมากที่สุด</p>
</section>
<section class="pv-sec"><ul class="pv-grid">${months
  .map((m) => `<li><a href="/monthly/${m}"><b>${esc(thaiMonthLabel(m))}</b><small>เบอร์มิจฉาชีพประจำเดือน</small></a></li>`)
  .join('')}</ul></section>
<section class="pv-sec"><p><a href="/prefix">เช็คเบอร์ตามเลขขึ้นต้น →</a> · <a href="/thailand">เบอร์บ้าน 77 จังหวัด →</a></p></section>
<div class="pv-app">
  <p><b>บล็อกสายมิจฉาชีพอัตโนมัติ</b><br>แอป SpamInThai เตือนเบอร์อันตรายก่อนรับสาย ใช้ฟรีบน Android</p>
  <a href="${PLAY}" target="_blank" rel="noopener noreferrer">▶ ดาวน์โหลดบน Google Play</a>
</div>`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: canonical, inLanguage: 'th-TH',
    hasPart: months.map((m) => ({ '@type': 'WebPage', name: 'เบอร์มิจฉาชีพเดือน' + thaiMonthLabel(m), url: `${SITE}/monthly/${m}` })),
  };
  return html(page({ title, desc, canonical, schema, body }), 200, 3600);
}
