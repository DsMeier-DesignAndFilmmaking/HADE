#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Removing iOS native project..."
rm -rf ios

echo "Clearing local Expo caches..."
rm -rf .expo .expo-shared

echo "Removing node_modules and lockfile..."
rm -rf node_modules
rm -f package-lock.json

echo "Clearing global Expo cache..."
rm -rf "${HOME}/.expo"

echo "Checking existing react-native-safe-area-context versions..."
npm ls react-native-safe-area-context || true

echo "Removing direct safe-area-context dependency to clear conflicts..."
npm uninstall react-native-safe-area-context || true

echo "Reinstalling SDK 52-compatible safe-area-context..."
npx expo install react-native-safe-area-context

echo "Installing dependencies..."
npm install

echo "Verifying Expo SDK 52 dependency alignment..."
npx expo install --check

echo "Cleaning iOS native project and regenerating it..."
npx expo prebuild --clean --platform ios

echo "Done."
