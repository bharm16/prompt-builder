#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOK_SRC="${SCRIPT_DIR}/hooks/pre-commit"
HOOK_DST="${ROOT_DIR}/.git/hooks/pre-commit"

if [ ! -f "${HOOK_SRC}" ]; then
  echo "Error: ${HOOK_SRC} not found"
  exit 1
fi

cp "${HOOK_SRC}" "${HOOK_DST}"
chmod +x "${HOOK_DST}"
echo "Pre-commit hook installed at ${HOOK_DST}"
