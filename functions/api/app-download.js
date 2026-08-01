// Canonical Android APK metadata for download pages and /api/app.
// v2.0.0 is blocked by Google Play Protect when sideloaded (Notification Listener).
// v2.0.1 removes that service from the manifest — see docs/PLAY-PROTECT.md.

export const ANDROID_INSTALL_VERSION = '2.0.1';
export const ANDROID_INSTALL_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v2.0.1/spaminthai-v2.0.1.apk';
export const ANDROID_INSTALL_UPDATED_AT = '2026-08-01T00:00:00Z';
export const ANDROID_INSTALL_CHANGELOG =
  'แก้ Play Protect บล็อกการติดตั้ง — เอา Notification Listener ออก (SMS เบต้าชั่วคราว)';

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
