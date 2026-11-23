// Aggregate statistics from user reports for one area code / mobile prefix.
// Gives each SEO page (province, prefix) numbers that are unique to it, computed
// from the SpamInThai report database, instead of only template text.
// Wording rule: describe what users reported — never say a number or area "is" a scam.

import { assess } from '../api/risk-assess.js';

const CAT_LABELS = {
  scam: 'มิจฉาชีพ/หลอกโอนเงิน',
  callcenter: 'แก๊งคอลเซ็นเตอร์',
  loan: 'เงินกู้/สินเชื่อ',
  ads: 'โฆษณา/ขายของ',
  other: 'อื่น ๆ',
};
const DAY = 24 * 60 * 60 * 1000;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toTs(v) {
  if (v == null) return NaN;
  return typeof v === 'string' ? Date.parse(v) : Number(v);
}

/**
 * @param {{number:string,data:object}[]} records sampled KV records
 * @param {number} totalNumbers how many reported numbers exist for this scope (may exceed the sample)
 */
export function summarizeReports(records, totalNumbers = records.length, now = Date.now()) {
  const cats = { scam: 0, callcenter: 0, loan: 0, ads: 0, other: 0 };
  let reports = 0, danger = 0, caution = 0, last30 = 0, last7 = 0, latest = null, sample = 0;
  for (const r of records) {
    const d = (r && r.data) || {};
    const n = Number(d.reports) || 0;
    if (n <= 0) continue;
    sample++;
    reports += n;
    const c = d.categories || {};
    let counted = 0;
    for (const [k, v] of Object.entries(c)) {
      if (k === 'safe') continue;
      const x = Number(v) || 0;
      if (x <= 0) continue;
      counted += x;
      cats[k in cats ? k : 'other'] += x;
    }
    if (counted === 0) cats.other += n;
    const a = assess(d, now);
    if (a.verdict === 'danger') danger++;
    else if (a.verdict === 'caution') caution++;
    const ts = toTs(d.lastReport);
    if (Number.isFinite(ts) && ts <= now) {
      if (now - ts <= 30 * DAY) last30++;
      if (now - ts <= 7 * DAY) last7++;
      if (latest == null || ts > latest) latest = ts;
    }
  }
  const catTotal = Object.values(cats).reduce((a, b) => a + b, 0);
  const breakdown = Object.entries(cats)
    .filter(([, v]) => v > 0)
    .map(([key, count]) => ({ key, label: CAT_LABELS[key], count, pct: catTotal ? Math.round((count * 100) / catTotal) : 0 }))
    .sort((a, b) => b.count - a.count);
  return {
    totalNumbers: Math.max(totalNumbers, sample),
    sample,
    reports,
    danger,
    caution,
    last30,
    last7,
    latest: latest == null ? null : new Date(latest).toISOString(),
    breakdown,
  };
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function thaiDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 7 * 60 * 60 * 1000); // Asia/Bangkok
  return `${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

/** One data-driven sentence, e.g. for the hero summary. Empty string when no data. */
export function statsSentence(stats, scope) {
  if (!stats || !stats.sample) return '';
  const top = stats.breakdown[0];
  const parts = [`ในฐานข้อมูล SpamInThai มี${scope}ที่มีรายงานจากผู้ใช้ ${stats.totalNumbers} เบอร์`];
  if (top) parts.push(`ประเภทที่ผู้ใช้รายงานมากที่สุดคือ "${top.label}" (${top.pct}% ของรายงาน)`);
  if (stats.last30) parts.push(`มี ${stats.last30} เบอร์ที่ถูกรายงานภายใน 30 วันที่ผ่านมา`);
  else if (stats.latest) parts.push(`รายงานล่าสุดเมื่อ ${thaiDate(stats.latest)}`);
  return parts.join(' · ');
}

/** HTML section with the category breakdown and freshness numbers. Empty string when no data. */
export function renderStatsSection(stats, scope) {
  if (!stats || !stats.sample) return '';
  const bars = stats.breakdown
    .map(
      (b) =>
        `<li><span class="st-lbl">${esc(b.label)}</span><span class="st-bar" aria-hidden="true"><i style="width:${Math.max(3, b.pct)}%"></i></span><span class="st-pct">${b.pct}%</span></li>`
    )
    .join('');
  const sampleNote = stats.totalNumbers > stats.sample
    ? `วิเคราะห์จากเบอร์ที่มีรายงาน ${stats.sample} เบอร์ (จากทั้งหมด ${stats.totalNumbers} เบอร์)`
    : `วิเคราะห์จากเบอร์ที่มีรายงานทั้งหมด ${stats.sample} เบอร์`;
  return `<section class="pv-sec st-box">
  <h2>สถิติรายงาน${esc(scope)}</h2>
  <div class="st-grid">
    <div><b>${stats.totalNumbers}</b><small>เบอร์ที่มีรายงาน</small></div>
    <div><b>${stats.reports}</b><small>ครั้งที่ผู้ใช้รายงาน</small></div>
    <div><b>${stats.last30}</b><small>เบอร์ที่รายงานใน 30 วัน</small></div>
    <div><b>${stats.danger}</b><small>เบอร์ระดับอันตราย</small></div>
  </div>
  ${bars ? `<h3>ประเภทที่ผู้ใช้รายงาน</h3><ul class="st-bars">${bars}</ul>` : ''}
  <p class="st-note">${esc(sampleNote)}${stats.latest ? ` · รายงานล่าสุด ${esc(thaiDate(stats.latest))}` : ''} · ข้อมูลมาจากรายงานของผู้ใช้ ไม่ใช่คำตัดสินว่าเบอร์ใดเป็นมิจฉาชีพ อัปเดตทุก 6 ชั่วโมง</p>
</section>`;
}

export const STATS_STYLE = `.st-box{background:#fff;border:1px solid var(--color-line);border-radius:16px;padding:16px 18px}
.st-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.st-grid div{background:rgba(15,23,42,.04);border-radius:12px;padding:10px 12px}
.st-grid b{display:block;font-size:1.35rem}.st-grid small{color:var(--color-text-muted)}
.st-box h3{font-size:1rem;margin:16px 0 8px}
.st-bars{list-style:none;padding:0;margin:0}
.st-bars li{display:grid;grid-template-columns:minmax(120px,40%) 1fr 44px;gap:8px;align-items:center;margin:6px 0;font-size:.92rem}
.st-bar{height:10px;border-radius:99px;background:rgba(15,23,42,.08);overflow:hidden}
.st-bar i{display:block;height:100%;background:var(--color-secondary,#e11d48);border-radius:99px}
.st-pct{text-align:right;font-weight:700}
.st-note{font-size:.82rem;color:var(--color-text-muted);margin:12px 0 0}`;
