// GET /api/fb/latest — permalink of the newest post on the SPAM IN THAI Official Facebook page.
// Used by the homepage "โพสต์ล่าสุดจากเพจ" embed. Needs Cloudflare secrets:
//   FB_PAGE_TOKEN (Page access token, read-only use) and optionally FB_PAGE_ID.
// Without the token it returns a fixed fallback post so the homepage still shows something.
// Result is edge-cached for 10 minutes, so Facebook is called at most ~6 times/hour per colo.

const DEFAULT_PAGE_ID = '1226834017178565';
export const FB_FALLBACK_POST =
  'https://www.facebook.com/permalink.php?story_fbid=pfbid021yz1asGdb25FqmC9SKQrJUR4Sc7XbixqRaUeQfC9NBw8snatsY19z3SJa1vRxWJYl&id=61592335926775';
const TTL = 600;

function json(obj, maxAge) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
    },
  });
}

export async function handleFbLatest(request, env, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL('/api/fb/latest', request.url).toString());
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  let out = { url: FB_FALLBACK_POST, source: 'fallback' };
  const token = env.FB_PAGE_TOKEN;
  if (token) {
    const id = env.FB_PAGE_ID || DEFAULT_PAGE_ID;
    try {
      const api = `https://graph.facebook.com/v21.0/${encodeURIComponent(id)}/posts?fields=permalink_url,created_time,is_published&limit=5&access_token=${encodeURIComponent(token)}`;
      const r = await fetch(api, { cf: { cacheTtl: 0 } });
      const j = await r.json();
      const post = (j && Array.isArray(j.data) ? j.data : []).find(
        (p) => p && p.is_published !== false && /^https:\/\/www\.facebook\.com\//.test(p.permalink_url || '')
      );
      if (post) out = { url: post.permalink_url, created: post.created_time, source: 'graph' };
    } catch {
      /* keep fallback */
    }
  }
  const res = json(out, out.source === 'graph' ? TTL : 60);
  if (cache && ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
