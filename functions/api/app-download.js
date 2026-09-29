// Canonical Android app install URL for download pages and /api/app (Google Play).

export const ANDROID_INSTALL_VERSION = '2.0.2';
export const ANDROID_INSTALL_VERSION_CODE = '15';
export const ANDROID_LATEST_API_VERSION = '1.0.21';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
export const ANDROID_INSTALL_URL = PLAY_STORE_URL;
export const ANDROID_INSTALL_GITHUB_URL = PLAY_STORE_URL;
export const ANDROID_INSTALL_RELEASE_TAG = '2.0.4';
export const ANDROID_INSTALL_UPDATED_AT = '2026-08-01T02:40:00Z';
export const ANDROID_INSTALL_CHANGELOG =
  'ติดตั้งจาก Google Play — บล็อกสายมิจฉาชีพอัตโนมัติ';

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
