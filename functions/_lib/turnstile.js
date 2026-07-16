// Cloudflare Turnstile verification — fail closed เมื่อ network error

/**
 * ยืนยัน Turnstile token กับ Cloudflare
 * @returns {{ ok: boolean, error?: string }}
 */
export async function verifyTurnstile(token, remoteIP, secret) {
  if (!secret) return { ok: false, error: 'no_secret' };
  if (!token) return { ok: false, error: 'no_token' };

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      remoteip: remoteIP || ''
    });

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!res.ok) return { ok: false, error: 'verify_http_error' };

    const data = await res.json();
    return { ok: data.success === true, error: data['error-codes']?.join(',') };
  } catch {
    // fail closed — ปฏิเสธ report เมื่อ network ล้มเหลว
    return { ok: false, error: 'network_error' };
  }
}
