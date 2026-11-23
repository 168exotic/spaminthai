#!/usr/bin/env node
/** Unit tests for sitemap helpers (no KV). */

import { buildSitemapXml } from '../functions/api/sitemap.js';

const mockEnv = {
  SPAM_KV: {
    async get(key) {
      if (key === 'seo:top-numbers') {
        return JSON.stringify([
          { number: '021365777', reports: 12 },
          { number: '0812345678', reports: 3 },
        ]);
      }
      return null;
    },
    async list({ prefix } = {}) {
      // Only area code 02 (Bangkok metro) has a reported landline in this mock.
      if (prefix === 'num:02') return { keys: [{ name: 'num:021365777' }], list_complete: true };
      return { keys: [], list_complete: true };
    },
    async put() {},
    async delete() {},
  },
};

let passed = 0;
let failed = 0;

function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  ok  - ${label}`);
    passed++;
  } else {
    console.error(`  FAIL - ${label}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function main() {
  const xml = await buildSitemapXml(mockEnv);
  check('xml has urlset', xml.includes('<urlset'));
  check('xml has homepage', xml.includes('<loc>https://spaminthai.com/</loc>'));
  check('xml has /check', xml.includes('<loc>https://spaminthai.com/check</loc>'));
  check('xml has guide/check-phone', xml.includes('/guide/check-phone'));
  check('xml has top number page', xml.includes('/check/021365777'));
  check('xml has lastmod', xml.includes('<lastmod>'));
  check('xml has /thailand index', xml.includes('<loc>https://spaminthai.com/thailand</loc>'));
  check('xml lists a province whose area code has reports', xml.includes('<loc>https://spaminthai.com/bangkok</loc>'));
  check('xml omits a province with no reports (served noindex)', !xml.includes('<loc>https://spaminthai.com/phuket</loc>'));
  check('xml omits provinces that share a code with the main one', !xml.includes('<loc>https://spaminthai.com/nonthaburi</loc>'));
  check('xml escapes ok', !xml.includes('&amp;amp;'));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
