// /api/lookup?q=<value>&type=<auto|phone|pkg|domain|line>
// Binding: SPAM_KV -> KV namespace (wrangler.jsonc)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function normalizePhone(v) {
  let p = v.replace(/[\s\-()]/g, '');
  if (p.startsWith('+66')) p = '0' + p.slice(3);
  if (p.startsWith('66') && p.length >= 11) p = '0' + p.slice(2);
  return p;
}

// เดา entity type อัตโนมัติ
function detectType(q) {
  const v = q.trim();
  if (/^(\+?66|0)\d{8,9}$/.test(v.replace(/[\s\-()]/g, ''))) return 'phone';
  if (/^@/.test(v)) return 'line';
  if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+){2,}$/i.test(v) && /^(com|net|org|io|app|th|cn)\./i.test(v)) return 'pkg';
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v)) return 'domain';
  return 'unknown';
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || url.searchParams.get('number') || '').trim();
  if (!q) return json({ ok: false, error: 'missing q' }, 400);

  let type = url.searchParams.get('type') || 'auto';
  if (type === 'auto') type = detectType(q);

  const value = type === 'phone' ? normalizePhone(q) : q.toLowerCase().replace(/^@/, type === 'line' ? '@' : '');

  // เบอร์โทร: เช็คทั้ง namespace เดิม (spam) และ loanapp
  const keys = [];
  if (type === 'phone') {
    keys.push(`num:${value}`);           // key เดิมของระบบสแปม
    keys.push(`loanapp:phone:${value}`);
  } else if (type !== 'unknown') {
    keys.push(`loanapp:${type}:${value}`);
  } else {
    // ไม่รู้ type ลองทุก prefix รวมถึงชื่อแอป
    for (const t of ['pkg', 'domain', 'line', 'name']) keys.push(`loanapp:${t}:${value}`);
  }

  const results = await Promise.all(
    keys.map(async (key) => {
      const raw = await env.SPAM_KV.get(key);
      if (!raw) return null;
      let data;
      try { data = JSON.parse(raw); } catch { data = { raw }; }
      return { key, data };
    })
  );

  const hits = results.filter(Boolean);
  if (hits.length === 0) {
    return json({ ok: true, found: false, query: value, type });
  }

  // ดึง related entities มาแสดงด้วย (1 ชั้น)
  const related = new Set();
  for (const h of hits) {
    (h.data.related || []).forEach((r) => related.add(r));
  }
  const relatedData = await Promise.all(
    [...related].slice(0, 10).map(async (key) => {
      const raw = await env.SPAM_KV.get(key);
      if (!raw) return null;
      try { return { key, data: JSON.parse(raw) }; } catch { return null; }
    })
  );

  return json({
    ok: true,
    found: true,
    query: value,
    type,
    verdict: hits.some((h) => h.data.risk === 'high') ? 'dangerous' : 'suspicious',
    hits,
    related: relatedData.filter(Boolean),
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
