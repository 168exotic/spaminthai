#!/usr/bin/env node
/** Verifies Cloudflare Web Analytics is installed on every public HTML page. */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderNumberPage } from '../functions/check/render-number-page.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TOKEN = '61b52e6dd1dc4e3682ac12f84342cbbb';
const SNIPPET = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${TOKEN}"}'></script><!-- End Cloudflare Web Analytics -->`;

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok  - ${label}`);
  } else {
    failed++;
    console.error(`  FAIL - ${label}${detail ? ` (${detail})` : ''}`);
  }
}

async function htmlFiles(directory = '') {
  const entries = await readdir(`${ROOT}${directory}`, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => `${directory}${entry.name}`);
}

function verifyHtml(label, html) {
  const occurrences = html.split(SNIPPET).length - 1;
  check(`${label} has one analytics beacon`, occurrences === 1, `found=${occurrences}`);
  check(`${label} loads beacon before </body>`, html.indexOf(SNIPPET) < html.indexOf('</body>'));
}

const publicFiles = [
  ...(await htmlFiles()),
  ...(await htmlFiles('blog/')),
  ...(await htmlFiles('guide/')),
  ...(await htmlFiles('site/')),
];

for (const path of publicFiles) {
  verifyHtml(path, await readFile(`${ROOT}${path}`, 'utf8'));
}

const dynamicResponse = await renderNumberPage('0812345678', {
  SPAM_KV: { get: async () => null },
});
verifyHtml('/check/:number', await dynamicResponse.text());

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
