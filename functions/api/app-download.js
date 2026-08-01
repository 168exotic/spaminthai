// Canonical Android APK metadata for download pages and /api/app.
// v2.0.0: Notification Listener → Play Protect hard block on sideload.
// v2.0.1: repacked + debug-signed + SMS listener still in dex → also blocked.
// v2.0.2: re-publish of v1.0.21 release-signed binary — installable.
// See docs/PLAY-PROTECT.md.

export const ANDROID_INSTALL_VERSION = '2.0.2';
export const ANDROID_INSTALL_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v2.0.2/spaminthai-v2.0.2.apk';
export const ANDROID_INSTALL_UPDATED_AT = '2026-08-01T02:20:00Z';
export const ANDROID_INSTALL_CHANGELOG =
  'ติดตั้งได้ — build release ลงนามจริง (โค้ดเดียวกับ v1.0.21, บล็อกสายครบ)';

/** GitHub release tags that must not be offered for sideload install. */
export const PLAY_PROTECT_BLOCKED_VERSIONS = new Set(['2.0.0', '2.0.1']);

export const PLAY_PROTECT_FALLBACK = {
  version: ANDROID_INSTALL_VERSION,
  url: ANDROID_INSTALL_URL,
  notes: ANDROID_INSTALL_CHANGELOG,
};

export function isPlayProtectBlockedVersion(version) {
  return PLAY_PROTECT_BLOCKED_VERSIONS.has(String(version || '').trim());
}
