// GET /download/apk — proxy APK from APK_SOURCE_URL (e.g. Google Drive; not exposed in HTML)
const APK_HEADERS = {
  'Content-Type': 'application/vnd.android.package-archive',
  'Content-Disposition': 'attachment; filename="spaminthai.apk"',
  'Cache-Control': 'public, max-age=300'
};

function toDirectDriveUrl(url) {
  const file = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (file) return `https://drive.google.com/uc?export=download&id=${file[1]}`;
  const id = url.match(/[?&]id=([^&]+)/);
  if (id && url.includes('drive.google.com')) {
    return `https://drive.google.com/uc?export=download&id=${id[1]}`;
  }
  return url;
}

async function fetchApkSource(url) {
  const direct = toDirectDriveUrl(url);
  let res = await fetch(direct, { redirect: 'follow' });
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    const html = await res.text();
    const token = html.match(/confirm=([^&"'\s]+)/)?.[1];
    if (token) {
      const sep = direct.includes('?') ? '&' : '?';
      res = await fetch(`${direct}${sep}confirm=${token}`, { redirect: 'follow' });
    }
  }
  return res;
}

export async function onRequestGet({ env }) {
  const source = env.APK_SOURCE_URL;
  if (!source) {
    return new Response('APK_SOURCE_URL is not configured', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const upstream = await fetchApkSource(source);
  if (!upstream.ok) {
    return new Response('Failed to fetch APK from source', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  return new Response(upstream.body, { status: 200, headers: APK_HEADERS });
}

export async function onRequestHead(ctx) {
  const res = await onRequestGet(ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
