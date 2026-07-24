#!/usr/bin/env node
// Import spaminthai blocked-calls TSV export into SPAM_KV.
// Format: <ts_ms>\t<+66number>\t<category>\t<score>
//
// Usage:
//   node scripts/import-blocked-export.mjs path/to/export.txt

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '2fa3f2f325707bab89ef1c7452d3adb8';
const NAMESPACE_ID = process.env.KV_NAMESPACE_ID || 'd1417790ca5841bebf80cbc25443e070';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BATCH_SIZE = 100;

const CAT_MAP = {
  unknown: 'callcenter',
  scam: 'scam',
  callcenter: 'callcenter',
  ads: 'ads',
  loan: 'loan',
  safe: 'safe'
};

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/import-blocked-export.mjs <export.txt>');
  process.exit(1);
}

function normalizeNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('66')) digits = '0' + digits.slice(2);
  if (digits.length === 9 && !digits.startsWith('0')) digits = '0' + digits;
  return digits;
}

function parseFile(path) {
  const lines = readFileSync(resolve(path), 'utf8').split(/\r?\n/);
  const byNumber = new Map();

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const ts = Number(parts[0]) || Date.now();
    const number = normalizeNumber(parts[1]);
    const rawCat = (parts[2] || 'unknown').toLowerCase();
    const category = CAT_MAP[rawCat] || 'callcenter';

    if (number.length < 9 || number.length > 10) {
      console.warn('skip invalid:', parts[1], '->', number);
      continue;
    }

    const existing = byNumber.get(number) || {
      reports: 0,
      categories: {},
      lastReport: 0
    };
    existing.reports += 1;
    existing.categories[category] = (existing.categories[category] || 0) + 1;
    existing.lastReport = Math.max(existing.lastReport, ts);
    byNumber.set(number, existing);
  }

  return byNumber;
}

async function kvGet(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${key}: ${res.status}`);
  return JSON.parse(await res.text());
}

function merge(existing, incoming) {
  if (!existing) {
    return {
      reports: incoming.reports,
      categories: { ...incoming.categories },
      lastReport: incoming.lastReport
    };
  }
  const categories = { ...existing.categories };
  for (const [cat, n] of Object.entries(incoming.categories)) {
    categories[cat] = (categories[cat] || 0) + n;
  }
  return {
    reports: (existing.reports || 0) + incoming.reports,
    categories,
    lastReport: Math.max(existing.lastReport || 0, incoming.lastReport)
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
    throw new Error(body.errors?.map((e) => e.message).join('; ') || res.statusText);
  }
  return body.result;
}

async function main() {
  const parsed = parseFile(inputPath);
  console.log(`Parsed ${parsed.size} unique numbers from export`);

  const entries = [...parsed.entries()];
  let written = 0;
  let merged = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const slice = entries.slice(i, i + BATCH_SIZE);
    const batch = [];

    for (const [number, incoming] of slice) {
      const key = `num:${number}`;
      const existing = await kvGet(key);
      if (existing) merged += 1;
      const data = merge(existing, incoming);
      batch.push({ key, value: JSON.stringify(data) });
    }

    const result = await bulkPut(batch);
    written += result.successful_key_count ?? batch.length;
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} keys (${merged} merged so far)`);
  }

  console.log(`Done. ${written} keys written (${merged} merged with existing data).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
