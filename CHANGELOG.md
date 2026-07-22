# Changelog — SpamInThai

SpamInThai ships a **new, improved version every Tuesday** (Asia/Bangkok time).
Each weekly release must be strictly better than the previous one — a new feature,
a stronger detection rule, better UX, better accessibility, or a meaningful fix.

The cadence is enforced automatically by
[`.github/workflows/weekly-release.yml`](.github/workflows/weekly-release.yml),
which opens a release PR every Tuesday. See [`RELEASING.md`](RELEASING.md) for the
full process.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this
project follows [Semantic Versioning](https://semver.org/).

## [1.3.0] — 2026-07-21

This release turns SpamInThai from a lookup-only tool into a full report-and-review
loop: users can now file detailed scam tips with photo evidence, admins can review
them, and the site is far more discoverable and mobile-friendly.

### Added
- **Scam tip report page at `/report`.** A dedicated form for detailed reports
  (phone number + description), with report entry points surfaced across the
  homepage, `/check`, the guides, the footer, and the sitemap. `/api/report` now
  accepts phone+detail payloads and stores tips in KV.
- **Photo evidence upload.** Reports accept image evidence (JPG/PNG/WebP/HEIC, up
  to 2 MB), stored in KV (R2 used when a bucket is bound).
- **Admin tip review panel at `/admin/tips`.** Password-protected
  (`TIP_ADMIN_PASSWORD`) dashboard for reviewing submitted tips and evidence.
- **Loan-app entity lookups.** `/api/lookup` and `/api/report` now handle loan-app
  entities alongside phone numbers, backed by a shared `functions/api/risk-assess.js`
  scoring module.
- **Dispute button** next to the phone-check result on the homepage and `/check`,
  so users can flag an assessment they believe is wrong.
- **Criminal-record check button** linking to the official CRD service
  (crd.go.th) from the check page, the homepage official-services sidebar, and the
  call-center guide.
- **App-download banner** — a compact top banner that slides down from the browser
  chrome (safe-area aware on mobile) inviting visitors to get the Android app.
- **SEO & discoverability:** `robots.txt`, `sitemap.xml`, favicon, OG share image,
  `WebSite` SearchAction schema, a call-center-scam guide, a changelog page, and
  server-rendered `/check/:number` pages for long-tail Thai searches.

### Changed
- **Mobile report flow reworked** — the phone-check form now sits above the report
  button, the primary report entry point moved to the header/top of the page, and
  duplicate mobile report buttons were removed.
- `robots.txt` now disallows `/admin/`.

### Fixed
- **Redirect loop (`ERR_TOO_MANY_REDIRECTS`) on `/check` and `/guide`** — removed
  `_redirects` clean-URL rewrites that conflicted with Cloudflare Pages' automatic
  `.html` stripping.
- **Homepage report count stuck at 216** — the count now loads live from a
  same-origin `/api/stats` proxy (the external health API blocks CORS), with a KV
  fallback.
- **Report form failures on mobile** — clearer Thai error messages, common photo
  formats accepted, and empty image uploads skipped gracefully.
- **Website lookup widgets** now merge legacy `num:` fields so older records
  surface correctly.
- Restored the admin tips API that was inadvertently dropped during the loan-app
  report rewrite.

## [1.2.0] — 2026-07-21

### Added
- **Recency-aware risk scoring.** `/api/lookup` now boosts scores for numbers
  reported in the last 7 days (+12) or 30 days (+6), and gently decays very old
  reports (120+ days, −6) so stale data does not over-penalise recycled numbers.
  The response includes `freshness` / `freshnessLabel` for clients.
- **Freshness badge** on the homepage widget and `/check` page when a number has
  recent community reports (within 30 days).
- Unit tests for recency modifiers (`recencyModifier` + assess with fixed clock).

### Changed
- Homepage footer version label now loads from `/api/version` instead of being
  hard-coded.
- `_worker.js` imports `assess` from `functions/api/lookup.js` so Worker and
  Pages Functions share one scoring implementation.

### Fixed
-
## [1.1.0] — 2026-07-14

First release of the weekly cadence.

### Changed
- **Android app metadata** bumped to **v1.0.15** on `/api/app` and download pages (Cyber Shield UI, crowdsource spam upload).

### Added
- **Server-side risk scoring.** `/api/lookup` now returns a computed risk
  assessment (`score` 0–100, `verdict`, Thai `label` + `advice`, and
  `topCategory`) alongside the raw report data. Categories are weighted — scam
  and call-center reports weigh the most, while "safe" votes lower the score —
  so the verdict reflects *what kind* of reports a number received, not just how
  many.
- **`/api/version` endpoint** exposing the current web release version, release
  date, and changelog link.
- **Risk-score display** in the check page results (`คะแนนความเสี่ยง _/100_`) and
  in the homepage widget (`ความเสี่ยง _/100_`).
- Version label (`v1.1.0`) in the homepage footer.
- Unit tests for the scoring logic (`npm test`).
- Weekly-release automation: `scripts/prepare-weekly-release.js` +
  `.github/workflows/weekly-release.yml`.

### Changed
- The homepage widget and the `/check` page now render the verdict/score from
  the API (single source of truth) instead of each computing their own thresholds
  client-side. Both keep a local fallback for older API responses.
