# Play Protect บล็อกการติดตั้ง APK

## อาการ

ผู้ใช้ดาวน์โหลด APK จาก [spaminthai.com/download](https://spaminthai.com/download)
แล้วเจอหน้า Google Play Protect:

> แอปถูกบล็อกเพื่อปกป้องอุปกรณ์ของคุณ  
> แอปนี้สามารถขอสิทธิ์เข้าถึงข้อมูลที่ละเอียดอ่อนได้…

มีปุ่มเดียว «รับทราบ» — ติดตั้งไม่สำเร็จ

## สาเหตุ (ตรวจจาก APK v2.0.0)

| รายการ | ค่าใน APK | ทำไม Play Protect สนใจ |
|---|---|---|
| Package | `com.jarvis.callblocker` | ชื่อไม่ตรงแบรนด์ / ดูเป็น generic call-blocker |
| Label | `spaminthai` (ตัวเล็ก) | ไม่ใช่ชื่อแสดงผลระดับผลิตภัณฑ์ |
| Signer | `CN=badboss9999, O=spaminthai` | ใบรับรอง self-signed นอก Play Store |
| `REQUEST_INSTALL_PACKAGES` | มี (in-app updater) | สิทธิ์เสี่ยงสูง — มัลแวร์ชอบใช้ติดตั้งแพ็กเกจอื่น |
| `CallScreenerService` | มี | Caller ID / บล็อกสาย = สิทธิ์ละเอียดอ่อน |
| `SmsNotificationListener` | มีตั้งแต่ v2.0.0 | `BIND_NOTIFICATION_LISTENER_SERVICE` = อ่านการแจ้งเตือน |
| ช่องทางแจก | GitHub Releases / sideload | ไม่ผ่านรีวิว Play Store |

ข้อความเตือนตรงกับชุดสิทธิ์ด้านบน ไม่ใช่เพราะไฟล์ APK เสียหรือลายเซ็นพัง
(`apksigner verify` ผ่าน, v3 signature ถูกต้อง)

## สิ่งที่แก้ได้ใน repo เว็บนี้

- หน้า `/download` และคู่มือ `/guide/block-spam-android` อธิบายวิธีปิดสแกน Play Protect
  ชั่วคราวแล้วเปิดกลับ
- มีลิงก์ fallback ไป APK **v1.0.21** (ยังบล็อกสายได้ แต่ไม่มีกรอง SMS /
  Notification Listener)

## สิ่งที่ต้องแก้ในโปรเจกต์แอป Android (นอก repo นี้)

เรียงตามผลกระทบต่ออัตราติดตั้ง:

1. **ถอด `REQUEST_INSTALL_PACKAGES`**  
   อัปเดตผ่านเบราว์เซอร์ / เปิดหน้า `/download` แทน PackageInstaller ในแอป  
   (นี่คือธงแดงอันดับต้น ๆ ของ Play Protect สำหรับ sideload)

2. **ส่ง APK ให้ Google ตรวจ (Play Protect appeal)**  
   [Play Protect appeals](https://support.google.com/googleplay/android-developer/contact/protectappeals)  
   แนบ SHA-256 ของ signing cert:

   ```
   0978ea91cdfee3da63576d965d792da09e6c0f1e0d8995ad00b2f763f7615e2e
   ```

3. **เปลี่ยน applicationId** เป็นเช่น `com.spaminthai.app`  
   และตั้ง `android:label` เป็น `SpamInThai`

4. **คง Notification Listener เป็น opt-in** (v2 ทำอยู่แล้ว) และอย่าขอ
   Accessibility / SMS read แบบเต็มกล่องข้อความ

5. **ระยะยาว: ขึ้น Google Play**  
   เป็นทางเดียวที่ลดการบล็อก sideload ได้ยั่งยืน

## ตรวจ APK เอง

```bash
curl -fsSL -o spaminthai.apk \
  "https://github.com/168exotic/spaminthai/releases/download/v2.0.0/spaminthai-v2.0.0.apk"
aapt dump permissions spaminthai.apk
aapt dump xmltree spaminthai.apk AndroidManifest.xml | rg -i 'permission|CallScreen|Notification'
apksigner verify --verbose --print-certs spaminthai.apk
```
