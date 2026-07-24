// Cloudflare Worker entrypoint for spaminthai.com
// Manually routes /api/* to inline handlers, falls through to static assets.
// This exists because Workers Static Assets doesn't auto-route functions/api/*.js
// like Cloudflare Pages does. Once we migrate to a true Pages project we can
// delete this file and let Pages Functions handle routing directly.

import { onRequestGet as lookupHandler } from './functions/api/lookup.js';
import { handleReportPost } from './functions/api/report.js';
import {
  handleAdminTipsList,
  handleAdminTipGet,
  handleAdminTipPatch,
  handleAdminEvidence,
} from './functions/api/admin-tips.js';
import { handleDisputePost } from './functions/api/dispute.js';
import {
  handleAdminDisputesList,
  handleAdminDisputeGet,
  handleAdminDisputePatch,
  handleAdminDisputeEvidence,
} from './functions/api/admin-disputes.js';
import { countNumbersInKv } from './functions/api/stats.js';
import { handleLatestVersion } from './functions/api/latest-version.js';
import { renderNumberPage } from './functions/check/render-number-page.js';

const WEB_VERSION = '1.3.0';
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
    if (path === '/api/lookup') return lookupHandler({ request, env });
    if (path === '/api/version') return handleVersion();
    if (path === '/api/app') return handleApp();
    if (path === '/api/latest-version') return handleLatestVersion({ request, env });
    if (path === '/api/report' && request.method === 'POST') return handleReportPost({ request, env });
    if (path === '/api/dispute' && request.method === 'POST') return handleDisputePost({ request, env });
    if (path === '/api/stats') return handleStats(env);

    if (path === '/api/admin/tips' && request.method === 'GET') {
      return handleAdminTipsList({ request, env });
    }
    const adminTip = path.match(/^\/api\/admin\/tips\/([^/]+)$/);
    if (adminTip) {
      const tipId = adminTip[1];
      if (request.method === 'GET') return handleAdminTipGet({ request, env, tipId });
      if (request.method === 'PATCH') return handleAdminTipPatch({ request, env, tipId });
    }
    const adminEvidence = path.match(/^\/api\/admin\/evidence\/([^/]+)$/);
    if (adminEvidence && request.method === 'GET') {
      return handleAdminEvidence({ request, env, tipId: adminEvidence[1] });
    }

    if (path === '/api/admin/disputes' && request.method === 'GET') {
      return handleAdminDisputesList({ request, env });
    }
    const adminDispute = path.match(/^\/api\/admin\/disputes\/([^/]+)$/);
    if (adminDispute) {
      const id = adminDispute[1];
      if (request.method === 'GET') return handleAdminDisputeGet({ request, env, id });
      if (request.method === 'PATCH') return handleAdminDisputePatch({ request, env, id });
    }
    const adminDisputeEvidence = path.match(/^\/api\/admin\/dispute-evidence\/([^/]+)$/);
    if (adminDisputeEvidence && request.method === 'GET') {
      return handleAdminDisputeEvidence({ request, env, id: adminDisputeEvidence[1] });
    }

    const checkNumber = path.match(/^\/check\/(\d{9,10})$/);
    if (checkNumber) return renderNumberPage(checkNumber[1], env);

    // Fall through to static assets for everything else
    return env.ASSETS.fetch(request);
  }
};
