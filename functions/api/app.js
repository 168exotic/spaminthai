// GET /api/app — latest SpamInThai Android app metadata
export async function onRequestGet({ request }) {
  // Build downloadUrl from the request origin so the download works on any
  // deployment (production, *.pages.dev previews, local dev).
  const origin = new URL(request.url).origin;
  return json({
    name: 'SpamInThai',
    version: '1.0.14',
    platform: 'android',
    downloadUrl: `${origin}/download/spaminthai-latest.apk`,
    minSdk: 26,
    updatedAt: '2026-07-07T10:42:53Z'
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
