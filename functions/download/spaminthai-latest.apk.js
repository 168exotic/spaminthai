// GET /download/spaminthai-latest.apk — redirect to GitHub Releases (APK > 25 MB Pages limit).
import { ANDROID_INSTALL_GITHUB_URL } from '../api/app-download.js';

const APK_URL = ANDROID_INSTALL_GITHUB_URL;

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
      Location: APK_URL,
      'Cache-Control': 'public, max-age=300'
    }
  });
}
