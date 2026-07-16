// Rate limiting ด้วย Cache API (ชั้นแรก) + RATE_KV (ชั้นสอง)
// ออกแบบให้ลด KV writes: อ่านก่อน เขียนเฉพาะเมื่อ count เปลี่ยน

import { hashIP, getClientIP } from './hash.js';

const CACHE_PREFIX = 'https://rl.internal/';

/**
 * ตรวจ rate limit
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export async function checkRateLimit(env, endpoint, ipHash, limit, windowSec) {
  const kvKey = `rl:${endpoint}:${ipHash}:${windowSec}`;
  const now = Math.floor(Date.now() / 1000);

  // ชั้น 1: Cache API — ลด KV ops
  const cache = caches.default;
  const cacheReq = new Request(CACHE_PREFIX + kvKey);
  const cached = await cache.match(cacheReq);
  if (cached) {
    const data = await cached.json();
    if (data.resetAt > now) {
      if (data.count >= limit) {
        return { allowed: false, remaining: 0, retryAfter: data.resetAt - now };
      }
      return { allowed: true, remaining: limit - data.count, retryAfter: 0 };
    }
  }

  // ชั้น 2: RATE_KV
  if (!env.RATE_KV) {
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const raw = await env.RATE_KV.get(kvKey);
  let count = 0;
  let resetAt = now + windowSec;

  if (raw) {
    const data = JSON.parse(raw);
    if (data.resetAt > now) {
      count = data.count;
      resetAt = data.resetAt;
    }
  }

  if (count >= limit) {
    // เกิน limit แล้ว — ไม่เขียน KV ซ้ำ (กัน attacker เผาโควต้า)
    return { allowed: false, remaining: 0, retryAfter: resetAt - now };
  }

  const newCount = count + 1;
  const newData = { count: newCount, resetAt };

  // เขียน KV เฉพาะเมื่อ count เปลี่ยน
  await env.RATE_KV.put(kvKey, JSON.stringify(newData), { expirationTtl: windowSec });

  // อัปเดต cache
  await cache.put(
    cacheReq,
    new Response(JSON.stringify(newData), {
      headers: { 'Cache-Control': `max-age=${windowSec}` }
    })
  );

  return {
    allowed: true,
    remaining: limit - newCount,
    retryAfter: 0
  };
}

/** ตรวจหลาย window พร้อมกัน — คืน result แรกที่ไม่ผ่าน */
export async function checkMultipleLimits(env, endpoint, request, limits, ipSalt) {
  const ip = getClientIP(request);
  const ipHash = await hashIP(ip, ipSalt);

  for (const { limit, windowSec } of limits) {
    const result = await checkRateLimit(env, endpoint, ipHash, limit, windowSec);
    if (!result.allowed) return result;
  }
  return { allowed: true, remaining: 999, retryAfter: 0 };
}
