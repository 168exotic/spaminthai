# Google Play Protect — แอปติดตั้งไม่ได้ (v2.0.0)

## อาการ

เมื่อติดตั้ง APK จากเว็บ (sideload) ระบบแสดง:

> **แอปถูกบล็อกเพื่อปกป้องอุปกรณ์ของคุณ**
> แอปนี้สามารถขอสิทธิ์เข้าถึงข้อมูลที่ละเอียดอ่อนได้ ซึ่งเพิ่มความเสี่ยงที่จะเกิดการโจรกรรมข้อมูลส่วนบุคคลหรือการประพฤติมิชอบทางการเงิน

มีปุ่ม **รับทราบ** เท่านั้น — ไม่มีตัวเลือกติดตั้งต่อ

อ้างอิง: [Google Play Protect developer guidance](https://developers.google.com/android/play-protect/warning-dev-guidance)

## สาเหตุ (วิเคราะห์ APK v2.0.0)

| ปัจจัย | รายละเอียด |
|--------|------------|
| แหล่งติดตั้ง | APK จากเบราว์เซอร์ / ลิงก์นอก Play Store (internet sideload) |
| สิทธิ์เสี่ยง | `SmsNotificationListener` = **Notification Listener** ใน manifest |
| นโยบาย Google | Sideload + `NOTIFICATION_LISTENER` (หรือ SMS / Accessibility) → **บล็อกอัตโนมัติ** |
| ฟีเจอร์ที่ทำให้เกิด | v2.0.0 SMS สแปม (เบต้า) — อ่านการแจ้งเตือน SMS |

v1.0.21 **ไม่มี** `NotificationListenerService` จึงติดตั้งได้ปกติ (อาจมีคำเตือนอื่น แต่ไม่ hard block)

## การแก้ (เว็บ + Releases)

- **v2.0.2** — อัปโหลด binary เดียวกับ v1.0.21 (ลายเซ็น release จริง) — **ใช้ติดตั้ง**
- **v2.0.1** — repack + ลายเซ็น **Android Debug** + โค้ด SMS listener ยังอยู่ใน dex → ยังถูกบล็อก
- ลิงก์ดาวน์โหลดชี้ v2.0.3; `/api/latest-version` คืน **versionName ใน APK (2.0.2)** ไม่ใช้ GitHub tag — กันแอปเตือนอัปเดตวนลูป

## การแก้ถาวร (แอป Android — ต้องทำในโค้ดแอป)

โค้ดแอป Android **ไม่ได้อยู่ใน repo นี้** — build แล้วปล่อยเป็น APK บน GitHub Releases

1. **ลบหรือแยก SMS beta ออกจาก base APK**
   - เอา `com.jarvis.callblocker.sms.SmsNotificationListener` ออกจาก `AndroidManifest.xml` ของ build ที่แจก sideload
   - หรือใช้ product flavor: `sideload` (ไม่มี listener) vs `play` (มี listener + ผ่าน Play Console)

2. **ทางเลือกสำหรับ SMS (ไม่ใช้ Notification Listener)**
   - เช็ค SMS ด้วยตนเองในแอป (ผู้ใช้ copy/paste หรือ share intent)
   - ใช้ SMS User Consent API ถ้าต้องอ่านข้อความ (ไม่ใช่ listener ตลอดเวลา)
   - โฟกัสฟีเจอร์ SMS บนเว็บ `/check` จนกว่าจะลง Play Store

3. **ลดสิทธิ์ที่ทำให้สงสัย**
   - `REQUEST_INSTALL_PACKAGES` — ใช้ลิงก์ `https://spaminthai.com/download` แทนอัปเดตในแอป
   - `READ_CONTACTS` — ใช้ Contact Picker ถ้าไม่จำเป็นต้องอ่านรายชื่อทั้งหมด

4. **ยื่น Play Protect appeal** หลัง build ใหม่ผ่านการตรวจ
   - [File a Play Protect appeal](https://developers.google.com/android/play-protect/warning-dev-guidance) (ลิงก์ในหน้า guidance)

5. **พิจารณา Google Play Store** — แอป call screening / notification มักต้องผ่าน declaration

## ตรวจสอบ APK ด้วยคำสั่ง

```bash
curl -fsSL -o /tmp/spaminthai.apk "https://github.com/168exotic/spaminthai/releases/download/v2.0.0/spaminthai-v2.0.0.apk"
pip install androguard
python3 -c "
from androguard.core.apk import APK
apk = APK('/tmp/spaminthai.apk')
print('services:', [s for s in apk.get_services() if 'callblocker' in s])
"
```

v2.0.0 จะเห็น `SmsNotificationListener`; v2.0.1 และ v1.0.21 เห็นเฉพาะ `CallScreenerService`.

## v2.0.1 (manifest patch)

Release v2.0.1 repacks v2.0.0 โดยลบ `SmsNotificationListener` และ `REQUEST_INSTALL_PACKAGES` จาก manifest.
SMS เบต้าใน UI ยังอยู่แต่จะไม่ทำงานจนกลับมาใน build จาก source จริงหรือ Play Store.
