#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install Docker Engine and the Compose plugin first." >&2; exit 2; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required (docker compose)." >&2; exit 2; }

for file in deploy/store.env deploy/creator.env; do
  if [[ ! -f "$file" ]]; then
    echo "Missing $file. Copy the matching .env.example file and fill it with real staging values." >&2
    exit 3
  fi
done

if grep -Eiq 'YOUR_PROJECT|YOUR_SUPABASE|YOUR_ADMIN_AUTH|replace_me|REPLACE_WITH|example\.com' deploy/store.env deploy/creator.env; then
  echo "Placeholder values remain in deploy/*.env. Replace them before deployment." >&2
  exit 4
fi

read_env_value() {
  local key="$1" file="$2"
  sed -n "s/^${key}=//p" "$file" | tail -n 1 | tr -d '\"' | tr -d "'"
}
STORE_DOMAIN="$(read_env_value STORE_DOMAIN deploy/store.env)"
CREATOR_DOMAIN="$(read_env_value CREATOR_DOMAIN deploy/store.env)"
if [[ -z "$STORE_DOMAIN" || -z "$CREATOR_DOMAIN" || "$STORE_DOMAIN" == "$CREATOR_DOMAIN" ]]; then
  echo "Set two different STORE_DOMAIN and CREATOR_DOMAIN values in deploy/store.env." >&2
  exit 4
fi
if [[ ! "$STORE_DOMAIN" =~ ^[A-Za-z0-9.-]+$ || ! "$CREATOR_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Store and Creator domains must be valid hostname characters only (no scheme, path or port)." >&2
  exit 4
fi

# Keep payment processing disabled until staging approval and test transactions are complete.
if grep -Eq '^GAMEON_PAYMENTS_ENABLED=true|^GAMEON_LIVE_PAYMENTS_APPROVED=true' deploy/store.env deploy/creator.env; then
  echo "Payments must remain disabled for this first self-hosted deployment. Use the controlled staging runbook before enabling test or live processing." >&2
  exit 5
fi

echo "Validating the two-app Compose configuration..."
docker compose --env-file deploy/store.env --env-file deploy/creator.env config --quiet
echo "Building separate Store and Creator images..."
docker compose --env-file deploy/store.env --env-file deploy/creator.env build --pull
echo "Starting both applications..."
docker compose --env-file deploy/store.env --env-file deploy/creator.env up -d
echo "Container status:"
docker compose --env-file deploy/store.env --env-file deploy/creator.env ps
cat <<'MESSAGE'

Deployment command completed. Confirm both containers become healthy.
Then verify /api/health and /api/ready for each app through the Caddy HTTPS hostnames.
Do not expose ports 3000/3001 directly to the public internet; Caddy is the public entry point on ports 80/443.
The separate private ClamAV scanner is still deployed from services/build-scanner after Creator is reachable internally.
MESSAGE
