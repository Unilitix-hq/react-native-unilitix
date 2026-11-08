#!/usr/bin/env bash
# Copies the generated SDK contract from the api repo:
#   api/sdk/ts/sdkContract.ts        -> src/generated/sdkContract.ts
#   api/sdk/ts/behaviourFixtures.ts  -> src/generated/behaviourFixtures.ts (test loader, not shipped)
#   api/sdk/behaviour/*              -> src/__tests__/behaviour/ (fixtures, runner contract, divergences)
#
#   scripts/sync-contract.sh [path/to/api-repo]   (default $UNILITIX_API_DIR or ../tazama)
#
# Never edit the copies by hand; regenerate in the api repo
# (`go run ./cmd/sdkcontract`) and re-run this script.
set -euo pipefail
cd "$(dirname "$0")/.."
API="${1:-${UNILITIX_API_DIR:-../tazama}}"
SDK="$API/api/sdk"
[ -f "$SDK/ts/sdkContract.ts" ] || { echo "contract not found under $SDK" >&2; exit 1; }
cp "$SDK/ts/sdkContract.ts" src/generated/sdkContract.ts
cp "$SDK/ts/behaviourFixtures.ts" src/generated/behaviourFixtures.ts
mkdir -p src/__tests__/behaviour
find src/__tests__/behaviour -maxdepth 1 -type f \( -name '*.json' -o -name '*.md' \) -delete
cp "$SDK"/behaviour/*.json "$SDK"/behaviour/*.md src/__tests__/behaviour/
echo "Synced contract $(sed -n 's/.*version: "\(.*\)".*/\1/p' src/generated/sdkContract.ts | head -1) from $SDK"
