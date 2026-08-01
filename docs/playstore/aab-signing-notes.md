# AAB & Play App Signing — notes for BOSS

## TL;DR recommendation
**Let Google generate & manage the app signing key** (Play App Signing, the default). You upload an **AAB signed with your upload key**, Google re-signs it with the app signing key it holds. This means:
- ✅ You never risk losing the "real" signing key (Google keeps it safe).
- ✅ Less key management burden.
- ⚠️ Trade-off: Google holds the app signing key. That's fine and standard for a new app.

Because this is a **brand-new app on Play** (never published before), there is **no legacy key to preserve** — so opting into Play App Signing with a Google-generated key is the clean, low-maintenance choice. Take it.

## How Play App Signing works
1. You have an **upload key** (your keystore). You sign the AAB with it.
2. You upload the AAB to Play Console.
3. Google verifies your upload key, strips it, and re-signs the app with the **app signing key** (which Google generated and stores in its secure infra).
4. Users get an APK signed by the app signing key.

The upload key and app signing key are different. If you ever lose the upload key, Google can reset it — you don't lose the app. That's the safety benefit.

## Our current signing setup (upload key)
- **Keystore location (in the mysite repo):** `spaminthai_android/keystore/spaminthai.keystore`
- **Key alias:** `spaminthai`
- **Passwords:** stored in the build config / build script inside the mysite repo — **do not paste them into this doc or Play Console tickets.** Retrieve them from `spaminthai_android/app/build.gradle.kts` (`signingConfigs`) or `build-v2.0.0.sh` when needed.
- The AAB produced by `./gradlew :app:bundleRelease` is **already signed** with this keystore (the gradle `release` signingConfig wires it in), so it's ready to use as the **upload** artifact.

> ⚠️ **Back up the keystore file + passwords somewhere safe (offline / password manager).** Even with Play App Signing, losing the upload key is a hassle (requires a Google reset). Losing it *before* enabling Play App Signing would be fatal. Copy `spaminthai.keystore` to secure storage now.

## First-upload choice in Play Console
When you upload the first AAB, Play Console shows an "App integrity / App signing" step:
- Choose **"Use Google-generated key"** (recommended) → done.
- (Alternative: "Use my own app signing key" → only if you specifically want to hold the app key. Not recommended here — more risk, no benefit for a new app.)

## Why AAB (not APK) for Play
- Play **requires AAB** for new apps (APK uploads are not accepted for new apps).
- The AAB lets Google generate optimized per-device APKs (smaller downloads).
- Our workflow now produces **both**: the AAB for Play, and the signed APK for the sideload/website channel.

## Where the AAB comes from
- Build script `spaminthai_android/build-v2.0.0.sh` now also runs `:app:bundleRelease` and copies the result to `spaminthai_android/releases/spaminthai-v2.0.0.aab`.
- The `release-android-apk.yml` workflow attaches that `.aab` to the GitHub Release alongside the `.apk`.
- Download the `.aab` from the GitHub Release page, then upload it to Play Console → Internal testing → Create release.
