// Cloudflare Worker entrypoint for spaminthai.com
// Manually routes /api/* to inline handlers, falls through to static assets.
// This exists because Workers Static Assets doesn't auto-route functions/api/*.js
// like Cloudflare Pages does. Once we migrate to a true Pages project we can
// delete this file and let Pages Functions handle routing directly.

import { identifyCarrier } from './functions/api/carrier.js';
import { assess } from './functions/api/lookup.js';
import { handleReportPost } from './functions/api/report.js';
import { countNumbersInKv } from './functions/api/stats.js';
import { renderNumberPage } from './functions/check/render-number-page.js';

const WEB_VERSION = '1.2.0';
const RELEASED_AT = '2026-07-21';

function json(obj, status = 200, cacheSec = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      ...(cacheSec ? { 'Cache-Control': `public, max-age=${cacheSec}` } : {})
    }
  });
}

async function handleLookup(request, env) {
  const url = new URL(request.url);
  const number = (url.searchParams.get('number') || '').replace(/\D/g, '');
  if (number.length < 9 || number.length > 10) {
    return json({ error: 'invalid_number' }, 400);
  }
  const raw = await env.SPAM_KV.get('num:' + number);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };
  return json({ number, ...data, ...assess(data), ...identifyCarrier(number) }, 200, 60);
}

function handleVersion() {
  return new Response(JSON.stringify({
    name: 'SpamInThai Web',
    version: WEB_VERSION,
    released: RELEASED_AT,
    channel: 'weekly',
    changelog: 'https://spaminthai.com/changelog'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

function handleApp() {
  return new Response(JSON.stringify({
    name: 'SpamInThai',
    version: '1.0.15',
    platform: 'android',
    downloadUrl: 'https://github.com/168exotic/spaminthai/releases/download/v1.0.15/spaminthai-v1.0.15.apk',
    releasePage: 'https://spaminthai.com/download',
    minSdk: 29,
    updatedAt: '2026-07-15T01:05:00Z',
    changelog: 'Cyber Shield UI, crowdsource spam upload, 162 blocked numbers synced to KV.'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

async function handleStats(env) {
  let numbersInDb = null;
  try {
    const r = await fetch('https://xn--42c7b1ab1c2gya5e.com/health');
    if (r.ok) {
      const d = await r.json();
      if (typeof d.numbers_in_db === 'number') numbersInDb = d.numbers_in_db;
    }
  } catch {
    // KV fallback below
  }
  if (numbersInDb == null) numbersInDb = await countNumbersInKv(env);
  return json({ status: 'ok', numbers_in_db: numbersInDb }, 200, 300);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API routes
    if (path === '/api/lookup') return handleLookup(request, env);
    if (path === '/api/version') return handleVersion();
    if (path === '/api/app') return handleApp();
    if (path === '/api/report') return handleReportPost({ request, env });
    if (path === '/api/stats') return handleStats(env);

    const checkNumber = path.match(/^\/check\/(\d{9,10})$/);
    if (checkNumber) return renderNumberPage(checkNumber[1], env);

    // Fall through to static assets for everything else
    return env.ASSETS.fetch(request);
  }
};
