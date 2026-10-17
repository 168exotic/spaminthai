# อีเมลยืนยันรับเรื่องถึงผู้แจ้งเบาะแส (`/report` → "ได้รับเรื่องแล้ว")

เมื่อมีคนส่งเบาะแสผ่าน https://spaminthai.com/report และกรอก **อีเมล** ในช่อง "ช่องทางติดต่อกลับ"
ระบบจะส่งอีเมลแบบเป็นทางการกลับไปทันทีว่าทีมงานได้รับเรื่องแล้ว (พร้อมเลขอ้างอิง ประเภทที่แจ้ง
สิ่งที่ทีมงานทำต่อ ข้อควรทราบว่า SpamInThai ไม่ใช่หน่วยงานรัฐ/ธนาคาร และคำแนะนำความปลอดภัย)
ถ้าช่องติดต่อกลับเป็น LINE ID จะไม่ส่ง (แอดมินพิมพ์อีเมลแล้วกดส่งเองได้จาก `/admin/tips`)

**ยังไม่ตั้งคีย์ = ยังไม่ส่ง** — เว็บทำงานเหมือนเดิมทุกอย่าง หน้า `/admin/tips` จะขึ้นแถบเตือนสีส้มจนกว่าจะตั้งค่าเสร็จ

## ตั้งค่าครั้งเดียว (ประมาณ 15 นาที) — ใช้ Resend

