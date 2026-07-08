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

## Seed KV (optional)

```bash
export CLOUDFLARE_API_TOKEN="account-scoped-token"
export CLOUDFLARE_ACCOUNT_ID="2fa3f2f325707bab89ef1c7452d3adb8"
export KV_NAMESPACE_ID="d1417790ca5841bebf80cbc25443e070"

npm run verify-token
npm run seed
```

ดู `docs/TOKEN-POLICY.md` สำหรับ token policy ที่ถูกต้อง
