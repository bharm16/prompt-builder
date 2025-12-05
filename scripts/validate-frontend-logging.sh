#!/bin/bash
# Frontend Logging Validation Script
# Validates that frontend logging follows established patterns

set -e

echo "================================================"
echo "Frontend Logging Validation"
echo "================================================"
echo ""

ERRORS=0

# Check for console statements
echo "1. Checking for console statements in production code..."
CONSOLE_COUNT=$(grep -r "console\." client/src/ \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  --exclude="*.test.*" \
  --exclude="*.spec.*" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$CONSOLE_COUNT" -eq 0 ]; then
  echo "   ✅ No console statements found in production code"
else
  echo "   ❌ Found $CONSOLE_COUNT console statements:"
  grep -rn "console\." client/src/ \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    --exclude-dir=dist \
    --exclude="*.test.*" \
    --exclude="*.spec.*" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    2>/dev/null || true
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check for incorrect warn/info/debug signatures (3 arguments)
echo "2. Checking for incorrect logger method signatures..."
INCORRECT_SIGS=$(grep -rPn "\.(warn|info|debug)\s*\([^)]+,[^)]+,[^)]+\)" client/src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  2>/dev/null | grep -v "^\s*//" | wc -l | tr -d ' ')

if [ "$INCORRECT_SIGS" -eq 0 ]; then
  echo "   ✅ No incorrect logger signatures found"
else
  echo "   ❌ Found $INCORRECT_SIGS potential incorrect signatures:"
  echo "   (warn/info/debug should only take 2 args: message, meta)"
  grep -rPn "\.(warn|info|debug)\s*\([^)]+,[^)]+,[^)]+\)" client/src/ \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    --exclude-dir=dist \
    2>/dev/null | grep -v "^\s*//" || true
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check for logger imports
echo "3. Checking logger imports..."
LOGGER_IMPORTS=$(grep -r "from.*LoggingService\|useDebugLogger" client/src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$LOGGER_IMPORTS" -gt 0 ]; then
  echo "   ✅ Found $LOGGER_IMPORTS files importing logger/useDebugLogger"
else
  echo "   ⚠️  No logger imports found"
fi
echo ""

# Check for useDebugLogger usage in components
echo "4. Checking useDebugLogger usage in components..."
DEBUG_LOGGER_USAGE=$(grep -r "useDebugLogger" client/src/components/ client/src/features/ \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$DEBUG_LOGGER_USAGE" -gt 0 ]; then
  echo "   ✅ Found $DEBUG_LOGGER_USAGE components using useDebugLogger"
else
  echo "   ⚠️  No useDebugLogger usage found in components"
fi
echo ""

# Check for sensitive data patterns
echo "5. Checking for potential sensitive data in logs..."
SENSITIVE_PATTERNS=0

# Check for password logging
PASSWORD_LOGS=$(grep -rn "password.*:" client/src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  2>/dev/null | grep -E "(log\.|logger\.|debug\.)" | wc -l | tr -d ' ')

if [ "$PASSWORD_LOGS" -gt 0 ]; then
  echo "   ⚠️  Found $PASSWORD_LOGS potential password logging:"
  grep -rn "password.*:" client/src/ \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    --exclude-dir=dist \
    2>/dev/null | grep -E "(log\.|logger\.|debug\.)" || true
  SENSITIVE_PATTERNS=$((SENSITIVE_PATTERNS + 1))
fi

# Check for API key logging
APIKEY_LOGS=$(grep -rn "apiKey.*:" client/src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  2>/dev/null | grep -E "(log\.|logger\.|debug\.)" | wc -l | tr -d ' ')

if [ "$APIKEY_LOGS" -gt 0 ]; then
  echo "   ⚠️  Found $APIKEY_LOGS potential API key logging:"
  grep -rn "apiKey.*:" client/src/ \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --exclude-dir=node_modules \
    --exclude-dir=__tests__ \
    --exclude-dir=dist \
    2>/dev/null | grep -E "(log\.|logger\.|debug\.)" || true
  SENSITIVE_PATTERNS=$((SENSITIVE_PATTERNS + 1))
fi

if [ "$SENSITIVE_PATTERNS" -eq 0 ]; then
  echo "   ✅ No obvious sensitive data patterns found"
  echo "   (Manual review still recommended)"
fi
echo ""

# Check for sanitization utility usage
echo "6. Checking for sanitization utility usage..."
SANITIZE_USAGE=$(grep -r "sanitizeHeaders\|summarize\|redactSensitiveFields\|sanitizeError" client/src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$SANITIZE_USAGE" -gt 0 ]; then
  echo "   ✅ Found $SANITIZE_USAGE uses of sanitization utilities"
else
  echo "   ⚠️  No sanitization utilities found in use"
  echo "   Consider using sanitizeHeaders(), summarize(), etc."
fi
echo ""

# Check for LoggingService features
echo "7. Checking LoggingService feature usage..."
TIMER_USAGE=$(grep -r "startTimer\|endTimer" client/src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=__tests__ \
  --exclude-dir=dist \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$TIMER_USAGE" -gt 0 ]; then
  echo "   ✅ Found $TIMER_USAGE uses of timer functions (startTimer/endTimer)"
else
  echo "   ⚠️  No timer usage found"
  echo "   Consider using startTimer/endTimer for async operations"
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
  echo "1. Set VITE_DEBUG_LOGGING=true in .env"
  echo "2. Run the application and open browser console"
  echo "3. Exercise major code paths"
  echo "4. Verify log output in browser console"
  echo "5. Test log export: window.__logger.exportLogs()"
  exit 0
else
  echo "❌ Found $ERRORS issue(s) that need attention"
  echo ""
  echo "Please fix the issues above and run validation again"
  exit 1
fi
