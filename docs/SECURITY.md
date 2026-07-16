# Security Documentation — spaminthai.com

> สรุป security hardening ทั้งหมด + วิธีตั้งค่า + วิธีทดสอบ

---

## Architecture

```
User → Cloudflare WAF/Access → Worker (_worker.js) → KV
                                    ├── SPAM_KV (verdict จริง)
                                    ├── QUEUE_KV (report รออนุมัติ)
                                    └── RATE_KV (rate limiting)
```

**Report flow:** User report → Turnstile verify → QUEUE_KV (pending) → Admin approve → SPAM_KV

---

## Environment Variables

ตั้งใน Cloudflare Pages → Settings → Environment variables:

| Variable | Secret? | ใช้ทำอะไร |
|---|---|---|
| `TURNSTILE_SITE_KEY` | Public | Site key สำหรับ Turnstile widget (frontend) |
| `TURNSTILE_SECRET` | **Secret** | Verify Turnstile token ฝั่ง server |
| `IP_SALT` | **Secret** | Salt สำหรับ hash IP (PDPA) |
| `ADMIN_TOKEN` | **Secret** | Bearer token fallback สำหรับ admin API |
| `CF_ACCESS_TEAM_DOMAIN` | Public | Team subdomain สำหรับ verify Access JWT |
| `DISCORD_WEBHOOK` | **Secret** | URL สำหรับส่ง security alerts |

---

## KV Namespaces

สร้างใน Cloudflare Dashboard → Workers & Pages → KV:

| Namespace | Binding Name | ใช้ทำอะไร |
|---|---|---|
| `spaminthai-spam-db` (มีอยู่แล้ว) | `SPAM_KV` | เก็บ verdict เบอร์ |
| `spaminthai-queue` (สร้างใหม่) | `QUEUE_KV` | คิว report รออนุมัติ + audit log |
| `spaminthai-ratelimit` (สร้างใหม่) | `RATE_KV` | Rate limiting counters |

หลังสร้าง namespace ใหม่:
1. Bind ใน Cloudflare Pages project settings
2. อัปเดต ID ใน `wrangler.jsonc` (แทน `REPLACE_WITH_*`)

---

## Dashboard Checklist

- [ ] สร้าง KV `spaminthai-queue` + bind `QUEUE_KV`
- [ ] สร้าง KV `spaminthai-ratelimit` + bind `RATE_KV`
- [ ] ตั้ง Turnstile keys ที่ [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
- [ ] ตั้ง env vars ทั้งหมด (ดูตารางด้านบน)
- [ ] ตั้ง Cloudflare Access สำหรับ `/admin*` (ดู `docs/cloudflare-access-setup.md`)
- [ ] ตั้ง WAF rules (ดู `docs/cloudflare-waf-setup.md`)
- [ ] เปิด Bot Fight Mode
- [ ] ตั้ง Discord webhook สำหรับ alerts (optional)

---

## Security Layers

| Layer | ป้องกันอะไร |
|---|---|
| Report Queue | กัน fake report poison ฐานข้อมูล |
| Turnstile | กัน bot ยิง report |
| Rate Limiting | กัน KV write abuse + scraping |
| Origin/Referer check | กัน scrape lookup API |
| Honeytoken | ตรวจจับ data leak |
| Admin Access + JWT | กันเจาะ admin |
| Security Headers (CSP, HSTS) | กัน XSS, clickjacking |
| WAF (dashboard) | กัน threat ที่ edge |
| Automated checks (ทุก 5 ชม.) | ตรวจว่า layers ยังทำงาน |

---

## Automated Security Checks

GitHub Actions workflow `.github/workflows/security-check.yml` รัน **ทุก 5 ชั่วโมง** ตรวจ:

- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- robots.txt blocks `/api/` และ `/admin`
- Lookup API ปฏิเสธ request ไม่มี Referer (403)
- Report API ปฏิเสธ request ไม่มี Turnstile (403)
- Admin API ซ่อนตัว (404 without auth)

รัน manual:

```bash
npm run security-check
```

---

## ทดสอบด้วย curl

### Lookup — ต้องมี Referer

```bash
# ต้องได้ 403
curl -s "https://spaminthai.com/api/lookup?number=0812345678"

# ต้องได้ 200
curl -s -H "Referer: https://spaminthai.com/check" \
  "https://spaminthai.com/api/lookup?number=0812345678"
```

### Report — ต้องมี Turnstile

```bash
# ต้องได้ 403
curl -s -X POST -H "Content-Type: application/json" \
  -H "Referer: https://spaminthai.com/check" \
  -d '{"number":"0812345678","category":"scam"}' \
  "https://spaminthai.com/api/report"
```

### Admin — ต้องได้ 404

```bash
curl -s -o /dev/null -w "%{http_code}" "https://spaminthai.com/api/admin/queue"
# คาดหวัง: 404
```

### Admin — ด้วย token

```bash
curl -s -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://spaminthai.com/api/admin/queue"
```

### Rate limit

```bash
# ยิง lookup ซ้ำ 31 ครั้งใน 1 นาที → ครั้งที่ 31 ต้องได้ 429
for i in $(seq 1 31); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Referer: https://spaminthai.com/check" \
    "https://spaminthai.com/api/lookup?number=0812345678"
done
```

---

## สิ่งที่ต้องทำเอง (นอก repo)

- [ ] เปิด 2FA + Passkey บน Cloudflare, GitHub, Registrar, Gmail
- [ ] เปิด Registrar Lock + WHOIS Privacy
- [ ] สร้าง Cloudflare API token ใหม่ (scope แคบ)
- [ ] ลบ token เก่าที่หลุด
- [ ] ตรวจ git history ว่ามี secret หลุด (`git log -p | grep -i token`)
- [ ] ตั้ง Cloudflare Notification: alert เมื่อ API token ถูกสร้าง / DNS ถูกแก้
