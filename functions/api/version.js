// GET /api/version — current SpamInThai web/API release.
// Bumped every Tuesday (see RELEASING.md + .github/workflows/weekly-release.yml).
// Keep WEB_VERSION / RELEASED_AT in sync with package.json + CHANGELOG.md;
// scripts/prepare-weekly-release.js updates all three automatically.
const WEB_VERSION = '1.3.0';
const RELEASED_AT = '2026-07-21';

export async function onRequestGet() {
  return json({
    name: 'SpamInThai Web',
    version: WEB_VERSION,
    released: RELEASED_AT,
    channel: 'weekly',
    changelog: 'https://spaminthai.com/changelog'
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
