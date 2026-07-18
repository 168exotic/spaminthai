// GET /api/stats — public database stats for the website widget.
// Proxies the backend health endpoint (no browser CORS issues) with a KV
// count fallback.

export async function countNumbersInKv(env) {
  let count = 0;
  let cursor;
  do {
    const page = await env.SPAM_KV.list({ prefix: 'num:', cursor, limit: 1000 });
    count += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return count;
}

export async function onRequestGet({ env }) {
  let numbersInDb = null;

  try {
    const r = await fetch('https://xn--42c7b1ab1c2gya5e.com/health');
    if (r.ok) {
      const d = await r.json();
      if (typeof d.numbers_in_db === 'number') numbersInDb = d.numbers_in_db;
    }
  } catch {
    // fall through to KV count
  }

  if (numbersInDb == null) {
    numbersInDb = await countNumbersInKv(env);
  }

  return new Response(JSON.stringify({ status: 'ok', numbers_in_db: numbersInDb }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
