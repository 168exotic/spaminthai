// Canonical Android APK metadata for download pages and /api/app.
// v2.0.4: fixes UpdateChecker hardcoded 1.0.21 compare bug (see docs/PLAY-PROTECT.md).
// ANDROID_LATEST_API_VERSION is what /api/latest-version returns — must be <= installed
// versionName for fixed updaters; kept at 1.0.21 to silence broken v2.0.3 builds until replaced.

export const ANDROID_INSTALL_VERSION = '2.0.2';
export const ANDROID_INSTALL_VERSION_CODE = '15';
export const ANDROID_LATEST_API_VERSION = '1.0.21';
export const ANDROID_INSTALL_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v2.0.4/spaminthai-v2.0.4.apk';
export const ANDROID_INSTALL_RELEASE_TAG = '2.0.4';
export const ANDROID_INSTALL_UPDATED_AT = '2026-08-01T02:40:00Z';
export const ANDROID_INSTALL_CHANGELOG =
  'แก้แจ้งเตือนอัปเดตวนลูป + ข้อมูลแอปแสดง 2.0.2';

/** GitHub release tags blocked for sideload (Play Protect or bad updater). */
export const PLAY_PROTECT_BLOCKED_VERSIONS = new Set(['2.0.0', '2.0.1', '2.0.2', '2.0.3']);

export const PLAY_PROTECT_FALLBACK = {
  version: ANDROID_LATEST_API_VERSION,
  url: ANDROID_INSTALL_URL,
  notes: ANDROID_INSTALL_CHANGELOG,
};

export function isPlayProtectBlockedVersion(version) {
  return PLAY_PROTECT_BLOCKED_VERSIONS.has(String(version || '').trim());
}
