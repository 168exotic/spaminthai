# Play Console — Sensitive permissions declaration

When you upload the AAB, Play Console flags sensitive permissions and asks you to justify each. Copy the scripts below into the **Permissions declaration** form (App content → Sensitive app permissions), and into the in-review "App access / functionality" notes.

---

## 1. `BIND_NOTIFICATION_LISTENER_SERVICE` (Notification access)

This is the sensitive one — it triggers a manual policy review. Be precise.

**What permission:** `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` via a `NotificationListenerService` (declared in the manifest as `.sms.SmsNotificationListener`).

**Why the app needs it (paste this):**
> SpamInThai is a scam-call and spam-message blocker for Thai users. The Notification Listener is used **solely** to detect incoming SMS **notifications** that match community-reported spam and dismiss those specific spam notifications, so users are not disturbed by scam messages. This is the core advertised feature ("บล็อก SMS สแปม"). The feature is **opt-in and OFF by default**; the user must explicitly enable it and grant Notification Access in Android settings.

**What data we access / how we protect it (paste this):**
> The service reads only the notification's text to compute a one-way **SHA-256 hash**, which is compared against a community spam-hash database. The **raw message content is never stored, logged, or transmitted** — only the hash leaves the device, and only when the user has enabled the feature. We do not read the SMS inbox, do not request SMS permissions (`READ_SMS`/`RECEIVE_SMS`), and do not access contacts. All network traffic is HTTPS/TLS.

**Is there a less-sensitive alternative?** (they ask this)
> No. Android does not expose incoming SMS to a non-default app without the restricted SMS permission group. Using the Notification Listener lets us filter spam **without** requesting `READ_SMS`, which is more privacy-preserving and avoids the restricted SMS-permission policy. We deliberately chose the notification approach to minimize data access.

**Core functionality?** Yes — SMS spam filtering is a primary advertised feature. (If Google still objects, fallback position: the app remains fully functional as a call-blocker without this permission; SMS filtering is an optional add-on module.)

---

## 2. Other permissions in the manifest (for reference)

These are standard and usually don't require a written declaration, but here's the justification if asked:

| Permission | Why | Sensitive? |
|---|---|---|
| `READ_CALL_LOG` / `READ_PHONE_STATE` / Call Screening role | Identify and block scam **calls** (the original core feature) — this is the Play-approved use case for a Caller ID & Spam app. | Yes — declare under the **Call Log permissions** form; select use case "Caller ID / spam detection & blocking". |
| `POST_NOTIFICATIONS` | Show the user that a call/SMS was blocked. | No |
| `FOREGROUND_SERVICE` | Keep call-screening responsive. | No |
| `INTERNET` | Look up numbers/hashes against the community database. | No |

> **Note for the Call Log / Caller ID declaration:** Google has a specific approved use case — "Caller ID, spam detection, spam blocking". Select it. Provide a demo video/screenshots of the call-block flow if requested. This app qualifies (it's a genuine caller-ID + blocker).

---

## 3. What we explicitly do NOT request (state this to strengthen the review)
- ❌ `READ_SMS` / `RECEIVE_SMS` / `SEND_SMS` — not requested.
- ❌ `READ_CONTACTS` — not requested.
- ❌ Location (fine/coarse) — not requested.
- ❌ Camera/storage-all-files — not requested (evidence photos use the system picker).

Emphasizing the permissions you *don't* take is the fastest way to pass a Notification-Listener review.
