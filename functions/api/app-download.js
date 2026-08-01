// Canonical Android APK metadata for download pages and /api/app.
// v2.0.3: repack of v1.0.21 with versionName 2.0.2 in manifest (shows correctly at install).
// v2.0.2 file was identical to v1.0.21 — installer showed 1.0.21 despite filename.
// v2.0.0 / v2.0.1 blocked by Play Protect — see docs/PLAY-PROTECT.md.

export const ANDROID_INSTALL_VERSION = '2.0.2';
export const ANDROID_INSTALL_VERSION_CODE = '15';
export const ANDROID_INSTALL_URL =
  'https://github.com/168exotic/spaminthai/releases/download/v2.0.3/spaminthai-v2.0.3.apk';
export const ANDROID_INSTALL_RELEASE_TAG = '2.0.3';
export const ANDROID_INSTALL_UPDATED_AT = '2026-08-01T02:30:00Z';
export const ANDROID_INSTALL_CHANGELOG =
  'ข้อมูลแอปแสดง 2.0.2 — บล็อกสายมิจฉาชีพ (ไม่มี SMS เบต้า)';

/** GitHub release tags that must not be offered for sideload install. */
export const PLAY_PROTECT_BLOCKED_VERSIONS = new Set(['2.0.0', '2.0.1', '2.0.2']);

export const PLAY_PROTECT_FALLBACK = {
  version: ANDROID_INSTALL_VERSION,
  url: ANDROID_INSTALL_URL,
  notes: ANDROID_INSTALL_CHANGELOG,
};

export function isPlayProtectBlockedVersion(version) {
  return PLAY_PROTECT_BLOCKED_VERSIONS.has(String(version || '').trim());
}
