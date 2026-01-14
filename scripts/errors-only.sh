#!/bin/bash
# Errors-Only Logging Script
# Sets backend + frontend logging to emit only errors.

set -e

echo "⛔ Enabling Errors-Only Logging for Prompt Builder"
echo "==============================================="

if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi

# Backend
sed -i '' 's/^LOG_LEVEL=.*/LOG_LEVEL=error/' .env 2>/dev/null || \
sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=error/' .env

echo "✅ Set LOG_LEVEL=error"

# Frontend
sed -i '' 's/^VITE_DEBUG_LOGGING=.*/VITE_DEBUG_LOGGING=false/' .env 2>/dev/null || \
sed -i 's/^VITE_DEBUG_LOGGING=.*/VITE_DEBUG_LOGGING=false/' .env

echo "✅ Set VITE_DEBUG_LOGGING=false"

sed -i '' 's/^VITE_LOG_LEVEL=.*/VITE_LOG_LEVEL=error/' .env 2>/dev/null || \
sed -i 's/^VITE_LOG_LEVEL=.*/VITE_LOG_LEVEL=error/' .env

echo "✅ Set VITE_LOG_LEVEL=error"

# Stack metadata (only for errors)
sed -i '' 's/^LOG_STACK_LEVELS=.*/LOG_STACK_LEVELS=error/' .env 2>/dev/null || \
sed -i 's/^LOG_STACK_LEVELS=.*/LOG_STACK_LEVELS=error/' .env

sed -i '' 's/^VITE_LOG_STACK_LEVELS=.*/VITE_LOG_STACK_LEVELS=error/' .env 2>/dev/null || \
sed -i 's/^VITE_LOG_STACK_LEVELS=.*/VITE_LOG_STACK_LEVELS=error/' .env

echo "✅ Set LOG_STACK_LEVELS=error and VITE_LOG_STACK_LEVELS=error"

echo ""
echo "Errors-only logging enabled. Restart your dev server to apply changes."
