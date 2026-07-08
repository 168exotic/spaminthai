# Cloudflare API Token Policy — SpamInThai

This document explains what is wrong with the `broken-lab-8596` token and the minimal policy needed to seed `SPAM_KV`.

## What is broken

The `broken-lab-8596` token has two problems that block KV seeding.

### 1. Wrong resource scope

Current policy:

```json
"resources": {
  "com.cloudflare.api.account.2fa3f2f325707bab89ef1c7452d3adb8": {
    "com.cloudflare.api.account.zone.*": "*"
  }
}
```

Permissions are scoped to **zones inside the account**. Workers KV is an **account-level** product. The KV REST API is called at:

```
PUT /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key}
```

Zone-scoped tokens cannot write to KV through this API, even if they include Workers-related permission groups.

### 2. Missing KV permission groups

The token includes 44 zone permission groups (DNS, SSL, Firewall, Workers Routes, etc.) but **none** of these:

| Required permission | Purpose |
|---|---|
| Workers KV Storage Read | List namespaces, verify keys after seeding |
| Workers KV Storage Edit | Write keys via API (`PUT` / `bulk`) |

`Workers Routes Write` is present, but it is zone-scoped and does not grant account-level KV API access.

## Correct minimal policy

Create a new token (or edit the policy) with **account-level** scope and only the permissions you need.

### Dashboard steps

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token**
2. Use **Custom token**
3. **Account resources**: Include → Specific account → `2fa3f2f325707bab89ef1c7452d3adb8`
4. **Permissions** (Account):
   - `Workers KV Storage` → **Edit** (required for seeding)
   - `Workers KV Storage` → **Read** (optional but recommended for verify script)
5. Do **not** scope this token to zones unless you also need zone DNS/SSL changes

### Correct policy shape (API representation)

```json
{
  "effect": "allow",
  "resources": {
    "com.cloudflare.api.account.2fa3f2f325707bab89ef1c7452d3adb8": "*"
  },
  "permission_groups": [
    { "id": "<Workers KV Storage Read id>", "name": "Workers KV Storage Read" },
    { "id": "<Workers KV Storage Edit id>", "name": "Workers KV Storage Edit" }
  ]
}
```

Note the account resource value is `"*"` (the whole account), not a nested `zone.*` object.

## Values used by this repo

| Variable | Value |
|---|---|
| Account ID | `2fa3f2f325707bab89ef1c7452d3adb8` |
| KV Namespace ID | `d1417790ca5841bebf80cbc25443e070` (from `wrangler.toml`) |
| KV binding name | `SPAM_KV` |

## Verify and seed

```bash
export CLOUDFLARE_API_TOKEN="your-new-token-secret"
export CLOUDFLARE_ACCOUNT_ID="2fa3f2f325707bab89ef1c7452d3adb8"
export KV_NAMESPACE_ID="d1417790ca5841bebf80cbc25443e070"

node scripts/verify-token.js
node scripts/seed-spam-numbers.js data/spam-numbers-sample.json
```

`verify-token.js` performs a harmless read against the namespace. If the token is still zone-scoped or missing KV permissions, it returns a clear error before you run a bulk seed.

## Separate tokens for separate jobs

| Task | Scope | Permissions |
|---|---|---|
| Seed KV database | Account | Workers KV Storage Edit (+ Read) |
| Manage DNS for spaminthai.com | Zone | DNS Edit |
| Purge cache after deploy | Zone | Cache Purge |
| Edit Pages project bindings | Account | Cloudflare Pages Edit |

Keep seeding tokens separate from zone-admin tokens. The `broken-lab-8596` token mixes dozens of zone write permissions but still cannot seed KV.
