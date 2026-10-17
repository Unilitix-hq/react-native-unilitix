#!/usr/bin/env bash
# Copies UnilitixCore's Swift sources into ios/UnilitixCore so they compile
# inside this pod (no CocoaPods trunk or SPM-in-pods needed).
#
#   scripts/sync-ios-core.sh [path/to/UnilitixCore]   (default ../unilitix-ios/UnilitixCore)
#
# The public facade (Unilitix.swift) is left out: ios/UnilitixBridge.swift
# plays that role here, and a Swift `Unilitix` type would clash with the
# Objective-C module class of the same name.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-../unilitix-ios/UnilitixCore}/Sources/UnilitixCore"
DEST=ios/UnilitixCore
[ -d "$SRC" ] || { echo "UnilitixCore sources not found at $SRC" >&2; exit 1; }
VERSION=$(sed -n 's/.*public static let current = "\(.*\)".*/\1/p' "$SRC/Transport.swift")
rm -rf "$DEST"
mkdir -p "$DEST/Generated"
for f in "$SRC"/*.swift "$SRC"/Generated/*.swift; do
  name=$(basename "$f")
  [ "$name" = "Unilitix.swift" ] && continue
  rel=${f#"$SRC"/}
  { echo "// VENDORED from UnilitixCore $VERSION ($rel) by scripts/sync-ios-core.sh."
    echo "// Do not edit here; change UnilitixCore and re-run the script."
    echo
    cat "$f"; } > "$DEST/$rel"
done
echo "Synced UnilitixCore $VERSION into $DEST"
