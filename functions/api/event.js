// POST /api/event  { event, vid, source? }  — anonymous usage ping, no PII.
// The Android app posts heartbeats here; recorded via _analytics for /admin/live.

import { trackEvent } from './_analytics.js';
import { json } from './tip-utils.js';

export async function handleEventPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const result = await trackEvent(env, {
    event: body.event,
    source: body.source,
    vid: body.vid,
    app_version: body.app_version,
  });
  if (!result.ok) return json(result, 400);
  return json({ ok: true });
}

export async function onRequestPost(ctx) {
  return handleEventPost(ctx);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
