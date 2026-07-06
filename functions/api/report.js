// POST /api/report  {number, category}
// KV binding: SPAM_KV
// Rate limit: 1 IP per number per 24 hours

const CATS = ['scam', 'callcenter', 'ads', 'loan', 'safe'];

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const number = String(body.number || '').replace(/\D/g, '');
  const category = body.category;

  if (number.length < 9 || number.length > 10) return json({ error: 'invalid_number' }, 400);
  if (!CATS.includes(category)) return json({ error: 'invalid_category' }, 400);

  // rate limit per IP per number
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:${ip}:${number}`;
  if (await env.SPAM_KV.get(rlKey)) return json({ ok: true, deduped: true });
  await env.SPAM_KV.put(rlKey, '1', { expirationTtl: 86400 });

  // update number data
  const key = 'num:' + number;
  const raw = await env.SPAM_KV.get(key);
  const data = raw ? JSON.parse(raw) : { reports: 0, categories: {}, lastReport: null };

  data.reports += 1;
  data.categories[category] = (data.categories[category] || 0) + 1;
  data.lastReport = Date.now();

  await env.SPAM_KV.put(key, JSON.stringify(data));
  return json({ ok: true, reports: data.reports });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com'
    }
  });
}
