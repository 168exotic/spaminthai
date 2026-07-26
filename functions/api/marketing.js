// Marketing automation — RSS feed, social posts, IndexNow, dedup via KV.
// Triggered by GitHub Actions or POST /api/marketing/run (Bearer secret).

import { getTopNumbers } from './sitemap.js';
import { assess } from './risk-assess.js';
import { identifyCarrier } from './carrier.js';

const SITE = 'https://spaminthai.com';
const INDEXNOW_KEY = '7f3a9e2b1c4d8e6f0a5b3c9d1e7f4a2';
const POSTED_TTL = 7 * 24 * 60 * 60; // 7 days

const GUIDE_LINKS = [
  { path: '/guide/call-center-scam', title: 'โดนแก๊งคอลเซ็นเตอร์ ต้องทำยังไง?' },
  { path: '/guide/block-spam-android', title: 'วิธีบล็อกเบอร์มิจฉาชีพ Android ฟรี' },
  { path: '/guide/check-phone', title: 'คู่มือเช็คเบอร์ ตรวจเบอร์' },
  { path: '/guide/spam-numbers', title: 'รายการเบอร์มิจฉาชีพอัพเดต' },
];

export function fmtPhone(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length >= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length >= 9) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function utm(path, campaign, source = 'auto') {
  const u = new URL(path.startsWith('http') ? path : SITE + path);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}

export function hourSlotBangkok(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hh}`;
}

export async function getMarketingItems(env, limit = 20) {
  const numbers = await getTopNumbers(env, limit);
  const items = [];
  for (const number of numbers) {
    const raw = await env.SPAM_KV.get(`num:${number}`);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      if ((data.reports || 0) < 1) continue;
      items.push({
        number,
        display: fmtPhone(number),
        reports: data.reports || 0,
        ...assess(data),
        ...identifyCarrier(number),
        url: `${SITE}/check/${number}`,
      });
    } catch { /* skip */ }
  }
  return items;
}

export function buildNumberPost(item, slot) {
  const link = utm(`/check/${item.number}`, 'auto_number', 'telegram');
  const icon = item.verdict === 'danger' ? '🚨' : item.verdict === 'caution' ? '⚠️' : '📞';
  return `${icon} เบอร์ ${item.display} — ${item.label || 'มีรายงาน'}
${item.advice || `ถูกรายงาน ${item.reports} ครั้ง`}
เช็คเบอร์ฟรี 👇
${link}`;
}

export function buildAppPost(slot) {
  const link = utm('/download', 'auto_app', 'telegram');
  return `🛡️ บล็อกสายมิจฉาชีพอัตโนมัติ — ฟรี!
แอป SpamInThai ใช้ฐานข้อมูลเดียวกับเว็บ ก่อนโทรศัพท์จะดัง
ดาวน์โหลด Android 👇
${link}`;
}

export function buildGuidePost(slot) {
  const idx = Math.abs(hashCode(slot)) % GUIDE_LINKS.length;
  const guide = GUIDE_LINKS[idx];
  const link = utm(guide.path, 'auto_guide', 'telegram');
  return `📖 ${guide.title}
อ่านฟรี + เช็คเบอร์มิจฉาชีพได้ทันที 👇
${link}`;
}

export function buildCheckPost(slot) {
  const link = utm('/check', 'auto_check', 'telegram');
  return `🔍 เบอร์นี้ใครโทรมา? เช็คก่อนรับสาย!
