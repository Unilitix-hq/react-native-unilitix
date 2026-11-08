#!/bin/bash
# Xcode "Run Script" build phase: uploads the release JS source map to
# Unilitix. Add it AFTER "Bundle React Native code and images":
#
#   "$("${NODE_BINARY:-node}" --print "require('path').dirname(require.resolve('react-native-unilitix/package.json'))")/scripts/upload-sourcemaps.sh"
#
# and make react-native-xcode.sh write the map by adding to ios/.xcode.env:
#
#   export SOURCEMAP_FILE="$DERIVED_FILE_DIR/main.jsbundle.map"
#
# (with Hermes, react-native-xcode.sh then composes the Metro and Hermes
# maps into that file). The Expo config plugin does both for you.
#
# Environment: UNILITIX_API_KEY (required to upload; never printed),
# UNILITIX_CLI (default unilitix-cli on PATH), UNILITIX_UPLOAD_DEBUG=1 to
# also upload Debug builds, UNILITIX_SOURCEMAPS_DISABLED=1 to skip,
# UNILITIX_SOURCEMAPS_STRICT=1 to fail the build when the upload fails.
set -u

if [ "${UNILITIX_SOURCEMAPS_DISABLED:-}" = "1" ]; then
  exit 0
fi
if [ "${CONFIGURATION:-}" = "Debug" ] && [ "${UNILITIX_UPLOAD_DEBUG:-}" != "1" ]; then
  echo "[unilitix] Debug build: source map not uploaded"
  exit 0
fi

# NODE_BINARY and friends, as react-native-xcode.sh loads them.
if [ -n "${PODS_ROOT:-}" ]; then
  [ -f "$PODS_ROOT/../.xcode.env" ] && . "$PODS_ROOT/../.xcode.env"
  [ -f "$PODS_ROOT/../.xcode.env.local" ] && . "$PODS_ROOT/../.xcode.env.local"
fi
NODE_BINARY="${NODE_BINARY:-node}"

BUNDLE="${CONFIGURATION_BUILD_DIR:-}/${UNLOCALIZED_RESOURCES_FOLDER_PATH:-}/main.jsbundle"
MAP="${SOURCEMAP_FILE:-${DERIVED_FILE_DIR:-}/main.jsbundle.map}"
PLIST="${TARGET_BUILD_DIR:-}/${INFOPLIST_PATH:-}"

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$PLIST" 2>/dev/null
}
VERSION="$(plist_value CFBundleShortVersionString)"
BUILD="$(plist_value CFBundleVersion)"
VERSION="${VERSION:-${MARKETING_VERSION:-}}"
BUILD="${BUILD:-${CURRENT_PROJECT_VERSION:-}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$NODE_BINARY" "$SCRIPT_DIR/unilitix-sourcemaps.js" upload \
  --platform ios \
  --bundle "$BUNDLE" \
  --sourcemap "$MAP" \
  --app-version "$VERSION" \
  --build "$BUILD"
