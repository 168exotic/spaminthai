# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
SpamInThai website — Cloudflare Pages app with:
- `index.html` — homepage with embedded `/api/lookup` widget
- `check.html` — full check + report page at `/check`
- `functions/api/` — lookup and report API backed by KV (`SPAM_KV`)

No build step. Deploy notes in `DEPLOY-GUIDE.md`.

### Running locally
- `npm run dev` → `http://localhost:8788`
- Local KV is provided by Miniflare; remote KV id in `wrangler.jsonc` is for production only.

### Gotchas
- **`_redirects` + wrangler pages dev:** `/check /check.html 200` can loop locally because wrangler also clean-URLs `/check.html` → `/check`. Production Cloudflare Pages is fine. For local browser testing, temporarily rename `_redirects` or open `http://localhost:8788/check.html` directly.
- **Persist KV outside repo:** dev script uses `--persist-to /tmp/wrangler-state` to avoid wrangler reload loops.
- **`.assetsignore`:** prevents serving `node_modules` as static assets.

### Deploy www.เบอร์ใคร.com (VPS)
- Static files live in `vps/www/` (separate from Cloudflare Pages).
- Deploy script: `bash scripts/deploy-vps.sh` (needs SSH secrets).
- **Cursor Cloud secrets** (Dashboard → Cloud Agents → Environments → Secrets):
  - `VPS_SSH_HOST` = `72.62.71.137`
  - `VPS_SSH_USER` = `root`
  - `VPS_DEPLOY_PATH` = `/var/www/spaminthai/public` (adjust if different on VPS)
  - `VPS_SSH_KEY` = private key PEM (**Runtime Secret**)
- After adding secrets, start a **new** agent run, then run `bash scripts/deploy-vps.sh`.
- GitHub Actions alternative: `.github/workflows/deploy-vps.yml` (same secret names in repo settings).
