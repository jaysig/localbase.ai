#!/bin/bash

# LocalBase Electron App Sync Script
# Syncs electron-app from framework to workspaces

set -e

FRAMEWORK_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_SRC="$FRAMEWORK_DIR/electron-app"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 LocalBase Electron App Sync${NC}"
echo ""

# Validate source directory exists
if [ ! -d "$ELECTRON_SRC" ]; then
  echo "❌ Error: electron-app directory not found at $ELECTRON_SRC"
  exit 1
fi

# Find all workspace directories (directories with connectors/ and tools/)
WORKSPACES=()
for dir in ~/Work/*/; do
  workspace_name=$(basename "$dir")

  # Skip the framework itself
  if [ "$workspace_name" = "localbase.ai" ]; then
    continue
  fi

  # Check if it's a LocalBase workspace (has connectors/ and tools/)
  if [ -d "${dir}connectors" ] && [ -d "${dir}tools" ] && [ -f "${dir}package.json" ]; then
    WORKSPACES+=("$dir")
  fi
done

if [ ${#WORKSPACES[@]} -eq 0 ]; then
  echo -e "${YELLOW}⚠️  No workspaces found${NC}"
  exit 0
fi

echo -e "${GREEN}Found ${#WORKSPACES[@]} workspace(s):${NC}"
for workspace in "${WORKSPACES[@]}"; do
  echo "  • $(basename "$workspace")"
done
echo ""

# Sync to each workspace
for workspace in "${WORKSPACES[@]}"; do
  workspace_name=$(basename "$workspace")
  dest="${workspace}electron-app"

  echo -e "${BLUE}📦 Syncing to ${workspace_name}...${NC}"

  # Remove old electron-app if it exists
  if [ -d "$dest" ]; then
    rm -rf "$dest"
  fi

  # Copy electron-app directory
  # Exclude: node_modules, dist, build outputs
  rsync -a \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.DS_Store' \
    --exclude 'tmp' \
    --exclude 'build-resources' \
    "$ELECTRON_SRC/" "$dest/"

  echo -e "${GREEN}  ✓ Synced electron-app to ${workspace_name}${NC}"
done

echo ""
echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. cd ~/Work/<workspace>/electron-app"
echo "  2. npm install (if package.json changed)"
echo "  3. npm run prod:install"
