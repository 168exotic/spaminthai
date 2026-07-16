// ส่ง Discord webhook alert พร้อม throttle (max 1 alert/ประเภท/10 นาที)

const THROTTLE_SEC = 600;

/** ส่ง alert ไป Discord — throttle ด้วย RATE_KV หรือ Cache */
export async function sendAlert(env, type, message) {
  const webhook = env.DISCORD_WEBHOOK;
  if (!webhook) return;

  const throttleKey = `alert:${type}`;
  const now = Date.now();

  // throttle ด้วย cache
  const cache = caches.default;
  const cacheReq = new Request(`https://alert.internal/${throttleKey}`);
  if (await cache.match(cacheReq)) return;

  await cache.put(
    cacheReq,
    new Response('1', { headers: { 'Cache-Control': `max-age=${THROTTLE_SEC}` } })
  );

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**[SpamInThai Security]** ${type}\n${message}\n_${new Date().toISOString()}_`
      })
    });
  } catch {
    // ไม่ให้ alert ล้มเหลวทำให้ request หลักพัง
  }
}
