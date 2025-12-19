#!/bin/bash
# Disable Debug Mode Script

echo "🔇 Disabling Debug Mode for Prompt Builder"
echo "=========================================="

if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi

# Disable debug logging
sed -i '' 's/^LOG_LEVEL=debug/LOG_LEVEL=info/' .env 2>/dev/null || \
sed -i 's/^LOG_LEVEL=debug/LOG_LEVEL=info/' .env
echo "✅ Set LOG_LEVEL=info"

sed -i '' 's/^VITE_DEBUG_LOGGING=true/VITE_DEBUG_LOGGING=false/' .env 2>/dev/null || \
sed -i 's/^VITE_DEBUG_LOGGING=true/VITE_DEBUG_LOGGING=false/' .env
echo "✅ Set VITE_DEBUG_LOGGING=false"

sed -i '' 's/^VITE_LOG_LEVEL=debug/VITE_LOG_LEVEL=warn/' .env 2>/dev/null || \
sed -i 's/^VITE_LOG_LEVEL=debug/VITE_LOG_LEVEL=warn/' .env
echo "✅ Set VITE_LOG_LEVEL=warn"

echo ""
echo "Debug mode disabled. Restart your dev server to apply changes."
