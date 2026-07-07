# SpamInThai Check Page — Deploy Guide

**สิ่งที่จะได้:** หน้า `spaminthai.com/check` — เว็บเช็คเบอร์มิจฉาชีพ + รายงานเบอร์ + FAQ SEO

**Stack:** Cloudflare Pages + Cloudflare Functions + KV Storage (ทั้งหมด ฟรี)

---

## 📂 โครงสร้างไฟล์

```
spaminthai/                      <- root ของ repo 168exotic/spaminthai
├── index.html                   <- หน้าแรก (ฝัง API เช็คเบอร์)
├── check.html                   <- หน้าเช็คเบอร์เต็มรูปแบบ
├── _redirects                   <- Cloudflare Pages routing (pretty URL)
└── functions/
    └── api/
        ├── lookup.js            <- GET /api/lookup?number=X
        └── report.js            <- POST /api/report
```

**Cloudflare KV binding:** `SPAM_KV`

---

## 🚀 Deploy Steps (10 นาที)

### Step 1: Commit + Push ไป GitHub

**Option A — ผ่าน GitHub Web UI (ง่ายสุด):**
1. เข้า https://github.com/168exotic/mysite
2. Add file → Upload files → ลาก 3 ไฟล์เข้า:
   - `check.html`
   - `_redirects`  (ต้องใส่ตัวจุดหน้าชื่อ! ถ้า GitHub ไม่ยอมให้ upload → สร้าง `redirects.txt` ก่อน แล้ว rename)
   - โฟลเดอร์ `functions/api/` → `lookup.js`, `report.js`
3. Commit message: `feat: add /check page for spam number lookup`

**Option B — ผ่าน Git command line:**
```bash
cd path/to/mysite-local-clone
cp -r ~/OneDrive/Desktop/spaminthai-check-deploy/* .
git add .
git commit -m "feat: add /check page for spam number lookup"
git push origin main
```

### Step 2: Setup Cloudflare KV Namespace

1. เข้า https://dash.cloudflare.com
2. เลือก **Workers & Pages** → **KV**
3. คลิก **Create a namespace**
4. ตั้งชื่อ: `SPAM_KV` (หรือชื่อไหนก็ได้ แต่ต้องจำ ID)
5. **Copy Namespace ID** ที่ได้ (จะใช้ใน Step 3)

### Step 3: Connect KV กับ Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → เลือก project `spaminthai` (repo `168exotic/spaminthai`)
2. **Settings** → **Bindings** → **Add binding** → **KV Namespace**
3. Variable name: `SPAM_KV` (ต้องตรงกับที่ใช้ใน code!)
4. KV namespace: เลือก `SPAM_KV` ที่สร้างใน Step 2
5. **Save**

### Step 4: Redeploy Pages

- Cloudflare Pages จะ auto-deploy หลัง git push
- หรือ deploy manual: `npm run deploy` (ต้องมี `CLOUDFLARE_API_TOKEN`)
- ถ้ายังไม่ deploy → ไปที่ Deployments tab → คลิก **Retry deployment** ที่ deployment ล่าสุด

### Step 5: Test

**เปิด browser ทดสอบ:**

0. **หน้าแรก:** https://spaminthai.com/
   - เห็น homepage พร้อม widget เช็คเบอร์ (เรียก `/api/lookup`)
   - ลิงก์ไป `/check` และ `#download` ทำงาน

1. **หน้าเช็ค:** https://spaminthai.com/check
   - เห็น UI indigo theme
   - พิมพ์เบอร์ 0812345678 → กด "เช็คเบอร์"
   - ควรเห็น "ยังไม่พบรายงาน"

2. **API lookup:** https://spaminthai.com/api/lookup?number=0812345678
   - ควรได้ JSON: `{"reports":0,"categories":{},"lastReport":null}`

3. **API report** (test ด้วย browser DevTools):
   ```javascript
   fetch('/api/report', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({number: '0812345678', category: 'scam'})
   }).then(r => r.json()).then(console.log)
   ```
   ควรได้: `{"ok":true,"reports":1}`

4. **Test rate limit:** call report 2 ครั้งด้วย IP + number เดิม
   - ครั้งที่ 2 ต้องได้: `{"ok":true,"deduped":true}`

