// GET /download/spaminthai-latest.apk — redirect to Google Play (legacy APK path).
import { PLAY_STORE_URL } from '../api/app-download.js';

export function onRequestGet() {
  return redirect();
}

export function onRequestHead() {
  return redirect();
}

function redirect() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: PLAY_STORE_URL,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
