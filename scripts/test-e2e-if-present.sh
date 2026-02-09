#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DIR="${ROOT_DIR}/tests/e2e"

if [ ! -d "${E2E_DIR}" ]; then
  echo "[test:e2e] No tests/e2e directory found. Skipping e2e suite."
  exit 0
fi

has_specs=0
while IFS= read -r _file; do
  has_specs=1
  break
done < <(
  cd "${ROOT_DIR}" && rg --files tests/e2e \
    --glob '**/*.spec.ts' \
    --glob '**/*.spec.tsx' \
    --glob '**/*.spec.js' \
    --glob '**/*.spec.jsx' \
    --glob '**/*.test.ts' \
    --glob '**/*.test.tsx' \
    --glob '**/*.test.js' \
    --glob '**/*.test.jsx'
)

if [ "${has_specs}" -eq 0 ]; then
  echo "[test:e2e] No e2e spec files found in tests/e2e. Skipping e2e suite."
  exit 0
fi

cd "${ROOT_DIR}"
npx playwright test --config config/test/playwright.config.js "$@"
