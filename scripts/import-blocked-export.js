#!/usr/bin/env node
/**
 * Convert a SpamInThai app blocked-calls export (TSV) to seed JSON.
 *
 * Format: <id>\t<+66phone>\t<category>\t<reports>
 *
 * Usage:
 *   node scripts/import-blocked-export.js path/to/export.txt [out.json]
 */

const fs = require('fs');
const path = require('path');

const CATEGORY_MAP = {
  unknown: 'scam',
  scam: 'scam',
  callcenter: 'callcenter',
  ads: 'ads',
  loan: 'loan',
  safe: 'safe'
};

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('0')) {
    return digits;
  }
  return digits;
}

function parseExport(text) {
  const byNumber = new Map();

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split('\t');
    if (parts.length < 2) {
      continue;
    }

    const number = normalizePhone(parts[1]);
    if (number.length < 9 || number.length > 10) {
      throw new Error(`Invalid phone: ${parts[1]} -> ${number}`);
    }

    const rawCategory = (parts[2] || 'unknown').toLowerCase();
    const category = CATEGORY_MAP[rawCategory] || 'scam';
    const rowReports = Number(parts[3]) > 0 ? Number(parts[3]) : 1;

    const existing = byNumber.get(number);
    if (existing) {
      existing.reports += rowReports;
      existing.categories[category] = (existing.categories[category] || 0) + rowReports;
    } else {
      byNumber.set(number, {
        number,
        category,
        reports: rowReports,
        categories: { [category]: rowReports }
      });
    }
  }

  return [...byNumber.values()].sort((a, b) => a.number.localeCompare(b.number));
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/import-blocked-export.js <export.txt> [out.json]');
    process.exit(1);
  }

  const outPath = process.argv[3] || path.join('data', `spam-blocked-${new Date().toISOString().slice(0, 10)}.json`);
  const text = fs.readFileSync(path.resolve(inputPath), 'utf8');
  const rows = parseExport(text);

  const seedRows = rows.map(({ number, category, reports }) => ({ number, category, reports }));
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(seedRows, null, 2) + '\n');

  console.log(`Parsed ${rows.length} unique numbers -> ${outPath}`);
  console.log(`Total report weight: ${rows.reduce((sum, row) => sum + row.reports, 0)}`);
}

main();
