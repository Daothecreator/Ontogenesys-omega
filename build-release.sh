#!/bin/bash
# build-release.sh — Production release build for ∆Ω-RESONATOR
# Usage: ./build-release.sh [--sign]
#
# Environment variables for signed builds:
#   KEYSTORE_PATH       Path to .jks keystore file
#   KEYSTORE_PASSWORD   Keystore password
#   KEY_ALIAS           Key alias in keystore
#   KEY_PASSWORD        Key password

set -e

SIGN_BUILD=false
for arg in "$@"; do
  case $arg in
    --sign) SIGN_BUILD=true ;;
  esac
done

echo "==> Building web assets..."
npm run build

echo "==> Syncing Capacitor..."
npx cap sync android

echo "==> Building Android APK..."
cd android

chmod +x gradlew

if [ "$SIGN_BUILD" = true ]; then
  if [ -z "$KEYSTORE_PATH" ] || [ -z "$KEYSTORE_PASSWORD" ] || [ -z "$KEY_ALIAS" ] || [ -z "$KEY_PASSWORD" ]; then
    echo "ERROR: Missing signing environment variables."
    echo "Required: KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD"
    exit 1
  fi

  echo "==> Building signed release APK..."
  ./gradlew assembleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$KEY_PASSWORD" \
    --no-daemon

  APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
  echo "==> Building debug APK..."
  ./gradlew assembleDebug --no-daemon
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

cd ..

echo ""
echo "==> Build complete!"
echo "    APK: android/$APK_PATH"