ตรวจเบอร์มิจฉาชีพ แก๊งคอลเซ็นเตอร์ ฟรี ไม่ต้องสมัคร
👉 ${link}`;
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

export function pickPostType(slot) {
  const h = Math.abs(hashCode(slot)) % 10;
  if (h < 5) return 'number';
  if (h < 7) return 'app';
  if (h < 9) return 'guide';
  return 'check';
}

export async function pickNextNumber(env, items, slot) {
  for (let i = 0; i < items.length; i++) {
    const idx = (Math.abs(hashCode(slot)) + i) % items.length;
    const item = items[idx];
    const key = `marketing:posted:${item.number}`;
    if (!(await env.SPAM_KV.get(key))) return item;
  }
  return items[0] || null;
}

export async function markPosted(env, number) {
  if (!number) return;
  await env.SPAM_KV.put(`marketing:posted:${number}`, hourSlotBangkok(), {
    expirationTtl: POSTED_TTL,
  });
}

export async function buildPost(env, slot) {
  const type = pickPostType(slot);
  if (type === 'app') return { type, text: buildAppPost(slot), number: null };
  if (type === 'guide') return { type, text: buildGuidePost(slot), number: null };
  if (type === 'check') return { type, text: buildCheckPost(slot), number: null };

  const items = await getMarketingItems(env, 30);
  const item = await pickNextNumber(env, items, slot);
  if (!item) return { type: 'check', text: buildCheckPost(slot), number: null };
  return { type: 'number', text: buildNumberPost(item, slot), number: item.number, item };
}

export async function postTelegram(token, chatId, text) {
  if (!token || !chatId) return { ok: false, skipped: true, reason: 'not_configured' };
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && d.ok, status: r.status, response: d };
}

export async function postDiscord(webhookUrl, text) {
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'not_configured' };
  const r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text.slice(0, 2000) }),
  });
  return { ok: r.ok, status: r.status };
}

export async function submitIndexNow(urls) {
  if (!urls.length) return { ok: true, skipped: true };
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'spaminthai.com',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 100),
      }),
    });
    return { ok: r.ok || r.status === 202, status: r.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function runMarketing(env, config = {}) {
  const slot = config.slot || hourSlotBangkok();
  const post = await buildPost(env, slot);
  const results = { slot, type: post.type, number: post.number || null };

  results.telegram = await postTelegram(
    config.telegramToken || env.TELEGRAM_BOT_TOKEN,
    config.telegramChatId || env.TELEGRAM_CHAT_ID,
    post.text
  );
  results.discord = await postDiscord(config.discordWebhook || env.DISCORD_WEBHOOK_URL, post.text);

  const indexUrls = [SITE + '/check', SITE + '/download'];
  if (post.number) indexUrls.push(`${SITE}/check/${post.number}`);
  results.indexnow = await submitIndexNow(indexUrls);

  if (post.number && (results.telegram?.ok || results.discord?.ok)) {
    await markPosted(env, post.number);
  }

  await env.SPAM_KV.put(`marketing:last-run`, JSON.stringify({
    slot,
    type: post.type,
    number: post.number,
    at: new Date().toISOString(),
    telegram: results.telegram?.ok,
    discord: results.discord?.ok,
  }), { expirationTtl: 30 * 24 * 60 * 60 });

  return { ok: true, post: post.text, results };
}

export async function buildRssXml(env) {
  const items = await getMarketingItems(env, 15);
  const now = new Date().toUTCString();
  const rows = items.map((item) => {
    const link = `${SITE}/check/${item.number}`;
    const title = `เบอร์ ${item.display} — ${item.label || 'มีรายงาน'}`;
    const desc = item.advice || `ถูกรายงาน ${item.reports} ครั้ง — เช็คเบอร์ฟรีที่ SpamInThai`;
    return `    <item>
      <title>${escXml(title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="true">${escXml(link)}</guid>
      <description>${escXml(desc)}</description>
      <pubDate>${now}</pubDate>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SpamInThai — เบอร์มิจฉาชีพอัพเดต</title>
    <link>${SITE}/guide/spam-numbers</link>
    <description>รายการเบอร์โทรศัพท์มิจฉาชีพและสแปมที่ถูกรายงานบ่อย — เช็คเบอร์ฟรี</description>
    <language>th</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${rows}
  </channel>
</rss>`;
}

export async function handleMarketingFeedGet(env) {
  const items = await getMarketingItems(env, 20);
  return new Response(JSON.stringify({
    site: SITE,
    updated: new Date().toISOString(),
    items: items.map((i) => ({
      number: i.number,
      display: i.display,
      reports: i.reports,
      label: i.label,
      verdict: i.verdict,
      url: i.url,
      shareText: buildNumberPost(i, 'feed'),
    })),
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}

export async function handleMarketingRssGet(env) {
  const xml = await buildRssXml(env);
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}

export async function handleMarketingRunPost(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const secret = env.MARKETING_CRON_SECRET;
  if (!secret || token !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    if (request.headers.get('Content-Type')?.includes('json')) {
      body = await request.json();
    }
  } catch { /* empty body ok */ }

  const result = await runMarketing(env, {
    slot: body.slot,
    telegramToken: body.telegram_token,
    telegramChatId: body.telegram_chat_id,
    discordWebhook: body.discord_webhook,
  });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
