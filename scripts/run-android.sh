#!/bin/bash
#
# Wrapper script for expo run:android
# Ensures Kotlin validation runs before build
#

echo "🔍 Running Kotlin validation before build..."
npm run validate:kotlin

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Build aborted: Kotlin plugin validation failed"
  echo "   Fix the issues above, then try again"
  exit 1
fi

echo "✅ Validation passed, starting build..."
npx expo run:android

