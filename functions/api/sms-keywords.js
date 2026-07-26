// GET /api/sms-keywords  ->  { keywords, count, updated_at }
// Current Thai spam-keyword list for the on-device pre-filter. The app polls
// this ~daily. Edge-cached 5 min.

import { json } from './tip-utils.js';
import { loadKeywords } from './sms-utils.js';

export async function handleSmsKeywords({ env }) {
  const keywords = await loadKeywords(env);
  return json(
    { keywords, count: keywords.length, updated_at: new Date().toISOString() },
    200,
    { 'Cache-Control': 'public, max-age=300' },
  );
}

export async function onRequestGet(ctx) {
  return handleSmsKeywords(ctx);
}
