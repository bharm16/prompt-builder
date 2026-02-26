#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DIR="${ROOT_DIR}/tests/e2e"
IS_CI="${CI:-false}"

fail_or_skip() {
  local message="$1"
  if [ "${IS_CI}" = "true" ]; then
    echo "[test:e2e] ${message} Failing because CI requires executable e2e coverage."
    exit 1
  fi
  echo "[test:e2e] ${message} Skipping e2e suite."
  exit 0
}

if [ ! -d "${E2E_DIR}" ]; then
  fail_or_skip "No tests/e2e directory found."
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
  fail_or_skip "No e2e spec files found in tests/e2e."
fi

cd "${ROOT_DIR}"
npx playwright test --config config/test/playwright.config.js "$@"
