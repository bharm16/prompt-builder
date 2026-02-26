#!/usr/bin/env bash
set -euo pipefail

# DR Smoke Test
# Verifies data integrity after a Firestore restore by checking:
# 1. Credit balance totals match transaction sums
# 2. Video job counts by status are reasonable
# 3. No orphaned credit transactions
# 4. DLQ entries reference valid jobs
#
# Usage:
#   scripts/ops/dr-smoke-test.sh --target emulator
#   scripts/ops/dr-smoke-test.sh --target <PROJECT_ID>
#
# Requires: node (>= 20), firebase-admin SDK

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 --target <emulator|PROJECT_ID>" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Error: --target is required" >&2
  exit 1
fi

echo "=== DR Smoke Test ==="
echo "Target: $TARGET"
echo ""

# Set emulator env if targeting emulator
if [[ "$TARGET" == "emulator" ]]; then
  export FIRESTORE_EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-localhost:8080}"
  export GCLOUD_PROJECT="demo-project"
  echo "Using emulator at $FIRESTORE_EMULATOR_HOST"
else
  export GCLOUD_PROJECT="$TARGET"
fi

# Run the Node.js verification script
node --experimental-vm-modules "$SCRIPT_DIR/dr-smoke-test.mjs"
