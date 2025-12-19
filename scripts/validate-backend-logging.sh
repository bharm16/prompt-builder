#!/bin/bash
# Backend Logging Validation Script
# Validates that backend logging follows established patterns

set -e

echo "================================================"
echo "Backend Logging Validation"
echo "================================================"
echo ""

ERRORS=0

# Check for console statements
echo "1. Checking for console statements in production code..."
CONSOLE_COUNT=$(grep -r "console\." server/src/ \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude="*.test.*" \
  --exclude="*.spec.*" \
  --include="*.ts" \
  --include="*.js" \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$CONSOLE_COUNT" -eq 0 ]; then
  echo "   ✅ No console statements found in production code"
else
  echo "   ❌ Found $CONSOLE_COUNT console statements:"
  grep -rn "console\." server/src/ \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    --exclude="*.test.*" \
    --exclude="*.spec.*" \
    --include="*.ts" \
    --include="*.js" \
    2>/dev/null || true
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check for incorrect warn/info/debug signatures (3 arguments)
echo "2. Checking for incorrect logger method signatures..."
INCORRECT_SIGS=$(grep -rPn "\.(warn|info|debug)\s*\([^)]+,[^)]+,[^)]+\)" server/src/ \
  --include="*.ts" \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  2>/dev/null | grep -v "^\s*//" | wc -l | tr -d ' ')

if [ "$INCORRECT_SIGS" -eq 0 ]; then
  echo "   ✅ No incorrect logger signatures found"
else
  echo "   ❌ Found $INCORRECT_SIGS potential incorrect signatures:"
  echo "   (warn/info/debug should only take 2 args: message, meta)"
  grep -rPn "\.(warn|info|debug)\s*\([^)]+,[^)]+,[^)]+\)" server/src/ \
    --include="*.ts" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    2>/dev/null | grep -v "^\s*//" || true
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check for logger imports
echo "3. Checking logger imports..."
LOGGER_IMPORTS=$(grep -r "from.*Logger" server/src/ \
  --include="*.ts" \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$LOGGER_IMPORTS" -gt 0 ]; then
  echo "   ✅ Found $LOGGER_IMPORTS files importing logger"
else
  echo "   ⚠️  No logger imports found (may be using global logger)"
fi
echo ""

# Check for sensitive data patterns
echo "4. Checking for potential sensitive data in logs..."
SENSITIVE_PATTERNS=0

# Check for password logging
PASSWORD_LOGS=$(grep -rn "password.*:" server/src/ \
  --include="*.ts" \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  2>/dev/null | grep -E "(log\.|logger\.)" | wc -l | tr -d ' ')

if [ "$PASSWORD_LOGS" -gt 0 ]; then
  echo "   ⚠️  Found $PASSWORD_LOGS potential password logging:"
  grep -rn "password.*:" server/src/ \
    --include="*.ts" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    2>/dev/null | grep -E "(log\.|logger\.)" || true
  SENSITIVE_PATTERNS=$((SENSITIVE_PATTERNS + 1))
fi

# Check for API key logging
APIKEY_LOGS=$(grep -rn "apiKey.*:" server/src/ \
  --include="*.ts" \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  2>/dev/null | grep -E "(log\.|logger\.)" | wc -l | tr -d ' ')

if [ "$APIKEY_LOGS" -gt 0 ]; then
  echo "   ⚠️  Found $APIKEY_LOGS potential API key logging:"
  grep -rn "apiKey.*:" server/src/ \
    --include="*.ts" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    2>/dev/null | grep -E "(log\.|logger\.)" || true
  SENSITIVE_PATTERNS=$((SENSITIVE_PATTERNS + 1))
fi

if [ "$SENSITIVE_PATTERNS" -eq 0 ]; then
  echo "   ✅ No obvious sensitive data patterns found"
  echo "   (Manual review still recommended)"
fi
echo ""

# Check for sanitization utility usage
echo "5. Checking for sanitization utility usage..."
SANITIZE_USAGE=$(grep -r "sanitizeHeaders\|summarize\|redactSensitiveFields" server/src/ \
  --include="*.ts" \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$SANITIZE_USAGE" -gt 0 ]; then
  echo "   ✅ Found $SANITIZE_USAGE uses of sanitization utilities"
else
  echo "   ⚠️  No sanitization utilities found in use"
  echo "   Consider using sanitizeHeaders(), summarize(), etc."
fi
echo ""

# Summary
echo "================================================"
echo "Validation Summary"
echo "================================================"
if [ $ERRORS -eq 0 ]; then
  echo "✅ All automated checks passed!"
  echo ""
  echo "Next steps:"
  echo "1. Run the application with LOG_LEVEL=debug"
  echo "2. Exercise major code paths"
  echo "3. Verify log output format and content"
  echo "4. Check for any remaining issues manually"
  exit 0
else
  echo "❌ Found $ERRORS issue(s) that need attention"
  echo ""
  echo "Please fix the issues above and run validation again"
  exit 1
fi
