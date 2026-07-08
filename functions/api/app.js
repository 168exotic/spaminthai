import { corsOrigin, APK_URL } from '../_lib/urls.js';

export async function onRequestGet({ request }) {
  return json({
    name: 'SpamInThai',
    version: '1.0.0',
    platform: 'android',
    downloadUrl: APK_URL,
    minSdk: 26,
    updatedAt: '2026-07-07T00:00:00Z'
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
