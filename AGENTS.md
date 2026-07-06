# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
SpamInThai `/check` page — a Cloudflare Pages app: static frontend (`check.html`), serverless API (`functions/api/lookup.js`, `functions/api/report.js`), and Cloudflare KV (`SPAM_KV`) for storage. There is no build step, no framework, and no automated tests/lint in the repo. Deploy notes live in `DEPLOY-GUIDE.md`.

### Running locally (dev)
- Start the dev server with `npm run dev` (defined in `package.json`). It runs `wrangler pages dev` on `http://localhost:8788` with a **local** KV namespace bound as `SPAM_KV` (Miniflare) — no Cloudflare account or the remote KV id in `wrangler.jsonc` is needed for local dev.
- API is same-origin, so the frontend's `fetch('/api/...')` calls work locally without CORS issues (the `Access-Control-Allow-Origin: https://spaminthai.com` header only matters for cross-origin browser calls).
- Test the API directly, e.g. `curl 'http://localhost:8788/api/lookup?number=0812345678'` and `curl -X POST http://localhost:8788/api/report -H 'Content-Type: application/json' -H 'CF-Connecting-IP: 1.2.3.4' -d '{"number":"0812345678","category":"scam"}'`.

### Non-obvious gotchas (important)
- **`_redirects` causes an infinite redirect loop in `wrangler pages dev`.** The rule `/check /check.html 200` conflicts with wrangler's automatic clean-URL redirect (`/check.html` → `/check`), so every page path 307-loops locally. To view the page in a browser locally, temporarily rename it (`mv _redirects _redirects.bak`), load `http://localhost:8788/check` (Cloudflare's clean-URL handling serves `check.html` automatically), then restore it (`mv _redirects.bak _redirects`) before committing. **Production Cloudflare Pages is unaffected** — the `200` rewrite is terminal there.
- **KV state is persisted to `/tmp/wrangler-state` (outside the repo) on purpose.** Wrangler watches the assets directory (repo root) for changes; if the local state dir (`.wrangler/state`) lives inside it, wrangler enters an infinite "Reloading local server…" loop. The `--persist-to /tmp/wrangler-state` flag in the `dev` script avoids this. Local report data survives dev-server restarts; delete `/tmp/wrangler-state` to reset.
- **`.assetsignore`** excludes `node_modules` etc. from static-asset serving. Without it, `wrangler pages dev` aborts with "Asset too large" on the ~121 MiB `workerd` binary in `node_modules`.

### KV data model
- `num:<phone>` → `{ reports, categories: {scam|callcenter|ads|loan|safe: count}, lastReport }`
- `rl:<ip>:<phone>` → rate-limit marker, 24h TTL (1 report per IP per number per day; a repeat returns `{ok:true, deduped:true}`).
