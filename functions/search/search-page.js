// GET /search?q=... — site search over PUBLIC content only.
// Security: results come exclusively from the allowlisted sources below (articles, news,
// guides, provinces, prefixes, monthly reports, public pages). Nothing is crawled or read
// from disk/KV, so admin pages, /api/*, system files and private data can never appear.
import { BLOG_POSTS } from '../api/blog-posts.js';
import { NEWS } from '../news/news-index.js';
import { PROVINCES } from '../province/provinces.js';
import { MOBILE_PREFIXES } from '../api/carrier.js';
import { listMonths, thaiMonthLabel } from '../monthly/render-monthly-page.js';
import { page, html, esc } from '../province/render-province-page.js';

const SITE = 'https://spaminthai.com';

const PUBLIC_PAGES = [
  ['/check', 'เช็คเบอร์โทร ตรวจเบอร์ เบอร์ใคร', 'ค้นหาเบอร์ที่โทรเข้ามาจากฐานข้อมูลรายงานของผู้ใช้ ฟรี', 'เช็คเบอร์ ตรวจเบอร์ เบอร์ใคร เบอร์อะไร ค้นหาเบอร์'],
  ['/report', 'แจ้งเบาะแสเบอร์มิจฉาชีพ', 'รายงานเบอร์โทรหรือ SMS ที่น่าสงสัย เพื่อเตือนคนอื่น', 'รายงาน แจ้ง เบาะแส ร้องเรียน'],
  ['/dispute', 'โต้แย้งข้อมูลเบอร์', 'เจ้าของเบอร์ขอให้ตรวจสอบหรือแก้ไขข้อมูลรายงาน', 'โต้แย้ง ลบเบอร์ แก้ไขข้อมูล เจ้าของเบอร์'],
  ['/download', 'ดาวน์โหลดแอป SpamInThai', 'แอป Android บล็อกสายมิจฉาชีพอัตโนมัติ บน Google Play', 'แอป ดาวน์โหลด android บล็อกเบอร์ app'],
  ['/blog', 'บทความเตือนภัยและคู่มือทั้งหมด', 'รวมบทความรู้ทันมิจฉาชีพ', 'บทความ คู่มือ'],
  ['/news-1', 'ข่าวสารคดีฉ้อโกงและแก๊งคอลเซ็นเตอร์', 'รวมข่าวคดีฉ้อโกงออนไลน์ เรียบเรียงใหม่พร้อมแหล่งอ้างอิง', 'ข่าว ข่าวสาร คดี'],
  ['/thailand', 'เบอร์บ้านแยกตามจังหวัด 77 จังหวัด', 'รหัสพื้นที่เบอร์บ้านทุกจังหวัดและเบอร์ที่ถูกรายงาน', 'จังหวัด รหัสพื้นที่ เบอร์บ้าน'],
  ['/prefix', 'เบอร์มือถือแยกตามหัวเบอร์', 'หัวเบอร์มือถือ 06 08 09 และเบอร์ที่ถูกรายงาน', 'หัวเบอร์ เบอร์มือถือ prefix'],
  ['/monthly', 'สรุปเบอร์ที่ถูกรายงานรายเดือน', 'สถิติรายงานเบอร์แต่ละเดือน', 'รายเดือน สถิติ สรุป'],
  ['/guide/check-phone', 'เช็คเบอร์ ตรวจเบอร์ เบอร์ใคร — คู่มือฉบับเต็ม', 'วิธีตรวจว่าใครโทรมา', 'คู่มือ เช็คเบอร์'],
  ['/guide/block-spam-android', 'วิธีบล็อกเบอร์มิจฉาชีพ Android ฟรี', 'ตั้งค่าบล็อกสายแปลกบนมือถือ Android', 'คู่มือ บล็อก android'],
  ['/guide/spam-numbers', 'เบอร์โทรศัพท์มิจฉาชีพ อัพเดตล่าสุด', 'รายการเบอร์ที่มีรายงานจากผู้ใช้', 'คู่มือ เบอร์สแปม รายการเบอร์'],
  ['/guide/call-center-scam', 'โดนแก๊งคอลเซ็นเตอร์โทรมา ต้องทำยังไง', 'ขั้นตอนรับมือแก๊งคอลเซ็นเตอร์', 'คู่มือ แก๊งคอลเซ็นเตอร์'],
  ['/about', 'เกี่ยวกับ SpamInThai', 'ที่มาและทีมงาน', 'เกี่ยวกับ ทีมงาน'],
  ['/contact', 'ติดต่อเรา', 'ช่องทางติดต่อทีมงาน', 'ติดต่อ อีเมล'],
  ['/editorial-policy', 'นโยบายการตรวจสอบข้อมูล', 'วิธีคัดกรองรายงานและคะแนนความเสี่ยง', 'นโยบาย ตรวจสอบ'],
  ['/privacy', 'นโยบายความเป็นส่วนตัว', 'PDPA และการใช้คุกกี้', 'ความเป็นส่วนตัว pdpa คุกกี้'],
  ['/terms', 'ข้อกำหนดการใช้งาน', 'เงื่อนไขการใช้เว็บไซต์', 'ข้อกำหนด เงื่อนไข'],
];

