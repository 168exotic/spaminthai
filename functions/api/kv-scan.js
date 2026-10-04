// Helpers for scanning all reported numbers in KV within Workers limits.
// KV list returns 1000 keys per op and bulk get reads 100 keys per op, so a scan of
// 20k numbers costs ~220 ops (limit: 1000 per invocation).

const BULK = 100;

/** All reported numbers (9-digit landline / 10-digit mobile), from `num:` keys. */
export async function listAllNumbers(env, max = 50000) {
  const out = [];
  let cursor;
  do {
    const page = await env.SPAM_KV.list({ prefix: 'num:', cursor, limit: 1000 });
    for (const k of page.keys) {
      const n = k.name.slice(4);
      if (/^0\d{8,9}$/.test(n)) out.push(n);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && out.length < max);
  return out.slice(0, max);
}

/** Read many JSON values; uses KV bulk get (100 keys/op), falls back to single gets. */
export async function bulkGetJson(env, keys) {
  const result = new Map();
  for (let i = 0; i < keys.length; i += BULK) {
    const chunk = keys.slice(i, i + BULK);
    let got = null;
    try {
      const m = await env.SPAM_KV.get(chunk, 'json');
      if (m instanceof Map) got = m;
    } catch {
      /* binding without bulk support (tests / old runtime) */
    }
    if (!got) {
      got = new Map();
      await Promise.all(
        chunk.map(async (k) => {
          try {
            const raw = await env.SPAM_KV.get(k);
            got.set(k, raw ? JSON.parse(raw) : null);
          } catch {
            got.set(k, null);
          }
        })
      );
    }
    for (const [k, v] of got) result.set(k, v);
  }
  return result;
}

const NUMBERS_CACHE_KEY = 'seo:numbers:all';
const NUMBERS_CACHE_TTL = 6 * 60 * 60;

/** All reported numbers, cached in KV (one list scan per 6h). */
export async function getAllNumbersCached(env) {
  try {
    const cached = await env.SPAM_KV.get(NUMBERS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* rebuild */ }
  const numbers = await listAllNumbers(env);
  try {
    await env.SPAM_KV.put(NUMBERS_CACHE_KEY, JSON.stringify(numbers), { expirationTtl: NUMBERS_CACHE_TTL });
  } catch { /* ignore */ }
  return numbers;
}
