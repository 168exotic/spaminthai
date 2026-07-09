// GET /api/app — latest SpamInThai Android app metadata
export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: null,
    platform: 'android',
    status: 'coming_soon',
    downloadUrl: null,
    fallbackDownloadUrl: '/download/police.vcf',
    minSdk: 26,
    updatedAt: '2026-07-07T00:00:00Z'
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
