#!/usr/bin/env node
/**
 * Re-paginate the news listing pages (news-1.html … news-N.html).
 *
 *  - PER_PAGE cards per page, newest first (AdSense quality: no 60-item pages)
 *  - long headlines are cut at a clause break; the remainder becomes the summary line,
 *    so the summary never repeats the headline
 *  - rewrites pagination nav, removes pages that are no longer needed, keeps `_redirects`
 *    and NEWS_PAGE_COUNT (functions/api/sitemap.js) in sync
 *
 * Idempotent. Run after adding a news card to the top of news-1.html:
 *     node scripts/paginate-news.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PER_PAGE = 20;
const HEADLINE_MAX = 100; // characters; longer headlines are shortened
const HEADLINE_TARGET = 95;
const CARD_RE = /<a class="card" href="([^"]+)"><time datetime="([^"]+)">([^<]*)<\/time><h2>([\s\S]*?)<\/h2><p>([\s\S]*?)<\/p><\/a>/g;
const REDIR_START = '# >>> news pagination (managed by scripts/paginate-news.mjs)';
const REDIR_END = '# <<< news pagination';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

function pageFiles() {
  return fs.readdirSync(ROOT)
    .map((n) => /^news-(\d+)\.html$/.exec(n))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function bigrams(s) {
  const t = s.replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}
function similar(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
}

/** Cut a long headline at a clause (space) boundary. Returns [headline, rest]. */
export function splitHeadline(h) {
  const text = h.trim();
  if (text.length <= HEADLINE_MAX) return [text, ''];
  const parts = text.split(/\s+/);
  let head = parts[0];
  let i = 1;
  while (i < parts.length && (head + ' ' + parts[i]).length <= HEADLINE_TARGET) {
    head += ' ' + parts[i];
    i++;
  }
  // keep a number together with its unit ("2,500 บาท", "7 ราย")
  if (i < parts.length && /\d$/.test(head) && /^(บาท|ล้านบาท|ล้าน|ราย|คน|เคส|ครั้ง|บัญชี|จุด|ปี|เดือน|วัน)/.test(parts[i])) {
    head += ' ' + parts[i];
    i++;
  }
  // never end a headline on a dangling connector or an opening quote
  while (i > 1 && /^(ที่|และ|ของ|โดย|ใน|กับ|จาก|หลัง|ก่อน|เพื่อ|ว่า|ให้|"|“|\()$/.test(head.split(' ').pop())) {
    head = head.split(' ').slice(0, -1).join(' ');
    i--;
  }
  return [head, parts.slice(i).join(' ')];
}

function normalizeCard([href, dt, dateText, h2, p]) {
  const [head, rest] = splitHeadline(h2);
  let summary = p.trim();
  if (rest) {
    // the old summary usually repeats the long headline — use the rest of the headline instead
    if (similar(summary, h2) > 0.6) summary = rest.length >= 40 ? rest : summary;
  }
  return `<a class="card" href="${href}"><time datetime="${dt}">${dateText}</time><h2>${head}</h2><p>${summary}</p></a>`;
}

function nav(n, total) {
  if (total <= 1) return '';
  const prev = n > 1 ? `\n  <a class="news-pagination__btn" href="/news-${n - 1}">← ก่อนหน้า</a>` : '';
  const next = n < total ? `\n  <a class="news-pagination__btn news-pagination__btn--primary" href="/news-${n + 1}">หน้าถัดไป →</a>` : '';
  return `\n  <nav class="news-pagination" aria-label="เปลี่ยนหน้า">${prev}\n  <span class="news-pagination__info">หน้า ${n} / ${total}</span>${next}\n</nav>\n`;
}

function replaceMain(html, cardsHtml, navHtml) {
  const subEnd = html.indexOf('</p>', html.indexOf('<p class="sub">'));
  const mainEnd = html.indexOf('</main>');
  if (subEnd < 0 || mainEnd < 0) throw new Error('news page template: <p class="sub"> or </main> not found');
  return html.slice(0, subEnd + 4) + '\n\n' + cardsHtml + '\n' + navHtml + html.slice(mainEnd);
}

function main() {
  const existing = pageFiles();
  if (!existing.includes(1) || !existing.includes(2)) throw new Error('need news-1.html and news-2.html as templates');

  // collect cards from all pages, de-duplicated, newest first (stable for same-day items)
  const seen = new Set();
  const cards = [];
  for (const n of existing) {
    for (const m of read(`news-${n}.html`).matchAll(CARD_RE)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      cards.push(m.slice(1, 6));
    }
  }
  cards.sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));

  const total = Math.max(1, Math.ceil(cards.length / PER_PAGE));
  const tpl1 = read('news-1.html');
  const tplN = read('news-2.html');

  for (let n = 1; n <= total; n++) {
    const slice = cards.slice((n - 1) * PER_PAGE, n * PER_PAGE).map((c) => '  ' + normalizeCard(c)).join('\n');
    let html = n === 1 ? tpl1 : tplN.replaceAll('หน้า 2', `หน้า ${n}`).replaceAll('news-2', `news-${n}`);
    html = replaceMain(html, slice, nav(n, total));
    // listing pages 2+ are navigation only: keep them crawlable but out of the index
    html = html.replace(/\n<meta name="robots" content="noindex, follow">/g, '');
    if (n > 1) html = html.replace(/(<meta name="viewport"[^>]*>)/, '$1\n<meta name="robots" content="noindex, follow">');
    write(`news-${n}.html`, html);
  }

  // drop pages that are no longer needed and redirect them to page 1
  const removed = existing.filter((n) => n > total);
  for (const n of removed) fs.rmSync(path.join(ROOT, `news-${n}.html`));

  let redirects = read('_redirects');
  const block = new RegExp(`\\n?${REDIR_START}[\\s\\S]*?${REDIR_END}\\n?`);
  const prevGone = (block.exec(redirects)?.[0].match(/\/news-(\d+) /g) || []).map((x) => Number(x.match(/\d+/)[0]));
  redirects = redirects.replace(block, '\n');
  const gone = [...new Set([...prevGone, ...removed])].filter((n) => n > total).sort((a, b) => a - b);
  if (gone.length) {
    redirects = redirects.replace(/\n*$/, '\n') + `${REDIR_START}\n${gone.map((n) => `/news-${n} /news-1 301`).join('\n')}\n${REDIR_END}\n`;
  }
  write('_redirects', redirects);

  const sm = 'functions/api/sitemap.js';
  write(sm, read(sm).replace(/const NEWS_PAGE_COUNT = \d+;/, `const NEWS_PAGE_COUNT = ${total};`));

  console.log(`news: ${cards.length} cards → ${total} pages of ≤${PER_PAGE}; removed pages: ${removed.join(', ') || 'none'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
