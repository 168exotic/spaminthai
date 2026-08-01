# ตั้งค่า Google Search Console สำหรับ spaminthai.com

คู่มือทีละขั้นสำหรับยืนยันโดเมน ส่ง sitemap และขอให้ Google จัดทำดัชนี (index) ใหม่
ใช้เวลาประมาณ 15 นาที + รอ Google ประมวลผล 1–3 วัน

---

## ขั้นที่ 1 — เพิ่มโดเมนใน Search Console

1. เข้า https://search.google.com/search-console แล้วล็อกอินด้วยบัญชี Google
2. กด **Add property** → เลือกฝั่งซ้าย **Domain** (ไม่ใช่ URL prefix)
3. พิมพ์ `spaminthai.com` แล้วกด **Continue**
4. Google จะให้ **TXT record** หน้าตาประมาณ:
   ```
   google-site-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   **คัดลอกค่านี้ไว้** (อย่าเพิ่งกด Verify)

## ขั้นที่ 2 — เพิ่ม TXT record ใน Cloudflare DNS

1. เข้า https://dash.cloudflare.com → เลือกโดเมน `spaminthai.com`
2. เมนู **DNS → Records → Add record**
3. กรอก:
   | ช่อง | ค่า |
   |---|---|
   | Type | `TXT` |
   | Name | `@` (คือ root domain) |
   | Content | วางค่า `google-site-verification=…` ที่คัดลอกมา |
   | TTL | Auto |
4. กด **Save**
5. รอ 1–5 นาที (DNS ใน Cloudflare อัปเดตเร็ว)

## ขั้นที่ 3 — กด Verify

1. กลับไปหน้า Search Console → กด **Verify**
2. ถ้าขึ้น "Ownership verified" = สำเร็จ ✅
3. ถ้ายังไม่ผ่าน รออีก 5–10 นาทีแล้วลองใหม่ (DNS ยังไม่กระจาย)

---

## ขั้นที่ 4 — ส่ง Sitemap

1. ในเมนูซ้ายของ Search Console → **Sitemaps**
2. ช่อง "Add a new sitemap" พิมพ์: `sitemap.xml`
   (ระบบจะต่อเป็น `https://spaminthai.com/sitemap.xml` ให้)
3. กด **Submit**
4. สถานะจะขึ้น "Success" และค่อย ๆ แสดงจำนวน URL ที่พบ (Discovered URLs)

> Sitemap ของเราเป็นแบบ dynamic รวมหน้าเว็บหลัก, คู่มือ (/guide/*), บทความ (/blog/*)
> และหน้าเบอร์ที่ถูกรายงาน (/check/:num) โดยอัปเดตอัตโนมัติ (แคช ~1 ชม.)

## ขั้นที่ 5 — ขอให้จัดทำดัชนีหน้าสำคัญ (Request Indexing)

เร่งให้ Google เก็บหน้าสำคัญก่อน:
1. เมนูบนสุด ช่อง **"Inspect any URL"** พิมพ์ URL เช่น
   - `https://spaminthai.com/`
   - `https://spaminthai.com/check`
   - `https://spaminthai.com/blog`
   - `https://spaminthai.com/blog/call-center-scam-guide-2568`
2. รอผลตรวจ → กด **Request Indexing**
3. ทำซ้ำกับหน้าที่อยากให้ติดอันดับเร็ว (วันละไม่เกิน ~10 URL)

> **สำคัญ — หลังแก้ title/คำอธิบายหน้าแรก:** ทุกครั้งที่เปลี่ยน `<title>` หรือ meta description
> ของหน้าแรก (เช่น รอบนี้ที่ปรับให้ตรงคำว่า "เบอร์ใคร" และ "ตรวจเบอร์") ให้เข้า
> **Inspect** `https://spaminthai.com/` แล้วกด **Request Indexing** ซ้ำ เพื่อให้ Google
> เก็บ title ใหม่เร็วขึ้น (ปกติเห็นผลใน SERP ~3–14 วัน) ถ้าไม่กดขอ Google อาจใช้ title
> เดิมที่แคชไว้ไปอีกหลายสัปดาห์

---

## ตรวจสอบหลังตั้งค่า (ทำหลัง 2–3 วัน)

- **Pages** → ดูว่ามีหน้า "Indexed" เพิ่มขึ้น
- **Sitemaps** → Discovered URLs ควรเท่ากับจำนวนใน sitemap.xml
- **Performance** → เริ่มเห็น query ที่คนค้นเจอเว็บ (เช่น "เช็คเบอร์", "แก๊งคอลเซ็นเตอร์")

## เคล็ดลับ

- ยืนยันแบบ **Domain property** ครอบคลุมทั้ง www / non-www / http / https ในที่เดียว
- ถ้าเปลี่ยน TXT record อย่าลบตัวเดิมทิ้งจนกว่าจะ verify ผ่าน
- หน้า `/admin/*` และ `/api/*` ถูกกันไว้ใน `robots.txt` แล้ว ไม่ต้องส่งเข้า index
- Sitemap รีเฟรชอัตโนมัติทุก ~1 ชม. ถ้าเพิ่มบทความใหม่ Google จะเจอเองในรอบถัดไป

## ลิงก์ที่เกี่ยวข้อง

- Search Console: https://search.google.com/search-console
- Cloudflare DNS: https://dash.cloudflare.com
- Rich Results Test (ตรวจ structured data): https://search.google.com/test/rich-results
- Sitemap: https://spaminthai.com/sitemap.xml
- robots.txt: https://spaminthai.com/robots.txt
- เชื่อม GA4 กับ Search Console: [google-analytics-4-setup.md](./google-analytics-4-setup.md)
