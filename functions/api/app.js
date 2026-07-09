// GET /api/app — latest SpamInThai Android app metadata
export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: '1.0.14',
    platform: 'android',
    downloadUrl: 'https://spaminthai.com/download/spaminthai-latest.apk',
    minSdk: 26,
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
