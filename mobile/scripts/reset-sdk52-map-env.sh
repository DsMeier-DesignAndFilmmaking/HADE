#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Checking existing react-native-safe-area-context versions..."
npm ls react-native-safe-area-context || true

echo "Removing direct safe-area-context dependency to clear conflicts..."
npm uninstall react-native-safe-area-context || true

echo "Reinstalling SDK 52-compatible safe-area-context and dev client..."
npx expo install react-native-safe-area-context
npx expo install expo-dev-client

echo "Verifying Expo SDK 52 dependency alignment..."
npx expo install --check

echo "Regenerating native projects with New Architecture disabled..."
npx expo prebuild --clean

echo "Done."
