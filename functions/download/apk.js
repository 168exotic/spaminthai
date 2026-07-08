// GET /download/apk — Android APK (alias for spaminthai-latest.apk)
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const assetUrl = new URL('/download/spaminthai-latest.apk', url.origin);

  if (env.ASSETS) {
    const asset = await env.ASSETS.fetch(assetUrl.toString());
    if (asset.ok) {
      return new Response(asset.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': 'attachment; filename="spaminthai.apk"',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
  }

  return Response.redirect(assetUrl.toString(), 302);
}

export async function onRequestHead(ctx) {
  const res = await onRequestGet(ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
