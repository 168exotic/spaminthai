# Cloudflare WAF Setup — spaminthai.com

> คัดลอก expression ด้านล่างไปวางใน Cloudflare Dashboard → Security → WAF

---

## 1. Rate Limiting Rule (ฟรี 1 rule)

**แนะนำ:** จำกัด POST `/api/report` — เป็นจุดเสี่ยงที่สุด (fake report + KV write abuse)

| Field | Value |
|---|---|
| Rule name | `Limit report POST` |
| Expression | `(http.request.uri.path eq "/api/report" and http.request.method eq "POST")` |
| Action | Block |
| Characteristics | IP |
| Requests | 10 per 1 minute |
| Duration | 60 seconds |

**เหตุผล:** Report endpoint เป็นจุดที่ attacker ยิง fake data ถล่ม — rate limit ที่ edge ช่วยลด load ก่อนถึง Worker และประหยัด KV writes มากที่สุด

---

## 2. WAF Custom Rules

### Rule A: Block high threat score on API POST

```
(http.request.uri.path contains "/api/" and http.request.method eq "POST" and cf.threat_score gt 20)
```

| Action | Block |

### Rule B: Managed Challenge on report without referer

```
(http.request.uri.path eq "/api/report" and not http.request.referer contains "spaminthai.com")
```

| Action | Managed Challenge |

### Rule C: Block suspicious lookup scrapers

```
(http.request.uri.path eq "/api/lookup" and cf.bot_management.score lt 30 and not http.request.referer contains "spaminthai.com")
```

| Action | Block |

### Rule D: Block empty User-Agent on API

```
(http.request.uri.path contains "/api/" and len(http.user_agent) eq 0)
```

| Action | Block |

---

## 3. Bot Fight Mode

| ตัวเลือก | คำแนะนำ |
|---|---|
| Bot Fight Mode | **เปิด** — ช่วยกัน scraper ยิง `/api/lookup` |
| Super Bot Fight Mode | **ปิด** (ต้องจ่าย) |

**ผลกระทบต่อ AdSense crawler:**
- Google AdSense crawler (`Mediapartners-Google`, `AdsBot-Google`) มักผ่าน Bot Fight Mode ได้เพราะเป็น verified bot ของ Cloudflare
- ถ้า AdSense หยุดแสดงโฆษณา ให้เพิ่ม WAF skip rule:

```
(http.user_agent contains "Mediapartners-Google" or http.user_agent contains "AdsBot-Google")
```

| Action | Skip (All remaining custom rules) |

---

## 4. ลำดับการตั้ง

1. สร้าง Custom Rules ก่อน (A → D)
2. ตั้ง Rate Limiting Rule
3. เปิด Bot Fight Mode
4. ทดสอบด้วย `npm run security-check` หรือ curl จาก `docs/SECURITY.md`
