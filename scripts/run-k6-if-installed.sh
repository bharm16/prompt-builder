#!/usr/bin/env bash
set -euo pipefail

if ! command -v k6 >/dev/null 2>&1; then
  echo "[k6] k6 is not installed."
  echo "[k6] Install k6 first (https://k6.io/docs/get-started/installation/) or run in CI where k6 is provisioned."
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "[k6] Usage: scripts/run-k6-if-installed.sh <script> [k6 args...]"
  exit 1
fi

SCRIPT_PATH="$1"
shift

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "[k6] Load test script not found: $SCRIPT_PATH"
  exit 1
fi

exec k6 run "$SCRIPT_PATH" "$@"
