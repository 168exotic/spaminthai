// Canonical Android APK metadata for download pages and /api/app.
// v2.0.0 is blocked by Google Play Protect when sideloaded because the SMS beta
// declares NotificationListenerService — see docs/PLAY-PROTECT.md.

export const ANDROID_INSTALL_VERSION = '1.0.21';
export const ANDROID_INSTALL_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v1.0.21/spaminthai-v1.0.21.apk';
export const ANDROID_INSTALL_UPDATED_AT = '2026-07-20T00:00:00Z';
export const ANDROID_INSTALL_CHANGELOG =
  'บล็อกสายมิจฉาชีพอัตโนมัติ — เวอร์ชันที่ติดตั้งได้ขณะ Play Protect บล็อก v2.0.0';

/** Tags blocked for sideload installs (Play Protect hard block). */
export const PLAY_PROTECT_BLOCKED_VERSIONS = new Set(['2.0.0']);

export const PLAY_PROTECT_FALLBACK = {
  version: ANDROID_INSTALL_VERSION,
  url: ANDROID_INSTALL_URL,
  notes: ANDROID_INSTALL_CHANGELOG,
};

export function isPlayProtectBlockedVersion(version) {
  return PLAY_PROTECT_BLOCKED_VERSIONS.has(String(version || '').trim());
}
