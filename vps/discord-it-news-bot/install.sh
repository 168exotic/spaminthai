#!/usr/bin/env bash
# Install Discord IT news bot on VPS (run as root).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/spaminthai-discord-it-news}"
SERVICE_NAME="spaminthai-discord-it-news"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Installing to ${APP_DIR}"
mkdir -p "${APP_DIR}"
rsync -a --delete \
  --exclude node_modules \
  --exclude data \
  --exclude .env \
  "${SCRIPT_DIR}/" "${APP_DIR}/"

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 20 (nodesource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> npm install"
cd "${APP_DIR}"
npm install --omit=dev

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "==> Creating ${APP_DIR}/.env from .env.example — edit DISCORD_BOT_TOKEN before start"
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
fi

mkdir -p "${APP_DIR}/data"

echo "==> Installing systemd unit"
sed "s|/opt/spaminthai-discord-it-news|${APP_DIR}|g" \
  "${APP_DIR}/spaminthai-discord-it-news.service" \
  > "/etc/systemd/system/${SERVICE_NAME}.service"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"

if grep -q '^DISCORD_BOT_TOKEN=.\+' "${APP_DIR}/.env" 2>/dev/null; then
  systemctl restart "${SERVICE_NAME}"
  echo "==> Started ${SERVICE_NAME}"
else
  echo "==> Add DISCORD_BOT_TOKEN to ${APP_DIR}/.env then: systemctl restart ${SERVICE_NAME}"
fi

systemctl status "${SERVICE_NAME}" --no-pager || true
