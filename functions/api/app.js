import { corsOrigin, APK_URL } from '../_lib/urls.js';

export async function onRequestGet({ request, env }) {
  return json({
    name: 'SpamInThai',
    version: env.APP_VERSION || '1.0.7',
    platform: 'android',
    downloadUrl: APK_URL,
    minSdk: Number(env.APP_MIN_SDK || 26),
    updatedAt: env.APP_UPDATED_AT || '2026-07-09T00:00:00Z'
  }, 200, request);
}

function json(obj, status, request) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Cache-Control': 'public, max-age=300'
    }
  });
}
