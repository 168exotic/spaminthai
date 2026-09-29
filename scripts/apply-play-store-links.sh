#!/usr/bin/env bash
# Rewrite legacy APK / download page links to Google Play across the built site tree.
set -euo pipefail

SITE_ROOT="${1:-.}"
PLAY='https://play.google.com/store/apps/details?id=com.jarvis.callblocker'
EXT=' target="_blank" rel="noopener noreferrer"'

export PLAY EXT

# Static pages + the server-rendered /check/<number> template (Pages Function).
{
  find "$SITE_ROOT" -name '*.html' -type f \
    ! -path '*/vps/*' \
    ! -path '*/node_modules/*' \
    -print0
  find "$SITE_ROOT/functions/check" -name 'render-number-page.js' -type f -print0 2>/dev/null || true
} | while IFS= read -r -d '' f; do
  perl -pi -e '
    s|href="/download/spaminthai-latest\.apk"|href="$ENV{PLAY}"$ENV{EXT}|g;
    s|href="https://spaminthai\.com/download/spaminthai-latest\.apk"|href="$ENV{PLAY}"$ENV{EXT}|g;
    s|href="/api/download"|href="$ENV{PLAY}"$ENV{EXT}|g;
    s| href="/download"(?=[^>]*>ดาวน์โหลด)| href="$ENV{PLAY}"$ENV{EXT}|g;
    s| href="/download"(?=[^>]*>ติดตั้ง)| href="$ENV{PLAY}"$ENV{EXT}|g;
    s| data-download download| data-download|g;
    s| download(?= class=)| |g;
    s| download(?=>ดาวน์โหลด)| |g;
    s| download(?=>ติดตั้ง)| |g;
    s/(<a\b[^>]*)\shref="https:\/\/play\.google[^"]*"([^>]*)\shref="(https:\/\/play\.google[^"]*)"/$1$2 href="$3"/gi;
    s/(<a\b[^>]*?)$ENV{EXT}([^>]*?)$ENV{EXT}/$1$2$ENV{EXT}/g;
  ' "$f"
done
