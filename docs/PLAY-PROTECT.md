# Google Play Protect blocking SpamInThai APK

## Symptom

On install of the sideloaded APK, Play Protect shows a hard block (Thai):

> แอปถูกบล็อกเพื่อปกป้องอุปกรณ์ของคุณ  
> แอปนี้สามารถขอสิทธิ์เข้าถึงข้อมูลที่ละเอียดอ่อนได้ ซึ่งเพิ่มความเสี่ยงที่จะเกิดการโจรกรรมข้อมูลส่วนบุคคลหรือการประพฤติมิชอบทางการเงิน

Often only **รับทราบ** is offered (no “Install anyway”).

## What we inspected (v2.0.0)

| Field | Value |
|---|---|
| Release | `https://github.com/168exotic/spaminthai/releases/download/v2.0.0/spaminthai-v2.0.0.apk` |
| Package | `com.jarvis.callblocker` |
| Label | `spaminthai` |
| versionName / versionCode | `2.0.0` / `13` |
| minSdk / targetSdk | 29 / 34 |
| SHA-256 | `48d5fcf3b8a331591fede811157c8461c50b5c86b905d2b927652ad14387c60c` |
| Signing CN | `badboss9999` (org `spaminthai`, TH) |

Sensitive surface that matches Play Protect’s “sensitive data / financial misconduct” copy:

1. **`REQUEST_INSTALL_PACKAGES`** — used by in-app `UpdateChecker.downloadApk` (FileProvider). Strong malware heuristic when sideloaded.
2. **`CallScreenerService`** (`BIND_SCREENING_SERVICE`) — call blocking.
3. **`SmsNotificationListener`** (`BIND_NOTIFICATION_LISTENER_SERVICE`) — SMS filter (v2.0.0+).
4. **`READ_CONTACTS`** — whitelist contacts.
5. Distributed **outside Play Store** → higher automated scrutiny.

`v1.0.21` already had `REQUEST_INSTALL_PACKAGES` + call screening; v2.0.0 adds the notification listener (SMS beta).

> Android app **source is not in this website repo**. Fixes below require the Android project + release keystore.

## User workaround (documented on site)

`/download#play-protect` and `/guide/block-spam-android#play-protect` tell users to:

1. Play Store → profile → Play Protect → settings  
2. Temporarily disable **Scan apps with Play Protect**  
3. Allow install from the browser/files app  
4. Install the APK from spaminthai.com  
5. Re-enable Play Protect  

Web check at `/check` remains available without install.

## Required Android remediation (next APK)

Priority order:

1. **Remove `REQUEST_INSTALL_PACKAGES`** for store/sideload builds.  
   - Update flow: open the browser to `/download` or GitHub Releases instead of downloading+installing an APK inside the app.  
   - Keep in-app update only if you ship via Play (Play Core / in-app updates API).

2. **Ship a clean rebuild** (new `versionCode`) after removing that permission; hard blocks often stick to a previously hashed APK.

3. **Appeal** the classification:  
   [Play Protect appeals](https://support.google.com/googleplay/android-developer/contact/protectappeals)  
   Include package name, SHA-256, and a short description (Thai call/SMS spam blocker; notification listener hashes only; no SMS body storage).

4. **Optional hardening**
   - Rename applicationId to `com.spaminthai.app` (breaking update path — plan migration).
   - Use a release keystore whose CN matches the brand (not a personal nickname).
   - Publish on Google Play (or at least an internal/closed track) so Protect reputation can accumulate.
   - Keep SMS filter opt-in and documented in Play / privacy policy.

## Website repo scope

This repo hosts Pages + APK download links only (`functions/api/app.js`, `download.html`, `assets/site.js`). It cannot resign or strip permissions from the published APK.
