# Social posting — Facebook Page + Instagram

คลังคอนเทนต์ (รูป + แคปชัน) สำหรับเพจ Facebook / Instagram ดูแลโดย Claude (ผู้บริหารเว็บ)

> **เพจมีระบบโพสต์อัตโนมัติรายวันของตัวเองอยู่แล้ว (อยู่นอก repo นี้)** — workflow ในนี้จึง **ปิดการตั้งเวลา** ไว้ เพื่อไม่ให้โพสต์ซ้ำ ใช้ไฟล์ในคิวนี้ป้อนให้ระบบเดิมแทน: รูป `https://spaminthai.com/assets/social/<id>.png` + แคปชันใน `posts.json`

| ไฟล์ | หน้าที่ |
|---|---|
| `marketing/social/posts.json` | คิวโพสต์ (วันที่, รอบ am/pm, หัวข้อ, ข้อความในรูป, แคปชัน) |
| `scripts/social/render.mjs` | สร้างรูป 1080×1080 → `assets/social/<id>.png` (ต้องมี playwright) |
| `scripts/social/post.mjs` | โพสต์รูปของรอบนี้ไป Facebook Page และ Instagram ผ่าน Graph API |
| `.github/workflows/social-daily.yml` | ตั้งเวลาโพสต์ / รันเองได้ (มี dry run) |

## ตั้งค่าครั้งเดียว (บอสทำ)

ใส่ GitHub secrets ที่ https://github.com/168exotic/spaminthai/settings/secrets/actions

- `FB_PAGE_ID` — ID ของเพจ SPAM IN THAI Official
- `FB_PAGE_TOKEN` — Page access token แบบไม่หมดอายุ จากแอป Meta `spaminthai-poster1` (สิทธิ์ `pages_manage_posts`, `pages_read_engagement`, และ `instagram_basic`, `instagram_content_publish` ถ้าจะโพสต์ IG)
- `IG_USER_ID` — Instagram Business/Creator account ID ที่ผูกกับเพจ (ไม่ใส่ = โพสต์แค่ Facebook)

ยังไม่ใส่ secrets = workflow ไม่ทำอะไร (แค่เตือนใน log)

## กฎเนื้อหา

ตาม AGENTS.md: ห้ามใช้เบอร์โทรจริง · ห้ามกล่าวหาบุคคล/บริษัท · อ้างแหล่งทางการ · ไม่ลอกข่าว/รูป · IG ใส่ลิงก์ในแคปชันไม่ได้ ให้เขียน "ลิงก์ในโปรไฟล์"
