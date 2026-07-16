#!/usr/bin/env bash
# ตรวจความปลอดภัย spaminthai.com — รันทุก 5 ชม. ผ่าน GitHub Actions
set -euo pipefail

SITE="${SITE_URL:-https://spaminthai.com}"
PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "  OK  - $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL  - $name"
    FAIL=$((FAIL + 1))
  fi
}

warn_check() {
  local name="$1"
  shift
  if "$@"; then
    echo "  OK  - $name"
    PASS=$((PASS + 1))
  else
    echo " WARN - $name"
    WARN=$((WARN + 1))
  fi
}

echo "=== SpamInThai Security Check ==="
echo "Target: $SITE"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Security headers
echo "--- Security Headers ---"
HEADERS=$(curl -fsSI "$SITE/" 2>/dev/null || true)
check "HSTS present" echo "$HEADERS" | grep -qi "strict-transport-security"
check "X-Frame-Options present" echo "$HEADERS" | grep -qi "x-frame-options"
check "X-Content-Type-Options present" echo "$HEADERS" | grep -qi "x-content-type-options"
check "Content-Security-Policy present" echo "$HEADERS" | grep -qi "content-security-policy"
check "Referrer-Policy present" echo "$HEADERS" | grep -qi "referrer-policy"

# 2. robots.txt
echo ""
echo "--- robots.txt ---"
ROBOTS=$(curl -fsS "$SITE/robots.txt" 2>/dev/null || echo "")
check "Disallow /api/" echo "$ROBOTS" | grep -q "Disallow: /api/"
check "Disallow /admin" echo "$ROBOTS" | grep -q "Disallow: /admin"

# 3. API anti-scraping — ไม่มี Referer ต้องได้ 403
echo ""
echo "--- API Anti-Scraping ---"
LOOKUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE/api/lookup?number=0812345678" || echo "000")
check "Lookup without Referer returns 403" test "$LOOKUP_CODE" = "403"

LOOKUP_OK=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Referer: $SITE/check" \
  "$SITE/api/lookup?number=0812345678" || echo "000")
check "Lookup with valid Referer returns 200" test "$LOOKUP_OK" = "200"

# 4. Report endpoint — ไม่มี Turnstile ต้องได้ 403
echo ""
echo "--- Report Protection ---"
REPORT_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -H "Content-Type: application/json" \
  -H "Referer: $SITE/check" \
  -d '{"number":"0812345678","category":"scam"}' \
  "$SITE/api/report" || echo "000")
check "Report without Turnstile returns 403" test "$REPORT_CODE" = "403"

# 5. Admin hidden — ไม่มี auth ต้องได้ 404
echo ""
echo "--- Admin Protection ---"
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE/api/admin/queue" || echo "000")
check "Admin API without auth returns 404" test "$ADMIN_CODE" = "404"

# 6. Config endpoint
echo ""
echo "--- Config Endpoint ---"
CONFIG=$(curl -fsS "$SITE/api/config" 2>/dev/null || echo "{}")
check "Config endpoint responds" echo "$CONFIG" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null

# 7. ไม่มี list/dump endpoint
echo ""
echo "--- No Data Dump ---"
DUMP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE/api/lookup" || echo "000")
warn_check "Lookup without number not 200" test "$DUMP_CODE" != "200"

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $WARN warnings ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
