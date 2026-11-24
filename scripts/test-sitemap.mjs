#!/usr/bin/env node
/** Unit tests for sitemap helpers (no KV). */

import { buildSitemapXml, LIST_NUMBER_PAGES } from '../functions/api/sitemap.js';

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
      // Area code 02 (Bangkok metro) has enough reported landlines to be indexable; 034 has one (below the threshold).
      if (prefix === 'num:02') return { keys: ['021365777', '021365778', '021365779', '021365780', '021365781'].map((n) => ({ name: 'num:' + n })), list_complete: true };
      if (prefix === 'num:034') return { keys: [{ name: 'num:034111222' }], list_complete: true };
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
  check('number pages follow LIST_NUMBER_PAGES', xml.includes('/check/021365777') === LIST_NUMBER_PAGES);
  check('xml has lastmod', xml.includes('<lastmod>'));
  check('xml has /thailand index', xml.includes('<loc>https://spaminthai.com/thailand</loc>'));
  check('xml lists a province whose area code has reports', xml.includes('<loc>https://spaminthai.com/bangkok</loc>'));
  check('xml omits a province below the report threshold (served noindex)', !xml.includes('<loc>https://spaminthai.com/nakhon-pathom</loc>'));
  check('xml omits a province with no reports (served noindex)', !xml.includes('<loc>https://spaminthai.com/phuket</loc>'));
  check('xml omits provinces that share a code with the main one', !xml.includes('<loc>https://spaminthai.com/nonthaburi</loc>'));
  check('xml escapes ok', !xml.includes('&amp;amp;'));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
