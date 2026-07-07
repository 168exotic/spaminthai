#!/usr/bin/env node
/**
 * Bulk seed spam numbers into Cloudflare KV (SPAM_KV).
 *
 * Requires account-scoped token with Workers KV Storage Edit.
 * See docs/TOKEN-POLICY.md if verify-token.js fails.
 *
 * Usage:
 *   node scripts/seed-spam-numbers.js data/spam-numbers-sample.json
 */

const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '2fa3f2f325707bab89ef1c7452d3adb8';
const NAMESPACE_ID = process.env.KV_NAMESPACE_ID || 'd1417790ca5841bebf80cbc25443e070';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BATCH_SIZE = 1000;

const VALID_CATS = new Set(['scam', 'callcenter', 'ads', 'loan', 'safe']);

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN to your API token secret.');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/seed-spam-numbers.js <numbers.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
if (!Array.isArray(raw)) {
  console.error('Input must be a JSON array of {number, category, reports?} objects.');
  process.exit(1);
}

function normalize(entry) {
  const number = String(entry.number || '').replace(/\D/g, '');
  const category = entry.category;
  if (number.length < 9 || number.length > 10) {
    throw new Error(`Invalid number: ${entry.number}`);
  }
  if (!VALID_CATS.has(category)) {
    throw new Error(`Invalid category for ${number}: ${category}`);
  }
  const reports = Number(entry.reports) > 0 ? Number(entry.reports) : 5;
  return {
    key: `num:${number}`,
    value: JSON.stringify({
      reports,
      categories: { [category]: reports },
      lastReport: entry.lastReport || Date.now()
    })
  };
}

async function bulkPut(batch) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/bulk`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batch)
    }
  );
  const body = await res.json();
  if (!body.success) {
    const msg = body.errors?.map((e) => e.message).join('; ') || res.statusText;
    throw new Error(`KV bulk write failed: ${msg}`);
  }
  return body.result;
}

async function main() {
  const pairs = raw.map(normalize);
  console.log(`Seeding ${pairs.length} numbers into namespace ${NAMESPACE_ID}`);

  let written = 0;
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    const result = await bulkPut(batch);
    written += result.successful_key_count ?? batch.length;
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.successful_key_count ?? batch.length} keys`);
    if (result.unsuccessful_keys?.length) {
      console.warn('  failed keys:', result.unsuccessful_keys.join(', '));
    }
  }

  console.log(`Done. ${written} keys written.`);
}

main().catch((err) => {
  console.error(err.message);
  console.error('If you see a permission error, read docs/TOKEN-POLICY.md and run scripts/verify-token.js first.');
  process.exit(1);
});
