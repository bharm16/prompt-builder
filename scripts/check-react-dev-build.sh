#!/usr/bin/env bash
set -euo pipefail

# Check that the latest production build does not contain React development bundles.
# Usage: npm run build && bash scripts/check-react-dev-build.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/assets"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Error: dist/assets/ not found. Run npm run build first."
  exit 1
fi

# Find the newest index-*.js file (the fresh build output)
newest_index="$(ls -t "$DIST_DIR"/index-*.js 2>/dev/null | head -1)"

if [[ -z "$newest_index" ]]; then
  echo "Error: no index-*.js found in dist/assets/"
  exit 1
fi

echo "Checking $(basename "$newest_index") for React development bundles..."

hits="$(grep -c "react\.development\|react-dom\.development\|react-dom-client\.development" "$newest_index" 2>/dev/null || true)"

if (( hits > 0 )); then
  echo "FAIL: Found $hits React development bundle references in production output."
  echo "The production build is shipping React development code."
  echo "Check config/build/vite.config.ts — ensure process.env.NODE_ENV is defined as 'production' during builds."
  exit 1
fi

echo "OK: No React development bundles found in production output."