5. **Test URL sharing:** https://spaminthai.com/check?number=0812345678
   - ควร auto-check ทันทีเมื่อ page load

---

## 🔒 Security ที่ผมตรวจแล้ว

- ✅ Input validation: 9-10 digits only
- ✅ Category whitelist: [scam, callcenter, ads, loan, safe]
- ✅ CORS restricted: allow only https://spaminthai.com
- ✅ Rate limit: 1 IP/number/day (24h TTL)
- ✅ No PII stored (only phone numbers + counts + timestamp)
- ✅ Edge cache 60s → lower KV read cost
- ✅ Uses `CF-Connecting-IP` header (real IP behind Cloudflare)

---

## 💰 Cost Estimate

**Cloudflare Pages Free tier:**
- Unlimited bandwidth ✅
- 500 builds/month ✅

**Cloudflare KV Free tier:**
- 100,000 reads/day ✅
- 1,000 writes/day ✅
- 1 GB storage ✅

**เมื่อไหร่จะเกิน?**
- Free tier รองรับ **~10,000 unique users/day** สบายๆ
- ถ้าเกิน → $5/month Workers Paid tier → 10M reads + 1M writes/month

---

## 🎯 Seeding เบอร์มิจฉาชีพเข้า KV (Optional)

**ถ้ามีฐานข้อมูลเบอร์อยู่แล้ว (จาก AOC 1441, ปันทิป, ฯลฯ):**

ผมเขียน script Node.js ให้ import ได้:
```javascript
// seed-spam-numbers.js
const fs = require('fs');
const numbers = JSON.parse(fs.readFileSync('spam-numbers.json'));

// Use Cloudflare API to bulk PUT to KV
for (const {number, category} of numbers) {
  const key = `num:${number}`;
  const value = JSON.stringify({
    reports: 5,
    categories: {[category]: 5},
    lastReport: Date.now()
  });
  // PUT to KV via CF API...
}
```

**บอกผมถ้าอยากทำ** — ต้องการ Cloudflare API token + KV Namespace ID

---

## 🐛 Troubleshoot

**"Function not found" error:**
- ตรวจโครงสร้างไฟล์ถูกต้อง: `functions/api/lookup.js` (ต้องมี `functions/` เป็น folder ที่ root)

**"env.SPAM_KV is undefined":**
- KV binding ยังไม่ setup — return Step 3
- Variable name ต้องเป็น `SPAM_KV` ตัวใหญ่ตรงเป๊ะ

**"CORS error" ตอนเรียก /api:**
- Origin ที่เรียกต้องเป็น `https://spaminthai.com` (ตาม `Access-Control-Allow-Origin`)
- ถ้าอยากเปิดกว้าง → เปลี่ยนเป็น `'*'`

**"429 Too Many Requests":**
- Rate limit — 1 IP/number/day
- Feature ที่ต้องการ ไม่ใช่ bug

---

## 📊 หลัง Deploy — Growth Strategy

**Week 1-2:** Seed database
- Import เบอร์มิจฉาชีพจาก AOC 1441 public list
- 1,000-5,000 เบอร์ = database มีมูลค่าตั้งแต่วันแรก

**Week 3-4:** SEO
- Submit `spaminthai.com/check` ไป Google Search Console
- Target keyword: "เช็คเบอร์โทร", "เบอร์นี้ใครโทรมา"
- 1-3 เดือน = rank Top 10

**Month 2+:** Viral loop
- User ถูกโทรก่อกวน → Google หาข้อมูลเบอร์ → เจอ spaminthai.com/check → 
- เห็นรายงาน → กด "รายงาน" (เพิ่ม data) → เห็น CTA → download แอป
- ยิ่ง user รายงานเยอะ → data ยิ่งครอบคลุม → SEO ยิ่งดี → traffic ยิ่งเพิ่ม

**Month 6+:** B2B API
- ธนาคาร/telco เห็น data ที่มี → ซื้อ lookup API subscription
- Pricing: $99/month/10,000 lookups หรือ $0.01/lookup

---

**ผมพร้อมช่วยขั้นตอนถัดไปครับ:**
- Seed database (ถ้ามีข้อมูล)
- Google Search Console setup
- B2B pitch deck

**พร้อม deploy บอสสั่งได้เลย 🚀**

— A (เอ)
2026-07-06
