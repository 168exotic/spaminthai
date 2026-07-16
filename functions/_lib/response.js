// ฟังก์ชันสร้าง JSON response ร่วมกันทุก API

const ALLOWED_ORIGINS = ['https://spaminthai.com', 'https://www.spaminthai.com'];
const DEV_ORIGINS = ['http://localhost:8788', 'http://127.0.0.1:8788'];

/** คืน Response JSON พร้อม CORS header ที่อนุญาตเฉพาะโดเมนของเรา */
export function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
      ...extraHeaders
    }
  });
}

/** ตรวจว่า Origin/Referer มาจาก spaminthai.com หรือไม่ */
export function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return [...ALLOWED_ORIGINS, ...DEV_ORIGINS].includes(origin);

  const referer = request.headers.get('Referer') || '';
  const all = [...ALLOWED_ORIGINS, ...DEV_ORIGINS];
  return all.some((o) => referer.startsWith(o + '/') || referer === o);
}
