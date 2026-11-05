// Server-rendered SEO pages: /prefix (index) and /prefix/<06x|08x|09x> (30 mobile prefixes).
// Targets searches like "เบอร์ 065 มิจฉาชีพ": original carrier, recently reported
// numbers with that prefix (from KV, cached), a check form, safety tips and app CTA.

import { assess } from '../api/risk-assess.js';
import { summarizeReports, statsSentence, renderStatsSection } from '../seo/area-stats.js';
import { identifyCarrier, MOBILE_PREFIXES } from '../api/carrier.js';
import { esc, fmt, page, html } from '../province/render-province-page.js';

const SITE = 'https://spaminthai.com';
const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
const CACHE_TTL = 6 * 60 * 60; // KV cache per prefix (keeps KV list ops low)

// Existing articles that cover a prefix in depth.
const RELATED_BLOG = {
  '065': { slug: 'numbers-065-scam', title: 'เบอร์ 065 มิจฉาชีพ: ทำไมเจอบ่อย และวิธีรับมือ' },
};

/** Match /prefix or /prefix/<3 digits>. */
export function matchPrefixPath(path) {
  if (path === '/prefix' || path === '/prefix/') return { type: 'index' };
  const m = path.match(/^\/prefix\/(0\d{2})\/?$/);
  if (!m) return null;
  if (!MOBILE_PREFIXES.includes(m[1])) return null;
  return path.endsWith('/') ? { type: 'redirect', to: '/prefix/' + m[1] } : { type: 'prefix', prefix: m[1] };
}

