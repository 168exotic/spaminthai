// GET /api/config — คืน public config (Turnstile site key) สำหรับ frontend

import { json } from '../_lib/response.js';

export async function onRequestGet({ env }) {
  return json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || ''
  }, 200, { 'Cache-Control': 'public, max-age=300' });
}
