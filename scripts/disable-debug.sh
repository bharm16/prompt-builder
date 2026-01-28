#!/bin/bash
# Disable Debug Mode Script

echo "🔇 Disabling Debug Mode for Prompt Builder"
echo "=========================================="

if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi

# Disable debug logging
sed -i '' 's/^LOG_LEVEL=.*/LOG_LEVEL=warn/' .env 2>/dev/null || \
sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=warn/' .env
echo "✅ Set LOG_LEVEL=warn"

sed -i '' 's/^VITE_DEBUG_LOGGING=.*/VITE_DEBUG_LOGGING=false/' .env 2>/dev/null || \
sed -i 's/^VITE_DEBUG_LOGGING=.*/VITE_DEBUG_LOGGING=false/' .env
echo "✅ Set VITE_DEBUG_LOGGING=false"

sed -i '' 's/^VITE_LOG_LEVEL=.*/VITE_LOG_LEVEL=warn/' .env 2>/dev/null || \
sed -i 's/^VITE_LOG_LEVEL=.*/VITE_LOG_LEVEL=warn/' .env
echo "✅ Set VITE_LOG_LEVEL=warn"

# Reduce stack metadata to warnings+errors only
sed -i '' 's/^LOG_STACK_LEVELS=.*/LOG_STACK_LEVELS=warn,error/' .env 2>/dev/null || \
sed -i 's/^LOG_STACK_LEVELS=.*/LOG_STACK_LEVELS=warn,error/' .env
sed -i '' 's/^VITE_LOG_STACK_LEVELS=.*/VITE_LOG_STACK_LEVELS=warn,error/' .env 2>/dev/null || \
sed -i 's/^VITE_LOG_STACK_LEVELS=.*/VITE_LOG_STACK_LEVELS=warn,error/' .env
echo "✅ Set LOG_STACK_LEVELS=warn,error and VITE_LOG_STACK_LEVELS=warn,error"

echo ""
echo "Debug mode disabled. Restart your dev server to apply changes."
