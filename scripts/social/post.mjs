// Post today's queued SpamInThai social card to the Facebook Page (+ Instagram if configured).
// Env: FB_PAGE_ID, FB_PAGE_TOKEN (Page access token), IG_USER_ID (optional), SLOT=am|pm,
//      GRAPH_VERSION (default v23.0), DRY_RUN=1 to print only.
import { readFileSync } from 'node:fs';

const { FB_PAGE_ID, FB_PAGE_TOKEN, IG_USER_ID, DRY_RUN } = process.env;
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION || 'v23.0'}`;
const SITE = 'https://spaminthai.com';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(new Date()));
const slot = process.env.SLOT || (hour < 14 ? 'am' : 'pm');

const { posts } = JSON.parse(readFileSync('marketing/social/posts.json', 'utf8'));
const post = posts.find((p) => p.date === today && p.slot === slot);
if (!post) { console.log(`No post queued for ${today} ${slot} — nothing to do.`); process.exit(0); }

const imageUrl = `${SITE}/assets/social/${post.id}.png`;
const head = await fetch(imageUrl, { method: 'HEAD' });
if (!head.ok) { console.error(`::error::Image not live yet: ${imageUrl} (${head.status})`); process.exit(1); }

console.log(`Post ${post.id}\n${imageUrl}\n---\n${post.caption}`);
if (DRY_RUN === '1') process.exit(0);
if (!FB_PAGE_ID || !FB_PAGE_TOKEN) { console.log('::warning::FB_PAGE_ID / FB_PAGE_TOKEN not set — skipping.'); process.exit(0); }

async function graph(path, params) {
  const r = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: new URLSearchParams(params) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`${path}: ${JSON.stringify(j.error || j)}`);
  return j;
}

let failed = false;
try {
  const fb = await graph(`${FB_PAGE_ID}/photos`, { url: imageUrl, message: post.caption, access_token: FB_PAGE_TOKEN });
  console.log('Facebook OK', fb.post_id || fb.id);
} catch (e) { failed = true; console.error('::error::Facebook', e.message); }

if (IG_USER_ID) {
  try {
    const c = await graph(`${IG_USER_ID}/media`, { image_url: imageUrl, caption: post.caption, access_token: FB_PAGE_TOKEN });
    const pub = await graph(`${IG_USER_ID}/media_publish`, { creation_id: c.id, access_token: FB_PAGE_TOKEN });
    console.log('Instagram OK', pub.id);
  } catch (e) { failed = true; console.error('::error::Instagram', e.message); }
} else {
  console.log('IG_USER_ID not set — Instagram skipped.');
}
process.exit(failed ? 1 : 0);
