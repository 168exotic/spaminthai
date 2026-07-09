// GET /api/app — latest SpamInThai Android app metadata
// APK is hosted on the VPS (72.62.71.137) behind the Cloudflare proxy and
// served by nginx at api.spaminthai.com/download/apk. Cloudflare Pages cannot
// host the APK directly because the file exceeds the 25 MB per-asset limit.
export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: '1.0.14',
    platform: 'android',
    downloadUrl: 'https://api.spaminthai.com/download/apk',
    minSdk: 29,
    updatedAt: '2026-07-07T10:47:34Z'
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
