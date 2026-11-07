#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '\n== Game ON release verification ==\n'
printf 'Node: '; node --version
printf 'npm:  '; npm --version

if [[ -f package-lock.json ]]; then
  echo "Existing root lockfile found; installing with npm ci."
  npm ci --no-audit --no-fund
else
  echo "No lockfile exists; resolving the two npm workspaces and generating a genuine root package-lock.json."
  npm install --no-audit --no-fund
fi

if [[ ! -s package-lock.json ]]; then
  echo "ERROR: npm did not generate a non-empty root package-lock.json." >&2
  exit 20
fi

echo "== Running automated tests =="
npm test

echo "== Running semantic TypeScript checks =="
npm run typecheck

echo "== Building both independent applications =="
npm run build

echo "== Running strict release preflight =="
npm run release:preflight

echo "== SUCCESS: app release checks passed =="
echo "Next: run Supabase CLI migrations/pgTAP, staging integration, scanner, payment and device QA as listed in RELEASE_READINESS.md."