Cloudflare Pages ส่ง SMTP ไม่ได้ จึงส่งผ่าน HTTP API ของ [Resend](https://resend.com)
(แผนฟรีพอสำหรับงานนี้ — ตรวจโควตาล่าสุดที่ https://resend.com/pricing)

1. **สมัคร Resend** ด้วยอีเมลของบอส → เมนู **Domains → Add Domain** → ใส่ `spaminthai.com`
   (Region เลือกที่ใกล้ที่สุด เช่น Tokyo) → Resend จะแสดง DNS records ที่ต้องเพิ่ม
2. **เพิ่ม DNS ที่ Cloudflare** (nameserver ของ spaminthai.com อยู่ที่ Cloudflare: ashton/frida.ns.cloudflare.com)
   → Cloudflare dashboard → spaminthai.com → **DNS → Records → Add record** ใส่ตามที่ Resend บอกทุกรายการ
   (ปกติคือ TXT `resend._domainkey` สำหรับ DKIM, MX + TXT ที่ `send` สำหรับ SPF ของ return-path และ TXT `_dmarc`)
   - ตั้ง Proxy status เป็น **DNS only** (เมฆสีเทา) ทุกรายการ
   - **ไม่กระทบอีเมลเดิม**: MX ของ apex ยังเป็น mx1/mx2.hostinger.com และ SPF เดิม `v=spf1 include:_spf.mail.hostinger.com ~all` คงไว้ — Resend ใช้ subdomain `send.spaminthai.com` แยกต่างหาก ห้ามลบหรือแก้ record ของ Hostinger
   - กลับไปหน้า Domains ใน Resend กด **Verify** (รอ 1–10 นาที)
3. **สร้าง API key** → Resend → **API Keys → Create API Key** → Permission: *Sending access* → Domain: `spaminthai.com` → คัดลอกค่า `re_...` (เห็นครั้งเดียว)
4. **ใส่คีย์ใน Cloudflare Pages** → Workers & Pages → โปรเจกต์ **spaminthai** (ตัวที่มี spaminthai.pages.dev — ไม่ใช่ Worker ชื่อ spaminthai/spaminthai1/spaminthai-web) → **Settings → Environment variables**
   - `RESEND_API_KEY` = `re_...` (ติ๊ก **Encrypt/Secret**) — ใส่ทั้ง **Production** และ **Preview**
   - แนะนำเพิ่ม `MAIL_BCC` = `admin@spaminthai.com` เพื่อให้สำเนาอีเมลยืนยันทุกฉบับเข้ากล่อง admin ด้วย
5. **Deploy ใหม่** (deployment เดิมไม่เห็นค่า env ใหม่): GitHub → Actions → *Deploy to Cloudflare Pages* → **Run workflow** (หรือ push อะไรก็ได้ขึ้น `main`)
6. **ทดสอบ**: เปิด https://spaminthai.com/admin/tips → แถบด้านบนต้องเป็นสีเขียว "ส่งอีเมลยืนยันรับเรื่องอัตโนมัติผ่าน resend …" → เปิดเบาะแสอันไหนก็ได้ → ในกล่อง "อีเมลยืนยันรับเรื่องถึงผู้แจ้ง" พิมพ์อีเมลของบอสเอง → กด **ส่ง** → ต้องได้รับอีเมลภายในไม่กี่วินาที (เช็กกล่องสแปมด้วย)
   หรือทดสอบทั้งวงจรโดยส่งเบาะแสจริงที่ `/report` ใส่อีเมลตัวเอง

### ทางเลือก: Brevo แทน Resend

ถ้าไม่อยากแตะ DNS: [Brevo](https://www.brevo.com) ยืนยันแค่ *อีเมลผู้ส่ง* (`admin@spaminthai.com` — กดลิงก์ยืนยันที่ส่งเข้ากล่อง Hostinger) ก็ส่งได้
→ Brevo → **SMTP & API → API Keys → Generate** → ใส่ `BREVO_API_KEY` ใน Pages env แทน (ข้อ 4–5 เหมือนกัน)
ถ้าตั้งทั้งสองคีย์ ระบบจะใช้ Resend ก่อน; บังคับได้ด้วย `MAIL_PROVIDER=brevo`
(หมายเหตุ: ถ้าไม่ยืนยันโดเมนที่ Brevo ด้วย อีเมลมีโอกาสตกสแปมมากกว่า)

## ตัวแปร env ทั้งหมด (Cloudflare Pages)

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `RESEND_API_KEY` | – | คีย์ Resend (`re_...`) — มีค่า = เปิดระบบ |
| `BREVO_API_KEY` | – | คีย์ Brevo (`xkeysib-...`) — ใช้แทน Resend ได้ |
| `MAIL_PROVIDER` | auto | `resend` หรือ `brevo` ถ้าต้องการบังคับ |
| `MAIL_FROM` | `SpamInThai <admin@spaminthai.com>` | ชื่อ/ที่อยู่ผู้ส่ง (โดเมนต้องผ่านการ verify) |
| `MAIL_REPLY_TO` | `admin@spaminthai.com` | ที่อยู่ที่ผู้แจ้งกด "ตอบกลับ" แล้วไปถึง |
| `MAIL_BCC` | – | สำเนาลับทุกฉบับ (แนะนำ `admin@spaminthai.com`) |
| `MAIL_ACK_ENABLED` | `1` | ตั้ง `0` = ไม่ส่งอัตโนมัติ แต่ยังกดส่งเองจากหน้าแอดมินได้ |

## การทำงานในโค้ด

- `functions/api/mail.js` — `sendMail(env, {to, subject, text, html})` ผ่าน Resend/Brevo, timeout 8 วินาที, ไม่ throw (คืน `{ok, provider, id|error}`)
- `functions/api/tip-ack-mail.js` — ข้อความอีเมล (ไทยทางการ ไม่มีอีโมจิ ไม่มีเบอร์สายด่วน/ชื่อหน่วยงาน ไม่สัญญาผล) + `sendTipAckById()` ส่งแล้วบันทึกผลลง KV
- `functions/api/report.js` — หลังบันทึกเบาะแสแล้วเรียกส่งแบบ background (`ctx.waitUntil`) → คำตอบ API มี `ackEmail: queued|sent|failed|skipped`; หน้า `/report` แจ้งผู้ใช้ว่าส่งอีเมลยืนยันแล้วพร้อมเลขอ้างอิง 8 ตัว
- ผลการส่งเก็บไว้ที่ `tip:<id>.ackEmail = { to, sentAt, provider, messageId, attempts, lastTriedAt, lastError }` และ `tips:index[].ackSent`
- `POST /api/admin/tips/:id/ack-email` (header `X-Admin-Key`, body `{ "to": "..." }` ไม่บังคับ) = ส่ง/ส่งซ้ำจากหน้าแอดมิน
- ส่งอัตโนมัติ **ครั้งเดียวต่อเบาะแส** (ถ้าส่งสำเร็จแล้วจะไม่ส่งซ้ำเอง) — ปุ่มในหน้าแอดมินเป็นการบังคับส่ง
- เลขอ้างอิงในอีเมล = 8 ตัวแรกของ tip id (ตัวพิมพ์ใหญ่) ตรงกับที่แสดงในหน้า `/admin/tips`
- เนื้อหารายละเอียดที่ผู้แจ้งพิมพ์ **ไม่ถูกส่งกลับในอีเมล** (กันข้อมูลรั่วถ้าอีเมลถูกส่งต่อ) และระบบไม่ log อีเมลผู้รับ
- ทดสอบ: `node scripts/test-tip-ack-mail.mjs` (รวมอยู่ใน `npm test`)

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| แถบในหน้าแอดมินยังสีส้ม "ยังไม่ได้ตั้งค่าระบบส่งอีเมล" ทั้งที่ใส่คีย์แล้ว | ยังไม่ได้ deploy ใหม่หลังเพิ่ม env → Run workflow *Deploy to Cloudflare Pages* |
| กดส่งแล้วขึ้น "domain is not verified" / 403 / 422 | ยังไม่ได้ใส่ DNS ครบหรือยังไม่กด Verify ใน Resend; หรือ `MAIL_FROM` ใช้โดเมนอื่น |
| ส่งสำเร็จแต่ผู้รับไม่เห็น | เช็กกล่องสแปม; ดูสถานะที่ Resend → Emails (Delivered/Bounced); ใส่ DMARC record ตามที่ Resend แนะนำ |
| `ackEmail: skipped` ในคำตอบ `/api/report` | ช่องติดต่อไม่ใช่อีเมล, ไม่มีคีย์, หรือ `MAIL_ACK_ENABLED=0` |
| `ackEmail: failed` | ดูเหตุผลที่ `lastError` ในหน้า `/admin/tips` แล้วกด "ลองส่งอีกครั้ง" |

## ยังไม่ทำ (ทำต่อได้ถ้าต้องการ)

- ฟอร์ม `/dispute` (โต้แย้งผลตรวจ) ยังไม่ส่งอีเมลยืนยัน — โครงสร้างเดียวกัน เพิ่มได้ด้วย `sendMail()`
- อีเมลแจ้งผลเมื่อแอดมินเปลี่ยนสถานะเป็น "ดำเนินการแล้ว"/"ปิดเคส"
