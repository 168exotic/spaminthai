#!/usr/bin/env node
/**
 * SpamInThai Discord bot:
 * - IT news (Blognone + TechCrunch) every 30 min
 * - YouTube Shorts — post immediately on new upload (multi-channel)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Parser from 'rss-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RSS_FEEDS = [
  { name: 'Blognone', url: 'https://www.blognone.com/atom.xml' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
];

const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const POSTED_FILE = join(DATA_DIR, 'posted-urls.json');
const YOUTUBE_STATE_FILE = join(DATA_DIR, 'youtube-state.json');
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

function parseYoutubeChannels() {
  const raw = process.env.YOUTUBE_CHANNELS;
  if (raw) {
    return raw.split(',').map((part) => {
      const [id, ...nameParts] = part.trim().split('|');
      return { id: id.trim(), name: (nameParts.join('|') || id).trim() };
    }).filter((c) => c.id);
  }
  const id = process.env.YOUTUBE_CHANNEL_ID;
  if (id) {
    return [{ id, name: process.env.YOUTUBE_CHANNEL_NAME || id }];
  }
  return [];
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

function emptyChannelState() {
  return { seeded: false, lastVideoId: null, posted: [] };
}

function loadYoutubeStates() {
  if (!existsSync(YOUTUBE_STATE_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(YOUTUBE_STATE_FILE, 'utf8'));
    if (raw && typeof raw.seeded === 'boolean') {
      const legacyId = process.env.YOUTUBE_CHANNEL_ID || 'UCsaEUkdeK07dUuKapR67gkA';
      return {
        [legacyId]: {
          seeded: raw.seeded,
          lastVideoId: raw.lastVideoId,
          posted: raw.posted || [],
        },
      };
    }
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveYoutubeStates(states) {
  mkdirSync(DATA_DIR, { recursive: true });
  for (const id of Object.keys(states)) {
    states[id].posted = (states[id].posted || []).slice(-MAX_POSTED);
  }
  writeFileSync(YOUTUBE_STATE_FILE, JSON.stringify(states, null, 2));
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

function videoIdFromEntry(entry) {
  const fromId = String(entry.id || '').replace(/^yt:video:/, '');
  if (/^[a-zA-Z0-9_-]{11}$/.test(fromId)) return fromId;
  const link = entry.link || '';
  const m = link.match(/(?:shorts\/|v=|\/v\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function shortsUrl(videoId) {
  return `https://www.youtube.com/shorts/${videoId}`;
}

function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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

async function fetchYoutubeShorts(channelId) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const parser = new Parser({ timeout: 15000 });
  const parsed = await parser.parseURL(feedUrl);
  const shorts = [];

  for (const entry of parsed.items || []) {
    const link = entry.link || '';
    if (!link.includes('/shorts/')) continue;
    const videoId = videoIdFromEntry(entry);
    if (!videoId) continue;
    shorts.push({
      videoId,
      title: stripHtml(entry.title),
      link: shortsUrl(videoId),
      thumbnail: thumbnailUrl(videoId),
      pub: entry.isoDate || entry.pubDate || '',
      ts: entry.isoDate ? Date.parse(entry.isoDate) || 0 : 0,
    });
  }

  shorts.sort((a, b) => b.ts - a.ts);
  return shorts;
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

function buildNewsEmbed(item) {
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

function buildShortEmbed(short, channelName) {
  return {
    title: truncate(short.title, 256),
    url: short.link,
    description: `คลิป Short ใหม่จาก **${channelName}**`,
    color: 0xff0000,
    image: { url: short.thumbnail },
    footer: { text: `${channelName} • YouTube Shorts` },
    timestamp: short.pub ? new Date(short.pub).toISOString() : new Date().toISOString(),
  };
}

export async function postNewsOnce() {
  loadEnvFile();
  const token = requireEnv('DISCORD_BOT_TOKEN');
  const channelId = requireEnv('DISCORD_CHANNEL_ID');

  const posted = loadPosted();
  const items = await fetchNewsItems();
  const item = pickItem(items, posted);

  if (!item) {
    console.log('[news] no fresh items');
    return { ok: false, reason: 'no_fresh_items' };
  }

  await discordRequest(token, `/channels/${channelId}/messages`, {
    content: '📰 **ข่าวไอที**',
    embeds: [buildNewsEmbed(item)],
  });

  posted.add(item.link);
  savePosted(posted);
  console.log(`[news] OK — ${item.source}: ${item.title}`);
  return { ok: true, item };
}

export async function checkYoutubeChannel(channel, states) {
  const token = requireEnv('DISCORD_BOT_TOKEN');
  const discordChannelId = requireEnv('DISCORD_CHANNEL_ID');
  const { id: channelId, name: channelName } = channel;

  const shorts = await fetchYoutubeShorts(channelId);
  if (!shorts.length) {
    console.log(`[youtube:${channelName}] no shorts in feed`);
    return { ok: false, reason: 'no_shorts' };
  }

  const state = states[channelId] || emptyChannelState();
  const postedSet = new Set(state.posted || []);
  const latest = shorts[0];

  if (!state.seeded) {
    state.seeded = true;
    state.lastVideoId = latest.videoId;
    for (const s of shorts) postedSet.add(s.videoId);
    state.posted = [...postedSet];
    states[channelId] = state;
    console.log(`[youtube:${channelName}] seeded — ${shorts.length} shorts tracked (no post)`);
    return { ok: false, reason: 'seeded' };
  }

  const newShorts = shorts.filter((s) => !postedSet.has(s.videoId));
  if (!newShorts.length) {
    states[channelId] = state;
    return { ok: false, reason: 'no_new_shorts' };
  }

  newShorts.sort((a, b) => a.ts - b.ts);
  let posted = 0;

  for (const short of newShorts) {
    await discordRequest(token, `/channels/${discordChannelId}/messages`, {
      content: `🎬 **คลิป Short ใหม่**\n${short.link}`,
      embeds: [buildShortEmbed(short, channelName)],
    });
    postedSet.add(short.videoId);
    state.lastVideoId = short.videoId;
    console.log(`[youtube:${channelName}] OK — ${short.title}`);
    posted++;
  }

  state.posted = [...postedSet];
  states[channelId] = state;
  return { ok: true, posted };
}

export async function checkYoutubeShorts() {
  loadEnvFile();
  const channels = parseYoutubeChannels();
  if (!channels.length) {
    console.log('[youtube] no channels configured');
    return { ok: false, reason: 'no_channel' };
  }

  const states = loadYoutubeStates();
  let totalPosted = 0;

  for (const channel of channels) {
    try {
      const result = await checkYoutubeChannel(channel, states);
      if (result.ok) totalPosted += result.posted || 0;
    } catch (err) {
      console.error(`[youtube:${channel.name}] error:`, err.message);
    }
  }

  saveYoutubeStates(states);
  return { ok: totalPosted > 0, posted: totalPosted };
}

/** @deprecated use postNewsOnce */
export async function postOnce() {
  return postNewsOnce();
}

