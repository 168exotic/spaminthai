# Releasing SpamInThai

SpamInThai follows a **weekly release cadence**: a new, improved version ships
**every Tuesday** (Asia/Bangkok, UTC+7). Each release must be *strictly better*
than the previous one — a new feature, a stronger spam-detection rule, better
UX/accessibility, or a meaningful fix. A version bump with no real improvement
does not count.

Versioning follows [SemVer](https://semver.org/). The weekly release bumps the
**minor** version (e.g. `1.1.0` → `1.2.0`). Ad-hoc hotfixes bump the patch.

## Sources of truth

The version + release date live in three places, kept in sync by the release
script:

- `package.json` → `version`
- `functions/api/version.js` → `WEB_VERSION` / `RELEASED_AT` (served at `/api/version`)
- `CHANGELOG.md` → newest `## [x.y.z] — YYYY-MM-DD` section

## Automated weekly release (recommended)

`.github/workflows/weekly-release.yml` runs every **Tuesday 00:00 Asia/Bangkok**
(`0 17 * * 1` UTC) and can also be triggered manually from the Actions tab. It:

1. Runs `scripts/prepare-weekly-release.mjs` to bump the version and prepend a
   dated `CHANGELOG.md` stub.
2. Opens a pull request titled `Weekly release vX.Y.0 (YYYY-MM-DD)`.

A maintainer (or a **Cursor scheduled/background agent** pointed at this repo)
then fills the CHANGELOG stub with the week's real improvement, implements it,
and merges the PR. Merging to `main` triggers the existing
`.github/workflows/deploy.yml` to publish to Cloudflare Pages.

> **Tip:** To make the improvement itself automatic, configure a Cursor Scheduled
> Agent (Dashboard → Cloud Agents) to run every Tuesday with a prompt like:
> *"Ship this week's SpamInThai release: run `npm run release:weekly`, implement a
> concrete improvement over the previous version, update the CHANGELOG entry, test
> it, and open the release PR."* The scheduled agent replaces the manual step
> above; the GitHub Action remains as a safety net so the cadence never slips.

## Manual release

```bash
npm run release:weekly          # bump + changelog stub for the upcoming Tuesday
# ...implement the week's improvement, edit the CHANGELOG entry...
npm test                        # scoring/unit checks must pass
npm run dev                     # smoke-test locally at http://localhost:8788
git checkout -b cursor/weekly-release-vX-Y-0
git commit -am "Weekly release vX.Y.0"
# open a PR against main
```

Options: `--dry-run` (preview, no writes) and `--date=YYYY-MM-DD` (override the
target date).
