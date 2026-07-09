// GET /download/spaminthai-latest.apk — serve the latest Android APK.
//
// The APK (~50 MB) exceeds Cloudflare Pages' 25 MiB per-file asset limit, so it
// is committed to the public repo but excluded from the Pages upload via
// `.assetsignore`. This route redirects to the file served straight from GitHub,
// keeping a single stable download URL (spaminthai.com/download/spaminthai-latest.apk).
const APK_URL =
  'https://raw.githubusercontent.com/168exotic/spaminthai/main/download/spaminthai-latest.apk';

export async function onRequestGet() {
  return redirect();
}

export async function onRequestHead() {
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
