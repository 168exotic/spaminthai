// GET /download/spaminthai-latest.apk — latest SpamInThai Android APK.
// The APK is 51 MB, above the Cloudflare Pages 25 MiB static-asset limit,
// so it lives in the repo under releases/ (excluded via .assetsignore)
// and is streamed from the public GitHub raw URL.
const APK_VERSION = '1.0.14';
const APK_SOURCE =
  'https://raw.githubusercontent.com/168exotic/spaminthai/8176d69d1c46de7f8e85fc83879c93c7f3bbba4d/releases/spaminthai-latest.apk';

export async function onRequestGet({ request }) {
  return serveApk(request);
}

export async function onRequestHead({ request }) {
  return serveApk(request);
}

async function serveApk(request) {
  const upstreamHeaders = {};
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.Range = range;

  const upstream = await fetch(APK_SOURCE, {
    method: request.method,
    headers: upstreamHeaders
  });

  if (!upstream.ok && upstream.status !== 206) {
    return Response.redirect(APK_SOURCE, 302);
  }

  const headers = new Headers({
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="spaminthai-v${APK_VERSION}.apk"`,
    'Cache-Control': 'public, max-age=3600',
    'Accept-Ranges': 'bytes'
  });
  for (const h of ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