async function main() {
  const once = process.argv.includes('--once');
  const youtubeOnly = process.argv.includes('--youtube');
  loadEnvFile();

  const newsIntervalMin = Number(process.env.POST_INTERVAL_MINUTES || 30);
  const newsIntervalMs = Math.max(5, newsIntervalMin) * 60 * 1000;
  const youtubePollSec = Number(process.env.YOUTUBE_POLL_SECONDS || 14400);
  const youtubePollMs = Math.max(60, youtubePollSec) * 1000;

  const channels = parseYoutubeChannels();
  const channelList = channels.map((c) => c.name).join(', ') || '(none)';
  console.log(`[boot] news every ${newsIntervalMin} min | youtube every ${youtubePollSec}s | ${channelList}`);

  const runNews = async () => {
    try {
      await postNewsOnce();
    } catch (err) {
      console.error('[news] error:', err.message);
    }
  };

  const runYoutube = async () => {
    try {
      await checkYoutubeShorts();
    } catch (err) {
      console.error('[youtube] error:', err.message);
    }
  };

  if (youtubeOnly) {
    await runYoutube();
    return;
  }

  await runYoutube();
  if (!once) {
    setInterval(runYoutube, youtubePollMs);
  }

  if (!process.argv.includes('--youtube-only')) {
    await runNews();
    if (!once) {
      setInterval(runNews, newsIntervalMs);
    }
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
