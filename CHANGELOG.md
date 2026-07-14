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

## [1.1.0] — 2026-07-14

First release of the weekly cadence.

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
