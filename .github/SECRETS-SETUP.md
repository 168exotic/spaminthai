# GitHub Actions secrets for deploy

The workflow `.github/workflows/deploy.yml` requires these repository secrets:

| Secret | Value | Required |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token **secret string** (shown once at creation) | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | `2fa3f2f325707bab89ef1c7452d3adb8` | Optional (default in workflow) |

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
```

## Re-run deploy

After secrets are set:

```bash
gh workflow run deploy.yml --repo 168exotic/spaminthai --ref main
```

Or re-run the failed job for commit `8e3da09` from the Actions tab.

## Manual one-off deploy (no repo secret)

Workflow dispatch with input `cloudflare_api_token` (GitHub UI → Actions → Deploy to Cloudflare Pages → Run workflow).
