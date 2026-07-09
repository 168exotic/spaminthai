# SpamInThai — Deploy Guide

**Stack:** Cloudflare Worker + static assets + Functions + KV (`SPAM_KV`)

**Domains:** `spaminthai.com`, `www.spaminthai.com`, `api.spaminthai.com`

---

## โครงสร้างไฟล์

```
spaminthai/
├── index.html              # apex landing (replaces Canva)
├── site/
│   ├── index.html
│   └── spaminthai-index-v3.html
├── check.html
├── download.html
├── privacy.html
├── terms.html
├── _redirects
├── wrangler.toml           # routes + custom domains
└── functions/
    ├── api/                lookup, report, app
    └── download/           apk, police.vcf
```

**KV binding:** `SPAM_KV` (`d1417790ca5841bebf80cbc25443e070`)

---

## Deploy

1. Push ไป GitHub — Cloudflare Git integration auto-deploys Pages project `spaminthai`
2. หรือรัน `npm run deploy` (ต้องมี `CLOUDFLARE_API_TOKEN`)
3. ตรวจว่า custom domains attach กับ Pages project:
   - `spaminthai.com`
   - `www.spaminthai.com`
   - `api.spaminthai.com`

## ตั้งค่า APK (ผ่าน API — ไม่ฝัง Google Drive ในหน้าเว็บ)

หน้าเว็บโหลดลิงก์ดาวน์โหลดจาก **`GET /api/app`** (`assets/site.js`) — ผู้ใช้เห็นแค่ `https://api.spaminthai.com/download/apk`

ไฟล์ APK จริงอยู่หลัง API ผ่าน env **`APK_SOURCE_URL`** (ตั้งเป็น Secret ใน Cloudflare Dashboard):

```
APK_SOURCE_URL=https://drive.google.com/uc?export=download&id=YOUR_FILE_ID
```

รองรับลิงก์แชร์ Google Drive แบบ `https://drive.google.com/file/d/FILE_ID/view` ด้วย — `apk.js` แปลงเป็น direct download ให้อัตโนมัติ

| Env | ใช้ทำอะไร |
|---|---|
| `APK_SOURCE_URL` (secret) | URL ต้นทางของไฟล์ APK (Google Drive / CDN) |
| `APP_VERSION` | เวอร์ชันใน `/api/app` |
| `APP_UPDATED_AT` | วันที่อัปเดต ISO 8601 |
| `APP_MIN_SDK` | minSdk (default 26) |

---

## Canonical public URLs

| Resource | URL |
|---|---|
| Landing | `https://spaminthai.com/` |
| APK | `https://api.spaminthai.com/download/apk` |
| Police vCard | `https://api.spaminthai.com/download/police.vcf` |
| Check page | `https://xn--42c7b1ab1c2gya5e.com/` |

`/download` และ `/download/apk` ทำงานบนทั้ง apex และ api host (backward compatible)

---

## ทดสอบหลัง deploy

```bash
curl -sSI https://spaminthai.com/
curl -sSI https://api.spaminthai.com/download/apk
curl -sSI https://api.spaminthai.com/download/police.vcf
curl -s https://api.spaminthai.com/api/app
```

---

## Seed KV (optional)

```bash
export CLOUDFLARE_API_TOKEN="account-scoped-token"
export CLOUDFLARE_ACCOUNT_ID="2fa3f2f325707bab89ef1c7452d3adb8"
export KV_NAMESPACE_ID="d1417790ca5841bebf80cbc25443e070"

npm run verify-token
npm run seed
```

ดู `docs/TOKEN-POLICY.md` สำหรับ token policy ที่ถูกต้อง
