#!/usr/bin/env node
/**
 * SpamInThai Discord IT news bot — posts fresh tech headlines every 30 minutes.
 * Runs on VPS via systemd (see install.sh).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Parser from 'rss-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RSS_FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'Hacker News', url: 'https://hnrss.org/newest?points=30' },
  { name: 'BBC Tech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
];

const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const POSTED_FILE = join(DATA_DIR, 'posted-urls.json');
const MAX_POSTED = 600;
const DISCORD_API = 'https://discord.com/api/v10';

function loadEnvFile() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

function loadPosted() {
  if (!existsSync(POSTED_FILE)) return new Set();
  try {
    const arr = JSON.parse(readFileSync(POSTED_FILE, 'utf8'));
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function savePosted(set) {
  mkdirSync(DATA_DIR, { recursive: true });
  const arr = [...set].slice(-MAX_POSTED);
  writeFileSync(POSTED_FILE, JSON.stringify(arr, null, 2));
}

function truncate(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

async function fetchNewsItems() {
  const parser = new Parser({ timeout: 15000 });
  const items = [];

  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        for (const entry of (parsed.items || []).slice(0, 8)) {
          const link = entry.link || entry.guid;
          if (!link || !entry.title) continue;
          const pub = entry.isoDate || entry.pubDate || '';
          items.push({
            source: feed.name,
            title: stripHtml(entry.title),
            link,
            summary: truncate(stripHtml(entry.contentSnippet || entry.content || ''), 280),
            pub,
            ts: pub ? Date.parse(pub) || 0 : 0,
          });
        }
      } catch (err) {
        console.warn(`[rss] ${feed.name}: ${err.message}`);
      }
    }),
  );

  items.sort((a, b) => b.ts - a.ts);
  return items;
}

function pickItem(items, posted) {
  for (const item of items) {
    if (!posted.has(item.link)) return item;
  }
  return null;
}

async function discordRequest(token, path, body) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord ${res.status}: ${text}`);
  }
  return res.json();
}

function buildEmbed(item) {
  const fields = [{ name: 'แหล่งข่าว', value: item.source, inline: true }];
  if (item.summary) {
    fields.push({ name: 'สรุป', value: item.summary, inline: false });
  }
  return {
    title: truncate(item.title, 256),
    url: item.link,
    description: 'อัปเดตข่าวไอทีล่าสุด — SpamInThai Bot',
    color: 0x5865f2,
    fields,
    footer: { text: 'spaminthai • IT news' },
    timestamp: item.pub ? new Date(item.pub).toISOString() : new Date().toISOString(),
  };
}

export async function postOnce() {
  loadEnvFile();
  const token = requireEnv('DISCORD_BOT_TOKEN');
  const channelId = requireEnv('DISCORD_CHANNEL_ID');

  const posted = loadPosted();
  const items = await fetchNewsItems();
  const item = pickItem(items, posted);

  if (!item) {
    console.log('[post] no fresh items (all recent links already posted)');
    return { ok: false, reason: 'no_fresh_items' };
  }

  await discordRequest(token, `/channels/${channelId}/messages`, {
    content: '📰 **ข่าวไอที**',
    embeds: [buildEmbed(item)],
  });

  posted.add(item.link);
  savePosted(posted);
  console.log(`[post] OK — ${item.source}: ${item.title}`);
  return { ok: true, item };
}

async function main() {
  const once = process.argv.includes('--once');
  loadEnvFile();

  const intervalMin = Number(process.env.POST_INTERVAL_MINUTES || 30);
  const intervalMs = Math.max(5, intervalMin) * 60 * 1000;

  console.log(`[boot] Discord IT news bot — interval ${intervalMin} min`);

  const run = async () => {
    try {
      await postOnce();
    } catch (err) {
      console.error('[post] error:', err.message);
    }
  };

  await run();
  if (once) return;

  setInterval(run, intervalMs);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
