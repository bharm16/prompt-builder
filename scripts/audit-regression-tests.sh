#!/usr/bin/env bash
set -euo pipefail

# List all regression test files in the codebase.
# Used for auditing: every file should test an invariant, not a specific fix.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=== Regression Test Audit ==="
echo ""

FILES=$(find "$ROOT" -name '*.regression.test.*' -not -path '*/node_modules/*' | sort)

if [ -z "$FILES" ]; then
  echo "No regression tests found (*.regression.test.*)."
  echo ""
  echo "Regression tests should be added for every bugfix."
  echo "See: docs/architecture/BUGFIX_PROTOCOL.md"
  exit 0
fi

COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Found $COUNT regression test file(s):"
echo ""

for FILE in $FILES; do
  REL="${FILE#"$ROOT/"}"
  # Extract describe block names for context
  DESCRIBES=$(grep -oE "describe\(['\"].*?['\"]" "$FILE" 2>/dev/null | head -3 | sed "s/describe(['\"]//;s/['\"]$//" || true)
  echo "  $REL"
  if [ -n "$DESCRIBES" ]; then
    echo "$DESCRIBES" | while IFS= read -r DESC; do
      echo "    → $DESC"
    done
  fi
  echo ""
done

echo "---"
echo "Each regression test should:"
echo "  1. Name the invariant it protects in the describe block"
echo "  2. Use property-based testing (fast-check) where applicable"
echo "  3. Mock only external boundaries, not peer services"
