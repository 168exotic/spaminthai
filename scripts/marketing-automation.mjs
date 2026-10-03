#!/usr/bin/env node
/**
 * Marketing automation runner — เรียกจาก GitHub Actions หรือรันเอง
 *
 * Usage:
 *   node scripts/marketing-automation.mjs
 *   node scripts/marketing-automation.mjs --local   # dry run ด้วยข้อมูลจำลอง (ไม่โพสต์จริง)
 *   node scripts/marketing-automation.mjs --kv      # อ่าน KV จริงผ่าน Cloudflare API แล้วโพสต์ตรง
 *
 * Env (GitHub Secrets / Cloudflare):
 *   MARKETING_CRON_SECRET  — สำหรับเรียก POST /api/marketing/run
 *   TELEGRAM_BOT_TOKEN     — Bot token จาก @BotFather
 *   TELEGRAM_CHAT_ID       — chat/channel id (เช่น -1001234567890)
 *   DISCORD_WEBHOOK_URL    — Discord webhook (optional)
 *   SITE_URL               — default https://spaminthai.com
 *   CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / KV_NAMESPACE_ID — สำหรับ --kv
 */

import { pathToFileURL } from 'node:url';

const SITE = (process.env.SITE_URL || 'https://spaminthai.com').replace(/\/$/, '');
const LOCAL = process.argv.includes('--local');
const KV = process.argv.includes('--kv');

/** Minimal KV binding backed by the Cloudflare REST API (get / put / list). */
export function cloudflareKv({ token, accountId, namespaceId }) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
  const auth = { Authorization: `Bearer ${token}` };
  return {
    async get(key) {
      const r = await fetch(`${base}/values/${encodeURIComponent(key)}`, { headers: auth });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`KV get ${key}: HTTP ${r.status}`);
      return r.text();
    },
    async put(key, value, opts = {}) {
      const q = opts.expirationTtl ? `?expiration_ttl=${opts.expirationTtl}` : '';
      const r = await fetch(`${base}/values/${encodeURIComponent(key)}${q}`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'text/plain' },
        body: value,
      });
      if (!r.ok) throw new Error(`KV put ${key}: HTTP ${r.status}`);
    },
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      const u = new URL(`${base}/keys`);
      if (prefix) u.searchParams.set('prefix', prefix);
      if (cursor) u.searchParams.set('cursor', cursor);
      u.searchParams.set('limit', String(Math.max(10, Math.min(limit, 1000))));
      const r = await fetch(u, { headers: auth });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(`KV list ${prefix}: HTTP ${r.status}`);
      const next = d.result_info?.cursor || '';
      return { keys: d.result || [], list_complete: !next, cursor: next || undefined };
    },
  };
}

async function runKv() {
  const { runMarketing } = await import('../functions/api/marketing.js');
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error('CLOUDFLARE_API_TOKEN not set — cannot read KV');
    process.exit(1);
  }
  const env = {
    SPAM_KV: cloudflareKv({
      token,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '2fa3f2f325707bab89ef1c7452d3adb8',
      namespaceId: process.env.KV_NAMESPACE_ID || '0a479fd6d75c431b8e7018caf819f7b2',
    }),
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  };
  const result = await runMarketing(env);
  const r = result.results;
  console.log(JSON.stringify({ type: r.type, number: r.number, telegram: r.telegram?.ok, telegramError: r.telegram?.response?.description, discord: r.discord?.ok, indexnow: r.indexnow?.ok }, null, 2));
  console.log('\n--- Post ---\n' + result.post);
  const wanted = [process.env.TELEGRAM_BOT_TOKEN && r.telegram, process.env.DISCORD_WEBHOOK_URL && r.discord].filter(Boolean);
  if (wanted.length && !wanted.some((x) => x.ok)) {
    console.error('Posting failed on every configured channel');
    process.exit(1);
  }
  return result;
}

async function runViaApi() {
  const secret = process.env.MARKETING_CRON_SECRET;
  if (!secret) {
    console.error('MARKETING_CRON_SECRET not set — cannot call /api/marketing/run');
    console.error('Set secret in GitHub Actions or Cloudflare env, or use --local');
    process.exit(1);
  }

  const r = await fetch(`${SITE}/api/marketing/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      telegram_token: process.env.TELEGRAM_BOT_TOKEN || undefined,
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID || undefined,
      discord_webhook: process.env.DISCORD_WEBHOOK_URL || undefined,
    }),
  });

  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!r.ok) {
    console.error(`API error HTTP ${r.status}:`, data);
    process.exit(1);
  }

  console.log('Marketing run OK');
  console.log('Type:', data.results?.type || data.type);
  console.log('Telegram:', data.results?.telegram?.ok ?? data.telegram?.ok);
  console.log('Discord:', data.results?.discord?.ok ?? data.discord?.ok);
  console.log('IndexNow:', data.results?.indexnow?.ok ?? data.indexnow?.ok);
  if (data.post) console.log('\n--- Post ---\n' + data.post);
  return data;
}

async function runLocal() {
  const { runMarketing } = await import('../functions/api/marketing.js');

  const mockKv = new Map();
  const env = {
    SPAM_KV: {
      async get(key) {
        if (key === 'seo:top-numbers') {
          return JSON.stringify([
            { number: '021365777', reports: 12 },
            { number: '0812345678', reports: 5 },
          ]);
        }
        if (key.startsWith('num:')) {
          const n = key.slice(4);
          const reports = n === '021365777' ? 12 : 5;
          return JSON.stringify({
            reports,
            categories: { callcenter: reports - 1, scam: 1 },
            lastReport: new Date().toISOString(),
          });
        }
        return mockKv.get(key) ?? null;
      },
      async put(key, val) { mockKv.set(key, val); },
      async list() { return { keys: [], list_complete: true }; },
    },
    // Dry run: mock numbers must never reach real channels.
    TELEGRAM_BOT_TOKEN: undefined,
    TELEGRAM_CHAT_ID: undefined,
    DISCORD_WEBHOOK_URL: undefined,
  };

  const result = await runMarketing(env);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log(`Marketing automation — ${new Date().toISOString()}`);
  console.log(`Site: ${SITE} | mode: ${KV ? 'kv' : LOCAL ? 'local (dry run)' : 'api'}`);

  if (KV) {
    await runKv();
  } else if (LOCAL) {
    await runLocal();
  } else {
    await runViaApi();
  }

  console.log('Done.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((err) => {
  console.error(err);
  process.exit(1);
});
