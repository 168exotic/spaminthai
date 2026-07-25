# Security — SpamInThai

ระบบป้องกันการโจมตีสำหรับเว็บไซต์และ API ของ SpamInThai (Cloudflare Workers + KV + R2)

## ชั้นป้องกัน (Defense in depth)

### 1. HTTP Security Headers (ทุก response)

ผ่าน `_worker.js` → `withSecurityHeaders()`:

| Header | ค่า | ป้องกัน |
|--------|-----|---------|
| `Strict-Transport-Security` | 1 ปี + preload | downgrade HTTP |
| `Content-Security-Policy` | จำกัด script/style/connect | XSS, data exfil |
| `X-Frame-Options` | DENY | clickjacking |
| `X-Content-Type-Options` | nosniff | MIME sniffing |
| `Referrer-Policy` | strict-origin-when-cross-origin | รั่วข้อมูล referrer |
| `Permissions-Policy` | ปิด camera/mic/geo | สิทธิ์เบราว์เซอร์ที่ไม่จำเป็น |

### 2. Request filtering (ก่อน routing)

`detectThreat()` ใน `functions/api/_security.js` บล็อก:

- Path traversal (`../`, `%2e%2e`)
- Null bytes
- Query string ยาวเกิน 2 KB
- XSS probe patterns ใน URL
- Path ที่ bot มักสแกน (`.env`, `.git`, `wp-admin`, …)
- HTTP method ที่ไม่รองรับ (เช่น TRACE)

POST body เกิน 3 MB → `413 payload_too_large`

### 3. Rate limiting (KV, IP hashed)

| Endpoint | จำกัด | หมายเหตุ |
|----------|-------|----------|
| `GET /api/lookup` | 120/นาที/IP | ค้นหาเบอร์ |
| `POST /api/report` (web) | 30/ชม./IP | แจ้งเบาะแส |
| `POST /api/report` (app) | 10/ชม./device | `X-App-Key` + `deviceId` |
| `POST /api/event` | 60/นาที/IP | heartbeat แอป |
| `POST /api/dispute` | 3/ชม./IP | คำโต้แย้ง |
| `GET /api/latest-version` | 60/นาที/IP | อัปเดต APK |
| Admin APIs | 60/นาที/IP | หลัง auth สำเร็จ |

IP ถูก hash ก่อนเก็บใน KV — ไม่เก็บ IP ดิบ

### 4. Authentication

| ช่องทาง | วิธี |
|---------|------|
| Admin (`/api/admin/*`, `/admin/api/live-stats`) | `X-Admin-Key` = `TIP_ADMIN_PASSWORD` |
| Android app report | `X-App-Key` = `APP_REPORT_KEY` |
| Web forms | Cloudflare Turnstile (เมื่อตั้ง `TURNSTILE_SECRET`) |

**Admin brute-force lockout:** ผิดรหัส 5 ครั้ง → ล็อก IP 15 นาที (`locked_out` / 429)

### 5. Input validation

- เบอร์โทร: 9–10 หลัก, normalize +66
- รูปหลักฐาน: JPEG/PNG/WebP/HEIC เท่านั้น, สูงสุด 2 MB
- Dispute/report: enum ช่องทางติดต่อ, ความยาว reason, email regex
- Analytics vid: `[a-zA-Z0-9_-]{8,64}` + prefix `a` (app) / `w` (web)

### 6. CORS

API ตอบ `Access-Control-Allow-Origin` เฉพาะ:

- `https://spaminthai.com`
- `https://www.spaminthai.com`
- `https://xn--42c7b1ab1c2gya5e.com`

## Environment variables (Cloudflare Pages)

| Variable | ใช้ทำอะไร |
|----------|-----------|
| `TIP_ADMIN_PASSWORD` | รหัส admin API |
| `APP_REPORT_KEY` | คีย์แอป Android ส่งรายงาน |
| `TURNSTILE_SECRET` | เปิด captcha ฟอร์ม dispute/report |
| `IP_HASH_SALT` | salt เพิ่มเติมสำหรับ hash IP dispute (optional) |

## เปิด Turnstile (แนะนำ production)

1. สร้าง site ที่ [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. ตั้ง `TURNSTILE_SECRET` บน Pages project
3. เพิ่ม widget ในหน้า `dispute.html` และ `report.html` (ดู comment ในไฟล์)

เมื่อยังไม่ตั้ง secret → captcha เป็น no-op (ไม่บล็อกผู้ใช้)

## ทดสอบ

```bash
npm test   # รวม scripts/test-security.mjs
```

## แนะนำเพิ่มเติม (Cloudflare Dashboard)

- เปิด **Bot Fight Mode** / **Super Bot Fight Mode**
- ตั้ง **WAF custom rules** สำหรับ geo / ASN ที่ไม่เกี่ยวข้อง
- เปิด **Page Shield** ถ้าต้องการ monitor third-party scripts
- แยก API token ตาม `docs/TOKEN-POLICY.md` — อย่าใช้ token เดียวทุกงาน
