# คู่มือส่งแอปขึ้น Google Play (Internal Testing) — ทีละขั้น

เป้าหมาย: เอาแอปขึ้น **Internal Testing** ให้เร็วที่สุด เพราะ Play Protect เชื่อถือแอปที่มาจาก Play อัตโนมัติ → ผู้ใช้ติดตั้งได้ไม่มีคำเตือน "harmful app"

⏱️ เวลารวมโดยประมาณ: 60–90 นาที (ไม่รวมรอ Google รีวิว 1–6 ชม.)

> ทุกไฟล์ที่อ้างถึงอยู่ในโฟลเดอร์ `docs/playstore/` ของ repo spaminthai

---

## ขั้นที่ 0 — เตรียมของให้พร้อมก่อน
- [ ] ไฟล์ **AAB** — ดาวน์โหลด `spaminthai-v2.0.0.aab` จากหน้า GitHub Release (เมื่อ workflow build เสร็จ)
- [ ] **นโยบายความเป็นส่วนตัว** — พร้อมแล้วที่ https://spaminthai.com/privacy
- [ ] **Feature graphic 1024×500** — ทำตาม `feature-graphic-brief.md`
- [ ] **App icon 512×512** (PNG)
- [ ] **Screenshots 6 รูป** — ถ่ายตาม `screenshots-plan.md`
- [ ] อีเมลผู้ทดสอบ (tester) อย่างน้อย 1 อีเมล (ใช้ Gmail ของคุณเองก็ได้)
- [ ] บัตรเครดิต/เดบิต สำหรับค่าสมัคร $25 (ครั้งเดียว ตลอดชีพ)

---

## ขั้นที่ 1 — สมัคร Google Play Developer ($25)
1. เข้า https://play.google.com/console/signup
2. ล็อกอินด้วยบัญชี Google ที่ต้องการใช้เป็นเจ้าของแอป
3. เลือกประเภทบัญชี: **ตัวเอง (Personal)** หรือ **องค์กร (Organization)**
   - ถ้าต้องการความเป็นนิรนาม/แยกจากชื่อจริง เลือก Organization และใช้ชื่อ "SpamInThai" (ต้องมีเอกสารยืนยันองค์กร) — ถ้าไม่มีเอกสาร ใช้ Personal ไปก่อนได้
4. จ่ายค่าสมัคร **$25** (ครั้งเดียว)
5. ยืนยันตัวตนตามที่ Google ขอ (อาจต้องใช้บัตรประชาชน — เป็นขั้นตอนของ Google เอง)

> หมายเหตุ: การยืนยันตัวตนบัญชีนักพัฒนาอาจใช้เวลา 1–2 วันในบางกรณี เริ่มขั้นนี้ก่อนเลย

---

## ขั้นที่ 2 — สร้างแอปใน Play Console
1. Play Console → **Create app**
2. กรอก:
   - App name: `SpamInThai เช็ค·บล็อกเบอร์มิจ` (ดู `store-listing-th.md`)
   - Default language: **ไทย (Thai)**
   - App or game: **App**
   - Free or paid: **Free**
3. ติ๊กยอมรับ Developer Program Policies + US export laws → **Create app**

---

## ขั้นที่ 3 — อัปโหลด AAB เข้า Internal Testing
1. เมนูซ้าย → **Testing → Internal testing**
2. กด **Create new release**
3. หัวข้อ **App signing**: เลือก **Use Google-generated key** (แนะนำ — ดู `aab-signing-notes.md`)
4. ลากไฟล์ `spaminthai-v2.0.0.aab` เข้าช่อง App bundles
5. Release name: `2.0.0` · Release notes: คัดลอกจากส่วน "What's new" ใน `store-listing-th.md`
6. กด **Next → Save** (ยังไม่ต้อง Roll out ตอนนี้ก็ได้ ทำ App content ให้ครบก่อน)

---

## ขั้นที่ 4 — กรอก App content (ส่วนบังคับ)
เมนูซ้าย → **App content** ทำให้ครบทุกหัวข้อ (จะมีเครื่องหมายเมื่อเสร็จ):

