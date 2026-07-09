// GET /download/apk — Android APK (alias for spaminthai-latest.apk)
const APK_HEADERS = {
  'Content-Type': 'application/vnd.android.package-archive',
  'Content-Disposition': 'attachment; filename="spaminthai.apk"',
  'Cache-Control': 'public, max-age=300'
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const assetUrl = new URL('/download/spaminthai-latest.apk', url.origin);

  if (env.ASSETS) {
    const asset = await env.ASSETS.fetch(assetUrl.toString());
    if (asset.ok) {
      return new Response(asset.body, { status: 200, headers: APK_HEADERS });
    }
  }

  const remote = env.APK_SOURCE_URL;
  if (remote) {
    const upstream = await fetch(remote);
    if (upstream.ok) {
      return new Response(upstream.body, { status: 200, headers: APK_HEADERS });
    }
  }

  return new Response('APK file not available', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

export async function onRequestHead(ctx) {
  const res = await onRequestGet(ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
