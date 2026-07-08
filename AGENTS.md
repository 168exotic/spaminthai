# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
SpamInThai website — Cloudflare Worker with static assets:
- `index.html` — apex landing at `spaminthai.com/` (replaces Canva)
- `check.html` — full check + report page at `/check`
- `functions/api/` — lookup and report API backed by KV (`SPAM_KV`)
- `wrangler.toml` — routes for apex, www, and api subdomains

No build step. Deploy notes in `DEPLOY-GUIDE.md`.

### Running locally
- `npm run dev` → `http://localhost:8788`
- Local KV via Miniflare; production KV id in `wrangler.toml`.

### Gotchas
- **`_redirects` + wrangler pages dev:** `/check /check.html 200` can loop locally because wrangler also clean-URLs `/check.html` → `/check`. Production Cloudflare Pages is fine. For local browser testing, temporarily rename `_redirects` or open `http://localhost:8788/check.html` directly.
- **Persist KV outside repo:** dev script uses `--persist-to /tmp/wrangler-state` to avoid wrangler reload loops.
- **`.assetsignore`:** prevents serving `node_modules` as static assets.
