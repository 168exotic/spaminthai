// GET /api/app — latest SpamInThai Android app metadata
// APK is hosted on GitHub Releases (permanent, CDN-backed, version-locked URLs).
// Previously hosted on VPS but GitHub is cleaner: no bandwidth cost, version pinning,
// same URL forever, and Cloudflare Pages functions can't host >25MB APK directly.
export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: '1.0.17',
    platform: 'android',
    downloadUrl: 'https://github.com/168exotic/spaminthai/releases/download/v1.0.17/spaminthai-v1.0.17.apk',
    releasePage: 'https://spaminthai.com/download',
    minSdk: 29,
    updatedAt: '2026-07-24T00:00:00Z',
    changelog: 'Rose redesign to match the website + in-app updater.'
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
