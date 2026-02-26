#!/usr/bin/env bash
set -euo pipefail

# check-bugfix-test.sh
#
# Enforces that commits with a fix: or fix( prefix include at least one
# new test (a new `it(` or `test(` block in a *.test.* or *.spec.* file).
#
# Used by: pre-commit hook, CI pipeline
# Skip with: SKIP_BUGFIX_TEST_CHECK=1 git commit ...

if [ "${SKIP_BUGFIX_TEST_CHECK:-0}" = "1" ]; then
  echo "   Bugfix test check skipped (SKIP_BUGFIX_TEST_CHECK=1)"
  exit 0
fi

# Get the commit message. During pre-commit, read from the staged commit.
# In CI, read from HEAD.
if [ -f "$(git rev-parse --git-dir)/COMMIT_EDITMSG" ]; then
  COMMIT_MSG="$(head -1 "$(git rev-parse --git-dir)/COMMIT_EDITMSG")"
else
  COMMIT_MSG="$(git log -1 --format=%s HEAD 2>/dev/null || echo '')"
fi

# Only enforce on fix commits
if ! echo "$COMMIT_MSG" | grep -qiE '^fix[:(]'; then
  exit 0
fi

echo "   Fix commit detected: checking for regression test..."

# Check staged files (pre-commit) or HEAD diff (CI) for new test blocks
DIFF_OUTPUT=""
if git diff --cached --name-only 2>/dev/null | grep -q .; then
  # Pre-commit: check staged changes
  DIFF_OUTPUT="$(git diff --cached --unified=0 -- '*.test.*' '*.spec.*' 2>/dev/null || true)"
else
  # CI: check HEAD commit
  DIFF_OUTPUT="$(git diff HEAD~1..HEAD --unified=0 -- '*.test.*' '*.spec.*' 2>/dev/null || true)"
fi

# Look for new test blocks (added lines containing it( or test( )
if echo "$DIFF_OUTPUT" | grep -qE '^\+.*(it\(|test\()'; then
  echo "   ✓ Regression test found in fix commit"
  exit 0
fi

echo ""
echo "   ✗ REJECTED: Fix commit must include a regression test."
echo ""
echo "   Your commit message starts with 'fix:' or 'fix(' but the diff"
echo "   contains no new test blocks (it() or test()) in test files."
echo ""
echo "   The bugfix protocol requires every fix to include a regression test"
echo "   that asserts the violated invariant. See: docs/architecture/BUGFIX_PROTOCOL.md"
echo ""
echo "   If this is a non-code fix (docs, config), skip with:"
echo "     SKIP_BUGFIX_TEST_CHECK=1 git commit ..."
echo ""
exit 1