| หัวข้อ | ทำอย่างไร | ไฟล์อ้างอิง |
|---|---|---|
| **Privacy policy** | วาง URL: `https://spaminthai.com/privacy` | — |
| **Data safety** | ตอบตามตารางที่เตรียมไว้ | `data-safety-form.md` |
| **Content rating** | ทำแบบสอบถาม IARC ตอบตามที่เตรียม | `content-rating-answers.md` |
| **Target audience** | เลือกอายุ 18+ (หรือ 13+) — ไม่ใช่แอปสำหรับเด็ก | — |
| **App access** | ถ้าฟีเจอร์ SMS ต้องเปิดเอง ให้เลือก "All functionality available without special access" หรืออธิบายว่าเปิดใน Settings | `permissions-declaration.md` |
| **Ads** | เลือก **No ads** (แอปเราไม่มีโฆษณา) | — |
| **Sensitive permissions** (Notification Listener / Call Log) | กรอกคำชี้แจงตามสคริปต์ | `permissions-declaration.md` |
| **Government apps** | No | — |

---

## ขั้นที่ 5 — กรอก Store listing + กราฟิก
1. เมนูซ้าย → **Grow → Store presence → Main store listing**
2. กรอก App name / Short / Full description จาก `store-listing-th.md`
3. อัปโหลด:
   - **App icon** 512×512
   - **Feature graphic** 1024×500 (ดู `feature-graphic-brief.md`)
   - **Phone screenshots** 6 รูป (ดู `screenshots-plan.md`)
4. (ทางเลือก) เพิ่มภาษา English → ใช้ `store-listing-en.md`
5. Save

---

## ขั้นที่ 6 — เพิ่มผู้ทดสอบ (testers) แล้ว Roll out
1. กลับไป **Testing → Internal testing → Testers**
2. สร้าง email list → ใส่อีเมล Gmail ผู้ทดสอบ (ใส่ของตัวเองก่อนได้)
3. กลับไปแท็บ **Releases** → เปิด release 2.0.0 → **Review release → Start rollout to Internal testing**
4. คัดลอก **"Copy link"** (ลิงก์เข้าร่วมทดสอบ) เก็บไว้

---

## ขั้นที่ 7 — รอ Google + ติดตั้งผ่าน Play
1. Internal testing มักได้รับอนุมัติเร็ว (ปกติ **1–6 ชม.**, บางครั้งเร็วกว่า)
2. เปิดลิงก์ทดสอบบนมือถือที่ล็อกอินด้วยอีเมล tester → กด **Become a tester** → **Download on Google Play**
3. ติดตั้งจาก Play → **ไม่มีคำเตือน Play Protect อีกต่อไป** ✅

---

## ✅ เช็กลิสต์สรุปก่อนกด Roll out
- [ ] AAB 2.0.0 อัปโหลดแล้ว, เลือก Google-generated signing key
- [ ] Privacy policy URL ใส่แล้ว
- [ ] Data safety ตอบครบ
- [ ] Content rating เสร็จ
- [ ] Sensitive permissions (Notification Listener + Call Log) ชี้แจงแล้ว
- [ ] Store listing + icon + feature graphic + 6 screenshots ครบ
- [ ] เพิ่ม tester email แล้ว
- [ ] กด Start rollout

## ถ้าโดน reject
- สาเหตุที่พบบ่อยที่สุด = **Notification Listener / Call Log permission** → เปิด `permissions-declaration.md` แล้วตอบกลับตามสคริปต์ พร้อมแนบวิดีโอสั้นแสดงว่าแอปใช้สิทธิ์นั้นทำอะไร
- Data safety ไม่ตรงกับที่แอปทำ → ปรับให้ตรง `data-safety-form.md`
- ติดต่อทีม: admin@spaminthai.com

---
ทุกอย่างพร้อมแล้ว เริ่มที่ขั้นที่ 1 ได้เลย 🚀
