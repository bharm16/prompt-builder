#!/usr/bin/env bash
set -euo pipefail

# check-regression-test-quality.sh
#
# Audits *.regression.test.* files for common anti-patterns that make
# regression tests ineffective. Specifically checks for:
#
# 1. vi.mock() calls that mock internal services (not external boundaries)
# 2. Regression tests that mock the module adjacent to themselves
#
# External boundaries that ARE acceptable to mock:
#   - firebase, @firebase/*, @/config/firebase
#   - openai, @google/generative-ai, groq-sdk (LLM providers)
#   - stripe
#   - redis, ioredis
#   - node:fs, node:http (network/filesystem)
#   - Any URL or API endpoint mock
#
# Run: npm run test:regression:quality
# CI:  Part of test.yml regression-quality job

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Allowed mock patterns (external boundaries only)
ALLOWED_MOCKS=(
  'firebase'
  '@firebase/'
  '@/config/firebase'
  'openai'
  '@google/generative-ai'
  'groq-sdk'
  'stripe'
  'redis'
  'ioredis'
  'node:'
  'pino'
  'lucide-react'
)

FILES=$(find "$ROOT" -name '*.regression.test.*' -not -path '*/node_modules/*' | sort)

if [ -z "$FILES" ]; then
  echo "No regression test files found."
  exit 0
fi

VIOLATIONS=0
TOTAL=0

echo "=== Regression Test Quality Check ==="
echo ""

for FILE in $FILES; do
  TOTAL=$((TOTAL + 1))
  REL="${FILE#"$ROOT/"}"

  # Extract all vi.mock() targets from the file
  MOCKS=$(grep -oE "vi\.mock\(['\"][^'\"]+['\"]" "$FILE" 2>/dev/null | sed "s/vi\.mock(['\"]//;s/['\"]$//" || true)

  if [ -z "$MOCKS" ]; then
    continue
  fi

  FILE_HAS_VIOLATION=0

  while IFS= read -r MOCK_TARGET; do
    IS_ALLOWED=0

    for PATTERN in "${ALLOWED_MOCKS[@]}"; do
      if echo "$MOCK_TARGET" | grep -q "$PATTERN"; then
        IS_ALLOWED=1
        break
      fi
    done

    if [ "$IS_ALLOWED" -eq 0 ]; then
      if [ "$FILE_HAS_VIOLATION" -eq 0 ]; then
        echo "❌ $REL"
        FILE_HAS_VIOLATION=1
      fi
      echo "   vi.mock('$MOCK_TARGET') — mocks an internal service"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$MOCKS"

  if [ "$FILE_HAS_VIOLATION" -eq 1 ]; then
    echo ""
  fi
done

echo "---"
echo "Scanned $TOTAL regression test file(s)."

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "⚠️  Found $VIOLATIONS internal mock(s) in regression tests."
  echo ""
  echo "Regression tests should mock only external boundaries:"
  echo "  ✓ LLM APIs (openai, groq-sdk, @google/generative-ai)"
  echo "  ✓ Firebase (firebase, @firebase/*, @/config/firebase)"
  echo "  ✓ Stripe, Redis, filesystem, network"
  echo ""
  echo "Internal services should NOT be mocked in regression tests."
  echo "If you need to mock an internal service, move the test up one"
  echo "layer (e.g., test the HTTP route instead of the service)."
  echo ""
  echo "See: docs/architecture/BUGFIX_PROTOCOL.md"
  echo ""
  echo "To add an allowed external mock pattern, edit:"
  echo "  scripts/check-regression-test-quality.sh (ALLOWED_MOCKS array)"
  exit 1
fi

echo "✅ All regression tests mock only external boundaries."
exit 0
