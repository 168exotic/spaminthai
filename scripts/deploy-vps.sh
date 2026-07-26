#!/usr/bin/env bash
set -euo pipefail

HOST="${VPS_SSH_HOST:-72.62.71.137}"
USER="${VPS_SSH_USER:-root}"
DEST="${VPS_DEPLOY_PATH:-/var/www/spaminthai/public}"
KEY_FILE="${VPS_SSH_KEY_FILE:-$HOME/.ssh/vps_deploy_key}"

if [ ! -f "$KEY_FILE" ]; then
  if [ -n "${VPS_SSH_KEY:-}" ]; then
    mkdir -p ~/.ssh
    printf '%s\n' "$VPS_SSH_KEY" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
  else
    echo "Missing VPS SSH key. Set VPS_SSH_KEY in Cursor Cloud secrets or GitHub Actions." >&2
    exit 1
  fi
fi

rsync -avz --delete \
  -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new" \
  vps/www/ "${USER}@${HOST}:${DEST}/"

echo "Deployed vps/www → ${USER}@${HOST}:${DEST}"
