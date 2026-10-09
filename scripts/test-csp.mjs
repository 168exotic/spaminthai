#!/usr/bin/env node
/**
 * CSP regression test: script-src has no 'unsafe-inline', so no served HTML (static files
 * or worker-rendered pages) may contain inline executable <script>, on*= handlers or
 * javascript: URLs — and served JS must not build them via innerHTML strings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders } from '../functions/api/_security.js';
import { renderNumberPage } from '../functions/check/render-number-page.js';
import { renderProvincePage, renderThailandIndex } from '../functions/province/render-province-page.js';
import { renderPrefixPage, renderPrefixIndex } from '../functions/prefix/render-prefix-page.js';
import { renderMonthlyPage, renderMonthlyIndex } from '../functions/monthly/render-monthly-page.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };

// Directories not uploaded as static assets (see .assetsignore) or not part of the site.
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'scripts', 'data', 'docs', 'styles', 'terraform', '.github']);
function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), exts, out);
    } else if (exts.some((x) => e.name.endsWith(x))) out.push(path.join(dir, e.name));
  }
  return out;
}

const NON_EXEC_TYPES = /^(application\/ld\+json|application\/json|text\/template)$/i;
export function inlineIssues(html) {
  const issues = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1];
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && NON_EXEC_TYPES.test(type)) continue;
    if (/\bsrc\s*=/i.test(attrs) && !m[2].trim()) continue;
    issues.push('inline <script' + attrs + '>');
  }
  const stripped = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of stripped.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const h = tag[0].match(/\son[a-z]+\s*=/i);
    if (h) issues.push('handler ' + h[0].trim() + ' in ' + tag[0].slice(0, 60));
    if (/\s(href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(tag[0])) issues.push('javascript: URL in ' + tag[0].slice(0, 60));
  }
  return issues;
}

// Self-test of the detector.
check('detector flags inline script', inlineIssues('<script>alert(1)</script>').length === 1);
check('detector flags onclick', inlineIssues('<button onclick="x()">').length === 1);
check('detector flags javascript: href', inlineIssues('<a href="javascript:void 0">').length === 1);
check('detector allows src + ld+json', inlineIssues('<script src="/a.js" defer></script><script type="application/ld+json">{}</script>').length === 0);

// 1) Static HTML that is served.
const htmlFiles = walk(ROOT, ['.html']);
check('found static HTML files', htmlFiles.length > 50, String(htmlFiles.length));
const bad = [];
for (const f of htmlFiles) {
  const issues = inlineIssues(fs.readFileSync(f, 'utf8'));
  if (issues.length) bad.push(path.relative(ROOT, f) + ': ' + issues.join('; '));
}
check('no inline script / on*= / javascript: in static HTML', bad.length === 0, bad.slice(0, 10).join(' | '));

// 2) Served JS must not inject inline handlers or javascript: URLs via HTML strings.
const jsFiles = ['assets', 'admin', path.join('vps', 'www', 'assets')].flatMap((d) => walk(path.join(ROOT, d), ['.js']));
const badJs = [];
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  if (/\son[a-z]+\s*=\s*\\?["'`]/i.test(src.replace(/\/\/.*$/gm, ''))) badJs.push(path.relative(ROOT, f) + ' (on*= in string)');
  if (/["'`]\s*javascript:/i.test(src)) badJs.push(path.relative(ROOT, f) + ' (javascript: URL)');
}
check('served JS builds no inline handlers', badJs.length === 0, badJs.join(' | '));

// 3) Worker-rendered HTML.
const store = new Map([['num:0812345678', JSON.stringify({ reports: 6, categories: { scam: 6 }, lastReport: '2026-09-01T00:00:00Z' })]]);
const env = { SPAM_KV: {
  async get(k) { return typeof k === 'string' ? store.get(k) ?? null : null; },
  async put(k, v) { store.set(k, v); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
} };
const pages = {
  '/check/0812345678': () => renderNumberPage('0812345678', env),
  '/check/0899999999 (no reports)': () => renderNumberPage('0899999999', env),
  '/thailand': () => renderThailandIndex(),
  '/phuket': () => renderProvincePage('phuket', env),
  '/prefix': () => renderPrefixIndex(),
  '/prefix/081': () => renderPrefixPage('081', env),
  '/monthly': () => renderMonthlyIndex(),
  '/monthly/2026-09': () => renderMonthlyPage('2026-09', env, Date.parse('2026-10-09T00:00:00Z')),
};
for (const [name, fn] of Object.entries(pages)) {
  const res = await fn();
  const html = await res.text();
  const issues = inlineIssues(html);
  check(`worker page ${name} (${res.status}) has no inline script/handlers`, res.status === 200 && issues.length === 0, issues.join('; ') || 'status ' + res.status);
}

// 4) CSP: no 'unsafe-inline' in script-src, and _headers matches worker CSP.
const headersFile = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
const staticCsp = (headersFile.match(/Content-Security-Policy:\s*(.+)/) || [])[1]?.trim();
const workerCsp = securityHeaders()['Content-Security-Policy'];
const scriptSrc = (csp) => (csp || '').split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) || '';
check('_headers CSP present', !!staticCsp);
check("_headers script-src has no 'unsafe-inline'", scriptSrc(staticCsp) && !scriptSrc(staticCsp).includes("'unsafe-inline'"), scriptSrc(staticCsp));
check("worker script-src has no 'unsafe-inline'", scriptSrc(workerCsp) && !scriptSrc(workerCsp).includes("'unsafe-inline'"), scriptSrc(workerCsp));
check("no 'unsafe-eval' in script-src", !scriptSrc(staticCsp).includes("'unsafe-eval'"));
check('worker CSP identical to _headers CSP', staticCsp === workerCsp, `\n_headers: ${staticCsp}\nworker:   ${workerCsp}`);
check('script-src allows AdSense loader', scriptSrc(staticCsp).includes('https://pagead2.googlesyndication.com'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