let INDEX = null;
function buildIndex() {
  const out = [];
  for (const p of BLOG_POSTS) out.push({ type: 'บทความ', url: `/blog/${p.slug}`, title: p.title, desc: p.desc || '', kw: '', date: p.date || '' });
  for (const n of NEWS) out.push({ type: 'ข่าว', url: `/news/${n.slug}`, title: n.title, desc: '', kw: 'ข่าว', date: n.date || '' });
  for (const [url, title, desc, kw] of PUBLIC_PAGES) out.push({ type: url.startsWith('/guide/') ? 'คู่มือ' : 'หน้าเว็บ', url, title, desc, kw, date: '' });
  for (const v of PROVINCES.values()) out.push({ type: 'จังหวัด', url: `/${v.slug}`, title: `เบอร์โทรจังหวัด${v.th} (รหัสพื้นที่ ${v.code})`, desc: `เบอร์บ้าน ${v.code} ใน${v.th} ที่มีรายงานจากผู้ใช้`, kw: `${v.en} ${v.region} ${v.code}`, date: '' });
  for (const p of MOBILE_PREFIXES) out.push({ type: 'หัวเบอร์', url: `/prefix/${p}`, title: `เบอร์ขึ้นต้น ${p}`, desc: `เบอร์มือถือหัว ${p} ที่มีรายงานจากผู้ใช้`, kw: p, date: '' });
  for (const ym of listMonths()) out.push({ type: 'รายเดือน', url: `/monthly/${ym}`, title: `สรุปเบอร์ที่ถูกรายงาน ${thaiMonthLabel(ym)}`, desc: '', kw: ym, date: '' });
  // Final guard: only relative public paths, never admin/api/system-like paths.
  return out.filter((e) => /^\/[a-z0-9\-/]*$/.test(e.url) && !/^\/(admin|api|site|functions|scripts|assets|vps|docs|_)/.test(e.url));
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function searchSite(q, limit = 40) {
  if (!INDEX) INDEX = buildIndex();
  const terms = norm(q).split(' ').filter(Boolean).slice(0, 8);
  if (!terms.length) return [];
  const scored = [];
  for (const e of INDEX) {
    const t = norm(e.title), d = norm(e.desc), k = norm(e.kw + ' ' + e.type);
    let score = 0, all = true;
    for (const w of terms) {
      const s = (t.includes(w) ? 3 : 0) + (k.includes(w) ? 2 : 0) + (d.includes(w) ? 1 : 0);
      if (!s) all = false;
      score += s;
    }
    if (score) scored.push({ e, score: score + (all ? 10 : 0) + (norm(q) && t.includes(norm(q)) ? 5 : 0) });
  }
  scored.sort((a, b) => b.score - a.score || (b.e.date || '').localeCompare(a.e.date || ''));
  return scored.slice(0, limit).map((x) => x.e);
}

export function renderSearchPage(q) {
  const query = String(q || '').trim().slice(0, 80);
  const results = query ? searchSite(query) : [];
  const groups = ['บทความ', 'ข่าว', 'คู่มือ', 'จังหวัด', 'หัวเบอร์', 'รายเดือน', 'หน้าเว็บ'];
  const counts = groups.map((g) => [g, results.filter((r) => r.type === g).length]).filter(([, n]) => n);
  const list = results
    .map((r) => `<a class="sr-item" href="${esc(r.url)}"><span class="sr-type">${esc(r.type)}</span><span class="sr-title">${esc(r.title)}</span>${r.desc ? `<span class="sr-desc">${esc(r.desc)}</span>` : ''}</a>`)
    .join('');
  const body = `
<h1>ค้นหา</h1>
<form class="sr-form" action="/search" method="get" role="search">
  <input type="search" name="q" value="${esc(query)}" placeholder="ค้นหาเบอร์ บทความ ข่าว จังหวัด" aria-label="คำค้นหา" maxlength="80" autofocus>
  <button type="submit">ค้นหา</button>
</form>
${query ? `<p class="sr-meta">${results.length ? `พบ ${results.length} รายการสำหรับ “${esc(query)}”${counts.length ? ' · ' + counts.map(([g, n]) => `${esc(g)} ${n}`).join(' · ') : ''}` : `ไม่พบผลลัพธ์สำหรับ “${esc(query)}” ลองใช้คำที่สั้นลง หรือพิมพ์เบอร์โทรเพื่อเช็คเบอร์`}</p>` : '<p class="sr-meta">พิมพ์เบอร์โทรเพื่อเช็คเบอร์ หรือพิมพ์คำเพื่อค้นบทความ ข่าว คู่มือ จังหวัด และหัวเบอร์</p>'}
<div class="sr-list">${list}</div>
<style>
.sr-form{display:flex;gap:8px;margin:12px 0 8px}
.sr-form input{flex:1;min-width:0;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;font:inherit;font-size:1rem}
.sr-form button{padding:0 18px;border:0;border-radius:12px;background:#f43f5e;color:#fff;font-weight:700;font:inherit;cursor:pointer}
.sr-meta{color:#64748b;font-size:.9rem;margin:6px 2px 14px}
.sr-list{display:flex;flex-direction:column;gap:10px}
.sr-item{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid #f1f5f9;border-radius:14px;background:#fff;text-decoration:none}
.sr-item:hover{border-color:#fda4af}
.sr-type{align-self:flex-start;font-size:.72rem;font-weight:700;color:#be123c;background:#fff1f2;padding:2px 8px;border-radius:999px}
.sr-title{font-weight:700;color:#1e293b;line-height:1.45}
.sr-desc{font-size:.85rem;color:#64748b;line-height:1.5}
</style>`;
  const res = html(
    page({
      title: query ? `ค้นหา “${query}” | SpamInThai` : 'ค้นหา | SpamInThai',
      desc: 'ค้นหาบทความ ข่าว คู่มือ จังหวัด และหัวเบอร์บน SpamInThai',
      canonical: `${SITE}/search`,
      robots: 'noindex, follow',
      schema: { '@context': 'https://schema.org', '@type': 'SearchResultsPage', name: 'ค้นหา SpamInThai' },
      body,
    }),
    200,
    300
  );
  res.headers.set('X-Robots-Tag', 'noindex, follow');
  return res;
}
