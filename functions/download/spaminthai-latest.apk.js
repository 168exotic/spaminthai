// GET /download/spaminthai-latest.apk — redirect to the APK hosted on the VPS.
// The signed APK (~50 MB) lives on the VPS (72.62.71.137) behind the Cloudflare
// proxy at api.spaminthai.com/download/apk. It cannot be served as a Pages
// static asset because it exceeds the 25 MB per-file limit, so we redirect
// instead of 404ing this documented/legacy path.
const APK_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v1.0.19/spaminthai-v1.0.19.apk';

export function onRequestGet() {
  return redirect();
}

export function onRequestHead() {
  return redirect();
}

function redirect() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: APK_URL,
      'Cache-Control': 'public, max-age=300'
    }
  });
}