/** Reported 10-digit mobiles starting with `prefix`, most reported first (cached in KV). */
export async function reportedForPrefix(env, prefix) {
  const cacheKey = 'seo:prefix:' + prefix;
  try {
    const cached = await env.SPAM_KV.get(cacheKey);
    if (cached) {
      const c = JSON.parse(cached);
      if (c && c.stats) return c;
    }
  } catch {
    /* fall through */
  }
  try {
    let cursor;
    const keys = [];
    do {
      const pageRes = await env.SPAM_KV.list({ prefix: 'num:' + prefix, cursor, limit: 1000 });
      for (const k of pageRes.keys) {
        if (/^\d{10}$/.test(k.name.slice(4))) keys.push(k.name);
      }
      cursor = pageRes.list_complete ? null : pageRes.cursor;
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
    const out = [];
    for (const v of vals) {
      if (!v || !(v.data.reports > 0)) continue;
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
    const result = { total: keys.length, items: out.slice(0, 20), stats: summarizeReports(vals.filter(Boolean), keys.length) };
    try {
      await env.SPAM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    } catch {
      /* ignore */
    }
    return result;
  } catch {
    return { total: 0, items: [], stats: null };
  }
}

/**
 * Short direct answer for the hero (cited by Google AI Overviews / ChatGPT / Perplexity).
 * Never says a prefix "is" a scam — only that users have reported some numbers.
 */
export function buildPrefixSummary(prefix, carrierLabel, reportedCount) {
  const reported = reportedCount > 0
    ? `ในฐานข้อมูล SpamInThai มีเบอร์ ${prefix} ที่มีรายงานจากผู้ใช้ ${reportedCount} เบอร์`
    : `ตอนนี้ยังไม่มีเบอร์ ${prefix} ที่มีรายงานจากผู้ใช้ในฐานข้อมูล SpamInThai`;
  return `เบอร์ขึ้นต้น ${prefix} เป็นเบอร์มือถือที่ออกให้ค่าย ${carrierLabel} ใช้ได้ทั่วประเทศ ไม่ได้แปลว่าเป็นมิจฉาชีพทุกเบอร์ — ${reported} ควรเช็คเบอร์เต็มก่อนรับสายหรือโทรกลับ`;
}

/** Question/answer pairs shown on the page and emitted as FAQPage schema. */
export function buildPrefixFaq(prefix, carrierLabel, reportedCount) {
  return [
    {
      q: `เบอร์ ${prefix} เป็นมิจฉาชีพไหม?`,
      a: `ไม่ใช่ทุกเบอร์ เบอร์ขึ้นต้น ${prefix} ส่วนใหญ่เป็นเบอร์ของคนทั่วไป ${
        reportedCount > 0
          ? `แต่มีเบอร์ ${prefix} ${reportedCount} เบอร์ที่มีรายงานจากผู้ใช้ใน SpamInThai`
          : `และยังไม่มีเบอร์ ${prefix} ที่มีรายงานจากผู้ใช้ใน SpamInThai`
      } ให้ใส่เบอร์เต็ม 10 หลักในช่องเช็คเบอร์เพื่อดูว่าเบอร์นั้นมีรายงานหรือไม่`,
    },
    {
      q: `เบอร์ ${prefix} เป็นค่ายอะไร?`,
      a: `เลขขึ้นต้น ${prefix} ถูกจัดสรรให้ค่าย ${carrierLabel} แต่เจ้าของเบอร์อาจย้ายค่ายแบบใช้เบอร์เดิมไปแล้ว จึงอาจไม่ตรงกับค่ายที่ใช้อยู่จริง`,
    },
    {
      q: `เบอร์ ${prefix} โทรมาจากจังหวัดไหน?`,
      a: `บอกไม่ได้ เพราะเบอร์มือถือขึ้นต้น ${prefix} ใช้ได้ทั่วประเทศ ไม่ผูกกับจังหวัด ต่างจากเบอร์บ้านที่ขึ้นต้นด้วยรหัสพื้นที่ เช่น 02 หรือ 053`,
    },
    {
      q: `ถ้าถูกเบอร์ ${prefix} หลอกโอนเงินต้องทำอย่างไร?`,
      a: 'โทรสายด่วน 1441 (ศูนย์ AOC) ทันทีเพื่อขออายัดบัญชีปลายทาง แจ้งธนาคารของคุณ แล้วแจ้งความกับตำรวจ พร้อมเก็บสลิปโอนเงินและแชตไว้เป็นหลักฐาน',
    },
    {
      q: `จะบล็อกเบอร์ ${prefix} ที่มีรายงานอัตโนมัติได้อย่างไร?`,
      a: 'ติดตั้งแอป SpamInThai จาก Google Play (Android) แอปจะเตือนเบอร์ที่มีรายงานจากผู้ใช้ก่อนคุณรับสาย ใช้ฟรี',
    },
  ];
}

// Official carrier call centers (customer service), used for "report spam to your carrier".
const CARRIER_HOTLINE = { AIS: '1175', 'ทรู': '1242', 'ดีแทค': '1678', NT: '1888' };

function carrierSection(prefix, carrierLabel) {
  const hot = CARRIER_HOTLINE[carrierLabel];
  return `<section class="pv-sec">
  <h2>แจ้งเบอร์ ${esc(prefix)} ที่รบกวนกับค่าย${hot ? ` ${esc(carrierLabel)}` : ''}</h2>
  <ul class="pv-tips">
    ${hot ? `<li>โทรศูนย์บริการลูกค้า ${esc(carrierLabel)} <b>${hot}</b> แจ้งเบอร์ที่โทรหรือส่ง SMS หลอกลวง พร้อมวันเวลาที่ได้รับ (ค่ายจะดูแลได้ดีที่สุดเมื่อคุณเป็นลูกค้าของค่ายนั้นเอง)</li>` : ''}
    <li>SMS โฆษณาที่ไม่ได้สมัคร กด <b>*137</b> แล้วโทรออก (ฟรี) เพื่อดูและยกเลิกบริการ SMS ที่หักเงินหรือส่งโฆษณามาหาคุณ</li>
    <li>ร้องเรียนการถูกรบกวนจากบริการโทรคมนาคมกับ กสทช. ได้ที่ <b>1200</b> (โทรฟรี)</li>
    <li>แจ้งเบอร์นี้ใน SpamInThai ที่ <a href="/report">หน้าแจ้งเบาะแส</a> เพื่อเตือนคนอื่นที่อาจถูกโทรหาเช่นกัน</li>
  </ul>
</section>`;
}

function tag(verdict) {
  return verdict === 'danger' ? 'อันตราย' : verdict === 'caution' ? 'น่าสงสัย' : 'มีรายงาน';
}

export async function renderPrefixPage(prefix, env) {
  if (!MOBILE_PREFIXES.includes(prefix)) return new Response('Not found', { status: 404 });
  const { carrierLabel } = identifyCarrier(prefix + '0000000');
  const { total, items, stats } = await reportedForPrefix(env, prefix);
  const statLine = statsSentence(stats, `เบอร์ ${prefix} `);
  const canonical = `${SITE}/prefix/${prefix}`;
  const dangerCount = items.filter((it) => it.verdict === 'danger').length;
  const title = `เบอร์ ${prefix} มิจฉาชีพ? เช็คเบอร์ขึ้นต้น ${prefix} ค่าย ${carrierLabel} | SpamInThai`;
  const desc = `เบอร์ขึ้นต้น ${prefix} เป็นเบอร์มือถือที่ออกให้ค่าย ${carrierLabel}${items.length ? ` — มีเบอร์ ${prefix} ถูกรายงานในระบบ ${total} เบอร์` : ''} ดูรายการเบอร์ ${prefix} ที่ถูกรายงานว่าเป็นมิจฉาชีพ/สแปมล่าสุด และเช็คเบอร์ฟรี`;
  const blog = RELATED_BLOG[prefix];
  const summary = buildPrefixSummary(prefix, carrierLabel, items.length ? total : 0);
  const faq = buildPrefixFaq(prefix, carrierLabel, items.length ? total : 0);

  const list = items.length
    ? `<ul class="pv-list">${items
        .map(
          (it) =>
            `<li><span><a href="/check/${esc(it.number)}">${esc(fmt(it.number))}</a><br><small>${esc(it.label || '')} · รายงาน ${it.reports} ครั้ง</small></span><span class="pv-tag ${esc(it.verdict)}">${tag(it.verdict)}</span></li>`
        )
        .join('')}</ul>${total > items.length ? `<p class="number-seo">แสดง ${items.length} จาก ${total} เบอร์ที่มีรายงาน</p>` : ''}`
    : `<div class="pv-empty">ยังไม่มีเบอร์ ${esc(prefix)} ที่ถูกรายงานในระบบ ถ้าเจอเบอร์ ${esc(prefix)} แปลกโทรมา <a href="/report">แจ้งเบาะแสที่นี่</a> เพื่อเตือนคนอื่น</div>`;

  const others = MOBILE_PREFIXES.filter((p) => p !== prefix && p[1] === prefix[1]);

  const body = `
<nav class="number-seo" aria-label="breadcrumb" style="margin:0 0 12px"><a href="/">หน้าแรก</a> › <a href="/prefix">เบอร์มือถือตามเลขขึ้นต้น</a> › เบอร์ ${esc(prefix)}</nav>
<section class="pv-hero">
  <h1>เบอร์ ${esc(prefix)} มิจฉาชีพไหม? เช็คเบอร์ขึ้นต้น ${esc(prefix)}</h1>
  <p class="lead">เบอร์ ${esc(prefix)} โทรมาแล้วไม่รู้จัก? ตรวจก่อนรับสายจากฐานข้อมูลเบอร์ที่คนไทยช่วยกันรายงาน ฟรี ไม่ต้องสมัคร</p>
  <div class="pv-code">📱 เบอร์มือถือขึ้นต้น <b>${esc(prefix)}</b> · ค่าย ${esc(carrierLabel)}</div>
  <p class="pv-summary"><b>สรุปสั้น:</b> ${esc(summary)}</p>
  ${statLine ? `<p class="pv-summary"><b>สรุปจากข้อมูล:</b> ${esc(statLine)}</p>` : ''}
  ${items.length ? `<p class="lead" style="font-size:.9rem">มีเบอร์ ${esc(prefix)} ที่ถูกรายงาน ${total} เบอร์${dangerCount ? ` (อันตราย ${dangerCount} เบอร์ใน 20 อันดับแรก)` : ''}</p>` : ''}
  <form class="pv-form" action="/check" method="get" role="search">
    <input type="tel" name="number" inputmode="tel" maxlength="16" placeholder="เช่น ${esc(prefix)}-xxx-xxxx" aria-label="เบอร์ที่ต้องการตรวจ" required>
    <button type="submit">ตรวจสอบ</button>
  </form>
</section>

<section class="pv-sec">
  <h2>เบอร์ ${esc(prefix)} ที่ถูกรายงานล่าสุด</h2>
  ${list}
</section>

${renderStatsSection(stats, `เบอร์ ${prefix}`)}

<section class="pv-sec">
  <h2>เบอร์ ${esc(prefix)} เป็นของค่ายไหน?</h2>
  <p>เลขขึ้นต้น <b>${esc(prefix)}</b> ถูกจัดสรรให้ค่าย <b>${esc(carrierLabel)}</b> แต่เจ้าของเบอร์อาจย้ายค่ายแบบเบอร์เดิมไปแล้ว และเบอร์มือถือใช้ได้ทั่วประเทศ จึงบอกไม่ได้ว่าโทรมาจากจังหวัดไหน มิจฉาชีพมักใช้ซิมเติมเงินหลายเบอร์ที่เลขขึ้นต้นเดียวกันและเลขใกล้เคียงกัน ถ้าเจอเบอร์ ${esc(prefix)} ที่เลขคล้ายกันโทรมาหลายครั้ง ให้ระวังเป็นพิเศษ</p>
</section>

<section class="pv-sec">
  <h2>วิธีรับมือเบอร์ ${esc(prefix)} ที่ไม่รู้จัก</h2>
  <ul class="pv-tips">
    <li>ตำรวจ ธนาคาร หรือหน่วยงานรัฐ <b>ไม่ขอให้โอนเงินหรือบอกรหัส OTP ทางโทรศัพท์</b></li>
    <li>ถ้าอ้างว่ามีพัสดุผิดกฎหมายหรือบัญชีถูกอายัด ให้วางสาย แล้วโทรกลับหน่วยงานจากเบอร์ทางการเอง</li>
    <li>อย่ากดลิงก์ใน SMS ที่ไม่รู้จัก และอย่าติดตั้งแอปตามที่คนแปลกหน้าบอก</li>
    <li>ถูกหลอกโอนเงิน แจ้ง <b>สายด่วน 1441</b> (ศูนย์ AOC) เพื่ออายัดบัญชีให้เร็วที่สุด</li>
  </ul>
  ${blog ? `<p><a href="/blog/${esc(blog.slug)}">อ่านต่อ: ${esc(blog.title)} →</a></p>` : ''}
</section>

${carrierSection(prefix, carrierLabel)}

<section class="pv-sec pv-faq">
  <h2>คำถามที่พบบ่อยเกี่ยวกับเบอร์ ${esc(prefix)}</h2>
  ${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
</section>

<div class="pv-app">
  <p><b>บล็อกเบอร์ ${esc(prefix)} อันตรายอัตโนมัติ</b><br>แอป SpamInThai เตือนเบอร์มิจฉาชีพก่อนรับสาย ใช้ฟรีบน Android</p>
  <a href="${PLAY}" target="_blank" rel="noopener noreferrer">▶ ดาวน์โหลดบน Google Play</a>
</div>

<section class="pv-sec">
  <h2>เช็คเบอร์ขึ้นต้นอื่น</h2>
  <div class="pv-chips">${others.map((p) => `<a href="/prefix/${p}">เบอร์ ${p}</a>`).join('')}<a href="/prefix">ทั้งหมด →</a></div>
</section>`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: title, description: desc, url: canonical, inLanguage: 'th-TH',
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.pv-summary'] },
        isPartOf: { '@type': 'WebSite', name: 'SpamInThai', url: SITE + '/' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SpamInThai', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'เบอร์มือถือตามเลขขึ้นต้น', item: SITE + '/prefix' },
        { '@type': 'ListItem', position: 3, name: `เบอร์ ${prefix}` } ] },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };
  return html(page({ title, desc, canonical, schema, body }));
}

