// GET /api/app — latest SpamInThai Android app metadata
// Primary: GitHub Releases (v1.0.15+). Fallback VPS: api.spaminthai.com/download/apk
const APK_DOWNLOAD_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v1.0.15/spaminthai-v1.0.15.apk';

export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: '1.0.15',
    platform: 'android',
    downloadUrl: APK_DOWNLOAD_URL,
    minSdk: 29,
    updatedAt: '2026-07-15T01:00:00Z'
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
