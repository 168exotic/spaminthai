# Minimal token for GitHub Actions → wrangler pages deploy spaminthai
#
# Apply (needs an existing admin token or Global API Key):
#   export CLOUDFLARE_API_TOKEN="bootstrap-token"
#   cd terraform && terraform init && terraform apply
#
# Copy output token_value ONCE into GitHub secret CLOUDFLARE_API_TOKEN

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

variable "account_id" {
  type    = string
  default = "2fa3f2f325707bab89ef1c7452d3adb8"
}

provider "cloudflare" {}

data "cloudflare_api_token_permission_groups" "all" {}

locals {
  account = "com.cloudflare.api.account.${var.account_id}"
}

resource "cloudflare_account_token" "spaminthai_deploy" {
  account_id = var.account_id
  name       = "spaminthai-pages-deploy"

  policies {
    effect = "allow"

    # Account-scoped (NOT zone.*) — required for Pages + KV
    permission_groups = [
      data.cloudflare_api_token_permission_groups.all.permissions["Cloudflare Pages Edit"],
      data.cloudflare_api_token_permission_groups.all.permissions["Workers KV Storage Edit"],
      data.cloudflare_api_token_permission_groups.all.permissions["Workers KV Storage Read"],
    ]

    resources = {
      (local.account) = "*"
    }
  }
}

output "token_value" {
  description = "Set as GitHub secret CLOUDFLARE_API_TOKEN (shown only once)"
  value       = cloudflare_account_token.spaminthai_deploy.value
  sensitive   = true
}
