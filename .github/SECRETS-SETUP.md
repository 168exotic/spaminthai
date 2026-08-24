# GitHub Actions secrets for deploy

The workflow `.github/workflows/deploy.yml` requires these repository secrets:

| Secret | Value | Required |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token **secret string** (shown once at creation). User tokens (`cfut_`) and account tokens (`cfat_`) both work. | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | `2fa3f2f325707bab89ef1c7452d3adb8` | Optional (default in workflow) |

## Weekly release PR automation (`.github/workflows/weekly-release.yml`)

| Secret | Value | Required |
|---|---|---|
| `WEEKLY_RELEASE_PR_TOKEN` | GitHub personal access token (classic or fine-grained) with pull request write access to `168exotic/spaminthai` | Required to auto-create weekly release PRs when repository disallows PR creation by `GITHUB_TOKEN` |

## Marketing automation secrets (`.github/workflows/marketing-daily.yml`)

| Secret | Value | Required |
|---|---|---|
| `MARKETING_CRON_SECRET` | Random string (e.g. `openssl rand -hex 32`) — same value in Cloudflare Pages env | Yes for live posts |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) | Recommended |
| `TELEGRAM_CHAT_ID` | Channel/group id (e.g. `-1001234567890`) | Recommended |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL | Optional |

```bash
gh secret set MARKETING_CRON_SECRET --repo 168exotic/spaminthai
gh secret set TELEGRAM_BOT_TOKEN --repo 168exotic/spaminthai
gh secret set TELEGRAM_CHAT_ID --repo 168exotic/spaminthai
```

Also add `MARKETING_CRON_SECRET` in **Cloudflare Pages → spaminthai → Settings → Environment variables** (Production).

## Google Analytics 4 (GA4)

| Variable | Value | Required |
|---|---|---|
| `GA4_MEASUREMENT_ID` | Measurement ID จาก GA4 (รูปแบบ `G-XXXXXXXXXX`) | Optional — ถ้าไม่ตั้ง GA4 จะไม่โหลด |

ดูขั้นตอนเต็มใน `docs/google-analytics-4-setup.md`

RSS feed for IFTTT/Zapier: `https://spaminthai.com/feed.xml`

## Create the API token

Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token** → **Custom token**

- **Account resources:** Include → Specific account → `2fa3f2f325707bab89ef1c7452d3adb8`
- **Permissions (Account):**
  - Cloudflare Pages → **Edit**
  - Workers KV Storage → **Edit** (for `SPAM_KV` functions)

Do **not** scope to `zone.*` only — Pages deploy needs **account-level** access.

## Add secrets to GitHub

https://github.com/168exotic/spaminthai/settings/secrets/actions

Or from your machine (with `gh` authenticated as repo admin):

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo 168exotic/spaminthai
gh secret set CLOUDFLARE_ACCOUNT_ID --repo 168exotic/spaminthai --body "2fa3f2f325707bab89ef1c7452d3adb8"
gh secret set WEEKLY_RELEASE_PR_TOKEN --repo 168exotic/spaminthai
```

## www.เบอร์ใคร.com (VPS deploy)

Workflow `.github/workflows/deploy-vps.yml` — ตั้ง secrets เหล่านี้:

```bash
gh secret set VPS_SSH_HOST --repo 168exotic/spaminthai --body "72.62.71.137"
gh secret set VPS_SSH_USER --repo 168exotic/spaminthai --body "root"
gh secret set VPS_DEPLOY_PATH --repo 168exotic/spaminthai --body "/var/www/spaminthai/public"
gh secret set VPS_SSH_KEY --repo 168exotic/spaminthai < ~/.ssh/id_rsa
```

จากนั้นรัน: `gh workflow run deploy-vps.yml --repo 168exotic/spaminthai`

## Re-run deploy

After secrets are set:

```bash
gh workflow run deploy.yml --repo 168exotic/spaminthai --ref main
```

Or re-run the failed job for commit `8e3da09` from the Actions tab.

## Manual one-off deploy (no repo secret)

Workflow dispatch with input `cloudflare_api_token` (GitHub UI → Actions → Deploy to Cloudflare Pages → Run workflow).
