// GET /api/lookup?number=0812345678
// KV binding: SPAM_KV  (key: num:<เบอร์> -> JSON {reports, categories, lastReport})

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const number = (url.searchParams.get('number') || '').replace(/\D/g, '');

  if (number.length < 9 || number.length > 10) {
    return json({ error: 'invalid_number' }, 400);
  }

  const raw = await env.SPAM_KV.get('num:' + number);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };

  return json(data, 200, 60); // cache at edge 60 sec
}

function json(obj, status = 200, cacheSec = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      ...(cacheSec ? { 'Cache-Control': `public, max-age=${cacheSec}` } : {})
    }
  });
}
