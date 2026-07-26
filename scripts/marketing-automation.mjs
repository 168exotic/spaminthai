#!/usr/bin/env node
/**
 * Marketing automation runner — เรียกจาก GitHub Actions หรือรันเอง
 *
 * Usage:
 *   node scripts/marketing-automation.mjs
 *   node scripts/marketing-automation.mjs --local   # โพสต์ตรง ไม่ผ่าน API
 *
 * Env (GitHub Secrets / Cloudflare):
 *   MARKETING_CRON_SECRET  — สำหรับเรียก POST /api/marketing/run
 *   TELEGRAM_BOT_TOKEN     — Bot token จาก @BotFather
 *   TELEGRAM_CHAT_ID       — chat/channel id (เช่น -1001234567890)
 *   DISCORD_WEBHOOK_URL    — Discord webhook (optional)
 *   SITE_URL               — default https://spaminthai.com
 */

const SITE = (process.env.SITE_URL || 'https://spaminthai.com').replace(/\/$/, '');
const LOCAL = process.argv.includes('--local');

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
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  };

  const result = await runMarketing(env);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log(`Marketing automation — ${new Date().toISOString()}`);
  console.log(`Site: ${SITE} | mode: ${LOCAL ? 'local' : 'api'}`);

  if (LOCAL) {
    await runLocal();
  } else {
    await runViaApi();
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
