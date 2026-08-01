// GET /api/app — latest SpamInThai Android app metadata
// APK is hosted on GitHub Releases (permanent, CDN-backed, version-locked URLs).
import {
  ANDROID_INSTALL_CHANGELOG,
  ANDROID_INSTALL_UPDATED_AT,
  ANDROID_INSTALL_URL,
  ANDROID_INSTALL_VERSION,
  PLAY_PROTECT_BLOCKED_VERSIONS,
} from './app-download.js';

export async function onRequestGet() {
  return json({
    name: 'SpamInThai',
    version: ANDROID_INSTALL_VERSION,
    platform: 'android',
    downloadUrl: ANDROID_INSTALL_URL,
    releasePage: 'https://spaminthai.com/download',
    minSdk: 29,
    updatedAt: ANDROID_INSTALL_UPDATED_AT,
    changelog: ANDROID_INSTALL_CHANGELOG,
    playProtectBlockedVersions: [...PLAY_PROTECT_BLOCKED_VERSIONS],
    installNote:
      'v2.0.0 และ v2.0.1 ถูก Play Protect บล็อก — ใช้ v2.0.2',
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': 'https://spaminthai.com',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
