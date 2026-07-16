// Hash IP ด้วย SHA-256 + salt (PDPA — ห้ามเก็บ IP ดิบ)

/** คืน hex SHA-256 ของ ip + salt */
export async function hashIP(ip, salt) {
  const data = new TextEncoder().encode(`${ip}:${salt || 'nosalt'}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ดึง IP จาก Cloudflare header */
export function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
