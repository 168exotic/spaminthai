// Admin authentication — Cloudflare Access JWT หรือ Bearer token fallback

/**
 * ตรวจสอบสิทธิ์ admin
 * คืน true ถ้าผ่าน — ใช้ 404 แทน 401 เพื่อไม่เปิดเผยว่ามี admin
 */
export async function isAdminAuthorized(request, env) {
  // ชั้น 1: Cloudflare Access JWT
  const accessJwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (accessJwt && env.CF_ACCESS_TEAM_DOMAIN) {
    const ok = await verifyAccessJwt(accessJwt, env.CF_ACCESS_TEAM_DOMAIN);
    if (ok) return true;
  }

  // ชั้น 2: Bearer token fallback
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ') && env.ADMIN_TOKEN) {
    const token = auth.slice(7);
    if (token === env.ADMIN_TOKEN) return true;
  }

  return false;
}

/** ยืนยัน JWT signature กับ Cloudflare Access certs */
async function verifyAccessJwt(jwt, teamDomain) {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return false;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // ตรวจ expiry
    if (payload.exp && payload.exp < Date.now() / 1000) return false;

    // ดึง public keys จาก Cloudflare Access
    const certsRes = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`);
    if (!certsRes.ok) return false;
    const certs = await certsRes.json();

    const kid = header.kid;
    const cert = certs.keys?.find((k) => k.kid === kid);
    if (!cert) return false;

    const key = await crypto.subtle.importKey(
      'jwk',
      cert,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  } catch {
    return false;
  }
}
