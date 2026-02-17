#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

legacy_pattern='@services/(EnhancementService|VideoConceptService)'
credits_singleton_pattern="import\\s*\\{[^}]*\\buserCreditService\\b[^}]*\\}\\s*from ['\\\"]@services/credits/UserCreditService['\\\"]"
storage_singleton_pattern="import\\s*\\{[^}]*\\bgetStorageService\\b[^}]*\\}\\s*from ['\\\"]@services/storage/StorageService['\\\"]"

legacy_hits="$(rg -n "$legacy_pattern" server/src client/src tests || true)"
credits_hits="$(rg -n -P "$credits_singleton_pattern" server/src/routes server/src/middleware || true)"
storage_hits="$(rg -n -P "$storage_singleton_pattern" server/src/routes server/src/middleware || true)"

legacy_count=0
credits_count=0
storage_count=0

if [[ -n "$legacy_hits" ]]; then
  legacy_count="$(printf '%s\n' "$legacy_hits" | wc -l | tr -d ' ')"
fi
if [[ -n "$credits_hits" ]]; then
  credits_count="$(printf '%s\n' "$credits_hits" | wc -l | tr -d ' ')"
fi
if [[ -n "$storage_hits" ]]; then
  storage_count="$(printf '%s\n' "$storage_hits" | wc -l | tr -d ' ')"
fi

total=$((legacy_count + credits_count + storage_count))

echo "Architecture forbidden import checks"
echo "- legacy root service imports: $legacy_count"
echo "- routes/middleware credits singleton imports: $credits_count"
echo "- routes/middleware storage singleton imports: $storage_count"

if (( legacy_count > 0 )); then
  echo ""
  echo "Legacy root service imports (must be zero):"
  printf '%s\n' "$legacy_hits"
fi

if (( credits_count > 0 )); then
  echo ""
  echo "Route/middleware credits singleton imports (must be zero):"
  printf '%s\n' "$credits_hits"
fi

if (( storage_count > 0 )); then
  echo ""
  echo "Route/middleware storage singleton imports (must be zero):"
  printf '%s\n' "$storage_hits"
fi

if (( total > 0 )); then
  exit 1
fi

echo "All forbidden import checks passed."