export function renderPrefixIndex() {
  const canonical = `${SITE}/prefix`;
  const title = 'เบอร์มือถือขึ้นต้น 06 08 09 เป็นค่ายไหน? เช็คเบอร์มิจฉาชีพตามเลขขึ้นต้น | SpamInThai';
  const desc = 'รวมเลขขึ้นต้นเบอร์มือถือไทย 060–099 ว่าเป็นค่าย AIS ทรู ดีแทค หรือ NT พร้อมรายการเบอร์ที่ถูกรายงานว่าเป็นมิจฉาชีพ/สแปมในแต่ละเลขขึ้นต้น เช็คฟรี';
  const groups = ['6', '8', '9']
    .map((d) => {
      const list = MOBILE_PREFIXES.filter((p) => p[1] === d);
      return `<section class="pv-region"><h2>เบอร์ขึ้นต้น 0${d}x</h2><ul class="pv-grid">${list
        .map((p) => `<li><a href="/prefix/${p}"><b>เบอร์ ${p}</b><small>${esc(identifyCarrier(p + '0000000').carrierLabel)}</small></a></li>`)
        .join('')}</ul></section>`;
    })
    .join('');
  const body = `
<section class="pv-hero">
  <h1>เช็คเบอร์มือถือตามเลขขึ้นต้น</h1>
  <p class="lead">เลือกเลขขึ้นต้นเพื่อดูว่าเป็นค่ายไหน และเบอร์ที่ถูกรายงานว่าเป็นมิจฉาชีพล่าสุด</p>
  <form class="pv-form" action="/check" method="get" role="search">
    <input type="tel" name="number" inputmode="tel" maxlength="16" placeholder="ใส่เบอร์ที่ต้องการตรวจ" aria-label="เบอร์ที่ต้องการตรวจ" required>
    <button type="submit">ตรวจสอบ</button>
  </form>
</section>
${groups}
<section class="pv-sec">
  <h2>เบอร์บ้าน / สำนักงาน</h2>
  <p><a href="/thailand">ดูรหัสเบอร์บ้านครบ 77 จังหวัด →</a></p>
</section>
<div class="pv-app">
  <p><b>บล็อกสายมิจฉาชีพอัตโนมัติ</b><br>แอป SpamInThai เตือนเบอร์อันตรายก่อนรับสาย ใช้ฟรีบน Android</p>
  <a href="${PLAY}" target="_blank" rel="noopener noreferrer">▶ ดาวน์โหลดบน Google Play</a>
</div>`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: canonical, inLanguage: 'th-TH',
    hasPart: MOBILE_PREFIXES.map((p) => ({ '@type': 'WebPage', name: `เบอร์ ${p}`, url: `${SITE}/prefix/${p}` })),
  };
  return html(page({ title, desc, canonical, schema, body }), 200, 3600);
}
