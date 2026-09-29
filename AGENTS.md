# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
SpamInThai website — Cloudflare Pages app with:
- `index.html` — homepage with embedded `/api/lookup` widget
- `check.html` — full check + report page at `/check`
- `functions/api/` — lookup and report API backed by KV (`SPAM_KV`)

No build step. Deploy notes in `DEPLOY-GUIDE.md`.

### Running locally
- `npm run dev` → `http://localhost:8788`
- Local KV is provided by Miniflare; remote KV id in `wrangler.jsonc` is for production only.

### Gotchas
- **`_redirects` + wrangler pages dev:** `/check /check.html 200` can loop locally because wrangler also clean-URLs `/check.html` → `/check`. Production Cloudflare Pages is fine. For local browser testing, temporarily rename `_redirects` or open `http://localhost:8788/check.html` directly.
- **Persist KV outside repo:** dev script uses `--persist-to /tmp/wrangler-state` to avoid wrangler reload loops.
- **`.assetsignore`:** prevents serving `node_modules` as static assets.

### 🔒 นโยบายเว็บ spaminthai.com (บังคับใช้กับทุก agent — Cursor, Copilot, Claude, n8n)

- **ผู้ดูแลเว็บ:** ตั้งแต่ 29 ก.ย. 2569 **Claude เป็นผู้จัดการเว็บ spaminthai.com แต่เพียงผู้เดียว** ตามคำสั่งบอส — agent อื่นห้ามแก้หน้าเว็บ/ปุ่ม/ลิงก์/workflow deploy เอง ให้แจ้งบอสหรือ Claude
- **ปุ่มดาวน์โหลดแอปทุกปุ่มต้องลิงก์ตรงไป Google Play:** `https://play.google.com/store/apps/details?id=com.jarvis.callblocker`
  พร้อม `target="_blank" rel="noopener noreferrer"` — **ห้าม** ใส่ลิงก์ `/download/spaminthai-latest.apk`, GitHub Releases APK หรือ `/download` (หน้าเก่า) บนปุ่ม/ลิงก์ดาวน์โหลดใด ๆ (nav, tab, hero, popup, footer, ข่าว, บทความ, `functions/check/render-number-page.js`)
- `/api/app` และ `/api/latest-version` ต้องคืน `downloadUrl`/`url` เป็นลิงก์ Google Play (ดู `functions/api/app-download.js`) และ `/download/spaminthai-latest.apk` ต้อง 302 ไป Google Play
- **Source of truth = repo นี้ (ตั้งแต่ 29 ก.ย. 2569):** overlay `deploy/spaminthai/` ใน `168exotic/mysite` ถูกรวมเข้ามาที่นี่แล้ว (หน้าแรก, `/check`, `_headers`, `ads.txt`, assets/แบนเนอร์, ข่าว ก.ย. 2569) และ**เลิกใช้** — แก้เว็บที่ repo นี้เท่านั้น อย่ากลับไปแก้ overlay ใน mysite (workflow ที่นั่นจะ fail เตือน)
- **Deploy:** push `main` (หรือ `workflow_dispatch`) → `deploy.yml` รัน `scripts/apply-play-store-links.sh` เป็น safety net แล้ว **fail build ถ้ายังเจอลิงก์ APK/`/download` ใน `<a>`** หรือถ้า `ads.txt`/`_headers`/AdSense tag หาย จากนั้น `wrangler pages deploy .` และตรวจหน้าแรกที่ deploy แล้ว (ลิงก์ Google Play ต้องอยู่, ห้ามมี APK)
- **Google AdSense (ห้ามลบ):** `ca-pub-2455374115304550` — meta + `adsbygoogle.js` ใน `index.html`, `check.html`, `news-1..4.html`; `ads.txt`; CSP ใน `_headers` ต้องมี `pagead2.googlesyndication.com` — ห้ามนำออกจนกว่า AdSense จะอนุมัติและแสดงโฆษณาจริง

### Mail token / tokens ที่กำลังหมดอายุ (handoff สำหรับ agent อื่น)

**สำคัญ:** repo นี้ **ไม่มี** env ชื่อ `MAIL_TOKEN` และ **ไม่มี** API ส่งอีเมล (ไม่มี SMTP/Resend/Mailgun ใน `functions/`)

ถ้าผู้ใช้พูดถึง “mail token” ให้แยกความหมายก่อน:

| สิ่งที่อาจหมายถึง | ใช้ทำอะไร | อยู่ที่ไหน |
|---|---|---|
| **`CLOUDFLARE_API_TOKEN`** (มักเรียก “main token” ไม่ใช่ mail) | Deploy Cloudflare Pages (`deploy.yml`), bust sitemap cache (`seo-triple-daily.yml`), seed/verify KV นอก CI (`scripts/verify-token.js`, `seed-spam-numbers.js`) | GitHub secret `CLOUDFLARE_API_TOKEN` → ดู `.github/SECRETS-SETUP.md`, policy ดู `docs/TOKEN-POLICY.md` |
| **อีเมลโดเมน `admin@spaminthai.com`** | รับอีเมลติดต่อจากผู้ใช้ (`mailto:` ใน `vps/www/index.html`) — **ไม่ถูกเรียกจากโค้ดเว็บ** | Hostinger (MX/DKIM) — แยกจาก repo; อย่าเปลี่ยน DNS โดยไม่ตั้งใจเมื่อย้าย apex ไป Pages |
| **ช่องทางอีเมลในฟอร์ม dispute** | เก็บ `contact_value` ใน KV เท่านั้น — **ไม่ส่งออกทาง SMTP** | `functions/api/dispute.js`, `dispute.html` |

#### `CLOUDFLARE_API_TOKEN` — รายละเอียดเมื่อใกล้หมดอายุ

- **งานที่พังถ้า token หมดอายุ:** push ไป `main` แล้ว GitHub Actions “Deploy to Cloudflare Pages” ล้ม (401 ที่ขั้น verify); workflow SEO อาจ skip cache bust
- **สิทธิ์ขั้นต่ำ (account-level):** Cloudflare Pages → Edit; Workers KV Storage → Edit (ถ้า seed KV)
- **ห้าม:** ใส่ JSON metadata ของ token แทน secret string; ใช้ zone-scoped token แทน account-scoped (seed KV จะพัง — ดู `broken-lab-8596` ใน `docs/TOKEN-POLICY.md`)
- **ต่ออายุ:** สร้าง token ใหม่ที่ [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → อัปเดต secret ที่ https://github.com/168exotic/spaminthai/settings/secrets/actions → re-run workflow หรือ push ใหม่
- **ทดสอบก่อนอัปเดต secret:**
  ```bash
  export CLOUDFLARE_API_TOKEN="…"
  export CLOUDFLARE_ACCOUNT_ID="2fa3f2f325707bab89ef1c7452d3adb8"
  curl -fsS "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/spaminthai" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  ```

#### Token อื่นในโปรเจกต์ (ไม่ใช่ mail)

| Secret | ใช้ทำอะไร |
|---|---|
| `MARKETING_CRON_SECRET` | ยืนยัน `POST /api/marketing/run` + GitHub Actions marketing |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | โพสต์ Telegram อัตโนมัติ |
| `DISCORD_WEBHOOK_URL` | โพสต์ Discord (ถ้ามี) |
| `VPS_SSH_*` | deploy `vps/www/` ไป www.เบอร์ใคร.com |
| `TIP_ADMIN_PASSWORD` | admin API (Cloudflare Pages env ไม่ใช่ GitHub) |
