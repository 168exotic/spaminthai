#!/usr/bin/env node
/**
 * Cloudflare Web Analytics beacon test.
 *
 * The worker appends the beacon to <head> of every HTML response so that all pages are
 * counted, not just the homepage. Node has no HTMLRewriter, so this installs a minimal
 * stand-in that performs the same append, then drives the real worker fetch handler with a
 * mocked env.ASSETS. That covers the parts this repo owns: which responses get the beacon,
 * which are skipped, and that the tag lands inside <head>. The lol-html engine itself is
 * Cloudflare's.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (l, c, d = '') => { if (c) { console.log('  ok  - ' + l); passed++; } else { console.error('  FAIL - ' + l + (d ? ' (' + d + ')' : '')); failed++; } };

const TOKEN = '61b52e6dd1dc4e3682ac12f84342cbbb';

// The token must be the one configured in Cloudflare Web Analytics, in exactly one place.
const workerSrc = readFileSync(path.join(ROOT, '_worker.js'), 'utf8');
const tokenHits = workerSrc.split(TOKEN).length - 1;
check('beacon token defined once in _worker.js', tokenHits === 1, String(tokenHits));
check('no stale beacon hardcoded in index.html', !readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('cloudflareinsights'));

// CSP must allow the beacon to load and to report.
const headersFile = readFileSync(path.join(ROOT, '_headers'), 'utf8');
const { securityHeaders } = await import('../functions/api/_security.js');
const workerCsp = securityHeaders()['Content-Security-Policy'];
for (const [label, csp] of [['_headers', headersFile], ['worker', workerCsp]]) {
  check(`${label} script-src allows static.cloudflareinsights.com`, csp.includes('https://static.cloudflareinsights.com'));
  check(`${label} connect-src allows cloudflareinsights.com`, csp.includes('https://cloudflareinsights.com'));
}

/** Minimal HTMLRewriter: buffers the body and appends inside the matched element's end tag. */
class StubRewriter {
  constructor() { this.handlers = []; }
  on(selector, handlers) { this.handlers.push([selector, handlers]); return this; }
  transform(response) {
    const self = this;
    const body = response.__text ?? null;
    const out = (async () => {
      let html = body != null ? body : await response.clone().text();
      for (const [selector, h] of self.handlers) {
        if (!h.element) continue;
        const close = '</' + selector + '>';
        const at = html.indexOf(close);
        if (at === -1) continue;
        let added = '';
        h.element({
          append(content) { added += content; },
          setInnerContent() { /* not used here */ },
        });
        html = html.slice(0, at) + added + html.slice(at);
      }
      return html;
    })();
    const res = new Response(null, { status: response.status, headers: response.headers });
    res.__pending = out;
    return res;
  }
}
globalThis.HTMLRewriter = StubRewriter;

const PAGE = '<!doctype html><html><head><title>t</title></head><body>hi</body></html>';
const store = new Map([['num:0812345678', JSON.stringify({ reports: 6, categories: { scam: 6 }, lastReport: '2026-09-01T00:00:00Z' })]]);
const env = {
  SPAM_KV: {
    async get(k) { return typeof k === 'string' ? store.get(k) ?? null : null; },
    async put(k, v) { store.set(k, v); },
    async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  },
  ASSETS: {
    async fetch(req) {
      const p = new URL(req.url).pathname;
      const type = p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'application/javascript' : p.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8';
      const isHtml = type.startsWith('text/html');
      const res = new Response(isHtml ? PAGE : 'x', { status: 200, headers: { 'Content-Type': type } });
      if (isHtml) res.__text = PAGE;
      return res;
    },
  },
};

const { default: worker } = await import('../_worker.js');
const bodyOf = async (res) => (res.__pending ? res.__pending : res.text());
const call = async (p) => {
  const res = await worker.fetch(new Request('https://spaminthai.com' + p), env, { waitUntil() {} });
  return { res, text: await bodyOf(res) };
};

// Static HTML pages served through env.ASSETS, and worker-rendered pages, all get the beacon.
for (const p of ['/privacy', '/news-1.html', '/report.html', '/404-missing', '/check/0812345678', '/thailand', '/prefix/081', '/monthly']) {
  const { text } = await call(p);
  const hits = text.split(TOKEN).length - 1;
  const inHead = /<head\b[\s\S]*cloudflareinsights[\s\S]*<\/head>/i.test(text);
  check(`HTML ${p}: exactly one beacon, inside <head>`, hits === 1 && inHead, `hits=${hits} inHead=${inHead}`);
}

// Admin stays untracked so staff visits are not counted as site traffic.
for (const p of ['/admin', '/admin/', '/admin/tips.html']) {
  const { text } = await call(p);
  check(`admin ${p}: no beacon`, !text.includes(TOKEN));
}

// Non-HTML responses are left byte-for-byte alone.
for (const p of ['/assets/tailwind.css', '/assets/logo.png', '/api/version']) {
  const { text } = await call(p);
  check(`non-HTML ${p}: untouched`, !text.includes('cloudflareinsights'), text.slice(0, 60));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
