#!/usr/bin/env bash
# dev-test.sh — link local @openconduit/core into the client, start the app,
# then restore the published package on exit (Ctrl+C or window close).
set -euo pipefail

CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_ROOT="$CORE_DIR/../openconduit-client"

if [[ ! -d "$CLIENT_ROOT" ]]; then
  echo "❌  Client not found at: $CLIENT_ROOT"
  echo "    Clone openconduit-client next to this repo and try again."
  exit 1
fi

cleanup() {
  echo ""
  echo "🔗  Unlinking and restoring published @openconduit/core..."
  cd "$CLIENT_ROOT"
  npm unlink --no-save @openconduit/core
  npm install --prefer-offline --silent
  echo "✅  Restored. Goodbye."
}
trap cleanup EXIT

echo "🔗  Registering local package..."
cd "$CORE_DIR"
npm link --silent

# npm workspaces hoists node_modules to the repo root — link there, not in packages/desktop
echo "🔗  Linking into client (workspace root)..."
cd "$CLIENT_ROOT"
npm link @openconduit/core --silent

echo ""
echo "🚀  Starting OpenConduit (Ctrl+C to quit and restore)..."
echo ""
npm start
