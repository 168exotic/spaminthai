# Play Console — Data Safety form (pre-filled answers)

Copy these answers into **Play Console → App content → Data safety**. This reflects the v2.0.0 app + spaminthai.com backend. Keep it in sync with `/privacy`.

> Golden rule for reviewers: we minimize data, never sell/share, and the SMS feature is **opt-in (OFF by default)**.

## Section 1 — Data collection & security (overview)

| Question | Answer | Rationale |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | We collect anonymous usage stats + user-submitted reports. |
| Is all user data encrypted in transit? | **Yes** | All traffic over HTTPS/TLS. |
| Do you provide a way for users to request that their data be deleted? | **Yes** | Via LINE OA @spaminthai / admin@spaminthai.com / the on-site dispute form. |
| Committed to Play Families policy? | **No** (not a children's app) | Not directed at under-13. |

## Section 2 — Data types (answer every category)

Legend: **Collected?** / **Shared?** (shared = sent to a third party) / **Processed ephemerally?** / **Required or optional?** / **Purpose**

| Category / type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| **Location** – approximate | No | No | — | Never collected. |
| **Location** – precise | No | No | — | Never collected. |
| **Personal info** – name | No | No | — | No accounts. |
| **Personal info** – email address | No | No | — | Only if a user emails us voluntarily (not collected in-app). |
| **Personal info** – user IDs | No | No | — | The heartbeat UUID is random & anonymous, not tied to identity → declare **No**. |
| **Personal info** – address | No | No | — | — |
| **Personal info** – phone number | **Yes** (optional) | No | App functionality (community anti-fraud database) | Reported numbers are third-party numbers users flag, plus any number an owner submits in a dispute. |
| **Personal info** – race, political, religion, sexual orientation | No | No | — | — |
| **Personal info** – other info (ID docs) | **Yes** (optional) | No | Account management / fraud prevention | ID evidence **only** when a number owner voluntarily submits a dispute. Stored in R2, restricted access. |
| **Financial info** (any) | No | No | — | We never touch payments/financial data. |
| **Health & fitness** | No | No | — | — |
| **Messages** – SMS or MMS | **No*** | No | App functionality | We process a **SHA-256 hash** only; raw SMS content is never read/sent/stored. Declare **No** for "SMS or MMS" content collection; if the console forces a Yes, note "hash only, no content, ephemeral". |
| **Messages** – emails | No | No | — | — |
| **Messages** – other in-app messages | No | No | — | — |
| **Photos** | **Yes** (optional) | No | App functionality | Only if a user attaches evidence to a report/dispute. |
| **Videos** | No | No | — | — |
| **Audio** – voice, sound, music files | No | No | — | — |
| **Files & docs** | No | No | — | — |
| **Calendar** | No | No | — | — |
| **Contacts** | No | No | — | We do **not** request contacts permission. |
| **App activity** – app interactions | **Yes** | No | Analytics | Anonymous heartbeat: app version, feature on/off flag. |
| **App activity** – in-app search history | No | No | — | — |
| **App activity** – installed apps | No | No | — | — |
| **App activity** – other user-generated content | **Yes** (optional) | No | App functionality | Report category/notes. |
| **App activity** – other actions | No | No | — | — |
| **Web browsing history** | No | No | — | — |
| **App info & performance** – crash logs | No | No | — | Not currently collected. |
| **App info & performance** – diagnostics | **Yes** | No | Analytics | Android version, carrier via anonymous heartbeat. |
| **App info & performance** – other | No | No | — | — |
| **Device or other IDs** | **No** | No | — | Random app-generated UUID is **not** a device ID (not IMEI/ad ID) → No. |

\* If the review bot flags the NotificationListener permission and insists SMS is "collected," use this exact wording in the justification box:
> "The app reads incoming **notifications** (not the SMS inbox) to detect spam. Only a one-way SHA-256 hash of the text is compared against a community database. The raw message content is never transmitted or stored. The feature is opt-in and off by default."

## Section 3 — Data usage & handling per type (for the ones marked Yes)

- **Phone number (reports/disputes):** Collected, not shared, optional, purpose = App functionality + Fraud prevention. Deletion: yes (dispute form / contact).
- **Other info – ID docs (disputes):** Collected, not shared, optional, purpose = Fraud prevention. Encrypted in transit. Deletion on case closure.
- **Photos (evidence):** Collected, not shared, optional, purpose = App functionality. Deletion: yes.
- **App activity + diagnostics (heartbeat):** Collected, not shared, purpose = Analytics/App functionality. **Not** linked to identity. Anonymous.

## Data deletion URL (Play requires one)
Provide: `https://spaminthai.com/privacy` (contains contact + dispute-form link).
Deletion request channels: `admin@spaminthai.com`, LINE @spaminthai, `https://spaminthai.com/dispute`.
