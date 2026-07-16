# Cloudflare Access Setup — ล็อก /admin*

> ชั้นนอกของ admin security — ตั้งใน Cloudflare Zero Trust Dashboard

---

## ขั้นตอน

### 1. เปิด Zero Trust (ฟรี 50 users)

1. ไปที่ [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Access → Applications → Add an application
3. เลือก **Self-hosted**

### 2. ตั้ง Application

| Field | Value |
|---|---|
| Application name | `SpamInThai Admin` |
| Session Duration | 24 hours |
| Application domain | `spaminthai.com` |
| Path | `/admin*` |

### 3. ตั้ง Policy

| Field | Value |
|---|---|
| Policy name | `Admin only` |
| Action | Allow |
| Include | Emails: `admin@spaminthai.com` |
| Authentication | One-time PIN หรือ Google Workspace |

### 4. ตั้ง Environment Variable

ใน Cloudflare Pages → Settings → Environment variables:

| Variable | Value |
|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | team subdomain ของคุณ (เช่น `myteam` จาก `myteam.cloudflareaccess.com`) |

### 5. Fallback Token (สำหรับ dev/emergency)

| Variable | Value |
|---|---|
| `ADMIN_TOKEN` | สร้าง random string ยาว 64 ตัวอักษร (secret) |

ใช้ใน `admin.html` หรือ curl:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://spaminthai.com/api/admin/queue
```

---

## ทดสอบ

1. เปิด `https://spaminthai.com/admin.html` — ต้องเห็นหน้า Cloudflare Access login
2. หลัง login สำเร็จ → เข้า admin panel ได้
3. ไม่มี auth → `/api/admin/*` คืน **404** (ไม่ใช่ 401)
