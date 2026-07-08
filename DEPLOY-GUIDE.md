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

1. Push ไป GitHub — Cloudflare Git integration auto-deploys Worker `spaminthai`
2. หรือรัน `npm run deploy` (ต้องมี `CLOUDFLARE_API_TOKEN`)
3. ตรวจว่า custom domains ใน `wrangler.toml` ถูก attach แล้ว:
   - `spaminthai.com`
   - `www.spaminthai.com`
   - `api.spaminthai.com`

หลัง merge จาก Canva: ลบ Canva Website design แล้วชี้ DNS apex ไป Cloudflare (zone อยู่ใน account แล้ว)

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
curl -sSI https://api.spaminthai.com/api/lookup?number=0812345678
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
