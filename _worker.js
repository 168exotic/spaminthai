// Cloudflare Worker entrypoint — route /api/* ไป handlers ที่มี security layers
// Static assets ส่งผ่าน ASSETS binding

import { onRequestGet as lookupGet } from './functions/api/lookup.js';
import { onRequestPost as reportPost } from './functions/api/report.js';
import { onRequestGet as configGet } from './functions/api/config.js';
import { onRequest as adminHandler } from './functions/api/admin/[[path]].js';

const WEB_VERSION = '1.2.0';
const RELEASED_AT = '2026-07-16';

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
  return json({
    name: 'SpamInThai Web',
    version: WEB_VERSION,
    released: RELEASED_AT,
    channel: 'weekly',
    changelog: 'https://spaminthai.com/changelog'
  }, 200, 300);
}

function handleApp() {
  return json({
    name: 'SpamInThai',
    version: '1.0.15',
    platform: 'android',
    downloadUrl: 'https://github.com/168exotic/spaminthai/releases/download/v1.0.15/spaminthai-v1.0.15.apk',
    releasePage: 'https://spaminthai.com/download',
    minSdk: 29,
    updatedAt: '2026-07-15T01:05:00Z',
    changelog: 'Cyber Shield UI, crowdsource spam upload, 162 blocked numbers synced to KV.'
  }, 200, 300);
}

/** แยก admin path จาก URL */
function parseAdminPath(url) {
  const m = url.pathname.match(/^\/api\/admin\/?(.*)$/);
  return m ? m[1] : '';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/lookup' && request.method === 'GET') {
      return lookupGet({ request, env });
    }
    if (path === '/api/report' && request.method === 'POST') {
      return reportPost({ request, env });
    }
    if (path === '/api/config' && request.method === 'GET') {
      return configGet({ env });
    }
    if (path.startsWith('/api/admin')) {
      const adminPath = parseAdminPath(url);
      return adminHandler({ request, env, params: { path: adminPath } });
    }
    if (path === '/api/version') return handleVersion();
    if (path === '/api/app') return handleApp();

    return env.ASSETS.fetch(request);
  }
};
