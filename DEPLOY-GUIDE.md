# SpamInThai — Deploy Guide

**Stack:** Cloudflare Pages + Cloudflare Functions + KV Storage

---

## โครงสร้างไฟล์

```
spaminthai/
├── index.html
├── site/index.html
├── check.html
├── download.html
├── privacy.html
├── terms.html
├── _redirects
└── functions/
    ├── api/          lookup, report, app
    └── download/     police.vcf
```

**KV binding:** `SPAM_KV`

---

## Deploy

1. Push ไป GitHub repository ของโปรเจกต์
2. Cloudflare Dashboard → Workers & Pages → project `spaminthai`
3. Bind KV namespace `SPAM_KV` (variable name ต้องตรงเป๊ะ)
4. Auto-deploy หลัง push หรือ `npm run deploy`

## ทดสอบหลัง deploy

- https://spaminthai.com/
- https://spaminthai.com/check
- https://spaminthai.com/download
- https://spaminthai.com/download/police.vcf
- https://api.spaminthai.com/download/police.vcf
- https://spaminthai.com/api/lookup?number=0812345678
- https://spaminthai.com/api/app  → คืน `downloadUrl` ของ APK ล่าสุด
- https://api.spaminthai.com/download/apk  → APK จริงบน VPS (72.62.71.137, เสิร์ฟผ่าน nginx + Cloudflare proxy)
- https://spaminthai.com/download/spaminthai-latest.apk  → 302 redirect ไปที่ api.spaminthai.com/download/apk

## APK hosting

APK ล่าสุดโฮสต์บน **GitHub Releases** (v1.0.21+) — `/api/app`, ปุ่มดาวน์โหลดบน spaminthai.com,
และ redirect `/download/spaminthai-latest.apk` ชี้ไปที่ URL ของ release โดยตรง

## www.เบอร์ใคร.com (VPS)

โดเมน `xn--42c7b1ab1c2gya5e.com` (เบอร์ใคร.com) โฮสต์ frontend บน VPS แยกจาก Cloudflare Pages
ไฟล์อยู่ใน `vps/www/` — deploy ด้วย workflow `.github/workflows/deploy-vps.yml` (ต้องตั้ง secrets):

| Secret | ตัวอย่าง |
|---|---|
| `VPS_SSH_HOST` | `72.62.71.137` |
| `VPS_SSH_USER` | `root` |
| `VPS_SSH_KEY` | private key (PEM) |
| `VPS_DEPLOY_PATH` | `/var/www/spaminthai/public` |

ปุ่มดาวน์โหลดบน VPS ใช้ `data-download` + `vps/www/assets/site.js` ดึง URL ล่าสุดจาก `spaminthai.com/api/app`

## Seed KV (optional)

```bash
export CLOUDFLARE_API_TOKEN="account-scoped-token"
export CLOUDFLARE_ACCOUNT_ID="2fa3f2f325707bab89ef1c7452d3adb8"
export KV_NAMESPACE_ID="d1417790ca5841bebf80cbc25443e070"

npm run verify-token
npm run seed
```

ดู `docs/TOKEN-POLICY.md` สำหรับ token policy ที่ถูกต้อง
