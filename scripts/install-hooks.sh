#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOOKS_SRC="${SCRIPT_DIR}/hooks"
HOOKS_DST="${ROOT_DIR}/.git/hooks"

for HOOK in pre-commit commit-msg; do
  SRC="${HOOKS_SRC}/${HOOK}"
  DST="${HOOKS_DST}/${HOOK}"

  if [ ! -f "${SRC}" ]; then
    echo "Warning: ${SRC} not found, skipping"
    continue
  fi

  cp "${SRC}" "${DST}"
  chmod +x "${DST}"
  echo "${HOOK} hook installed at ${DST}"
done
