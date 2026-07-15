// GET /api/app — latest SpamInThai Android app metadata
// APK is hosted on GitHub Releases (permanent, CDN-backed, version-locked URLs).
// Previously hosted on VPS but GitHub is cleaner: no bandwidth cost, version pinning,
// same URL forever, and Cloudflare Pages functions can't host >25MB APK directly.
export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: '1.0.15',
    platform: 'android',
    downloadUrl: 'https://github.com/168exotic/spaminthai/releases/download/v1.0.15/spaminthai-v1.0.15.apk',
    releasePage: 'https://github.com/168exotic/spaminthai/releases/tag/v1.0.15',
    minSdk: 29,
    updatedAt: '2026-07-15T01:05:00Z',
    changelog: 'Cyber Shield UI, crowdsource spam upload, 162 blocked numbers synced to KV.'
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
