# ตั้งค่า Google Analytics 4 (GA4) สำหรับ spaminthai.com

เว็บโหลด GA4 ผ่าน `/assets/ga4.js` เมื่อมี Measurement ID ใน Cloudflare Pages env

## ขั้นที่ 1 — สร้าง GA4 property

1. เข้า https://analytics.google.com/
2. **Admin** → **Create property** → ชื่อ `SpamInThai`
3. เลือกโซนเวลา **Thailand** และสกุลเงิน **THB**
4. สร้าง **Web data stream** สำหรับ `https://spaminthai.com`
5. คัดลอก **Measurement ID** รูปแบบ `G-XXXXXXXXXX`

## ขั้นที่ 2 — ใส่ Measurement ID ใน Cloudflare Pages

1. https://dash.cloudflare.com → **Workers & Pages** → **spaminthai**
2. **Settings** → **Environment variables** → **Production**
3. เพิ่ม:
   | Variable | Value |
   |---|---|
   | `GA4_MEASUREMENT_ID` | `G-XXXXXXXXXX` (จากขั้นที่ 1) |
4. **Save** แล้ว **Redeploy** (หรือ push ไป `main` ให้ GitHub Actions deploy ใหม่)

## ขั้นที่ 3 — ตรวจสอบ

```bash
curl -fsS "https://spaminthai.com/api/site-config"
# ควรได้ {"ga4MeasurementId":"G-XXXXXXXXXX"}
```

ใน GA4 → **Reports** → **Realtime** เปิด https://spaminthai.com แล้วดูว่ามีผู้ใช้ active ภายใน ~30 วินาที

## เชื่อม GA4 กับ Google Search Console

1. GA4 → **Admin** → **Product links** → **Search Console links**
2. **Link** → เลือก property Search Console `spaminthai.com` (ดู [google-search-console-setup.md](./google-search-console-setup.md))
3. เปิด **Web streams** → ดูรายงาน search queries ใน GA4 ได้หลังเชื่อม

## หมายเหตุ PDPA

- GA4 เก็บข้อมูลการใช้งานเว็บ (หน้า, อุปกรณ์, ภูมิภาคโดยประมาณ)
- สคริปต์เปิด `anonymize_ip: true`
- อัปเดตนโยบายความเป็นส่วนตัวถ้าต้องการระบุ GA4 ชัดเจน

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `assets/ga4.js` | โหลด gtag เมื่อมี ID |
| `functions/api/site-config.js` | คืน `ga4MeasurementId` จาก env |
| `functions/api/_security.js` | CSP อนุญาต googletagmanager / google-analytics |
