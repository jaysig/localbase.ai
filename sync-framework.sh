#!/bin/bash
# Sync framework code from localbase.ai to this instance
# Run this after framework updates in main branch

set -e

FRAMEWORK_DIR=~/Work/localbase.ai
INSTANCE_DIR=$(pwd)

echo "🔄 Syncing framework from localbase.ai..."
echo "   Source: $FRAMEWORK_DIR"
echo "   Target: $INSTANCE_DIR"
echo ""

# Sync app/ (browser UI - full replacement since it's gitignored)
echo "📱 Syncing app/..."
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/app/ $INSTANCE_DIR/app/

# Sync tools framework
echo "🔧 Syncing tools..."
rsync -av \
  --exclude 'node_modules' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/tools/ $INSTANCE_DIR/tools/

# Sync connector base classes (NOT business connectors)
echo "🔌 Syncing connector base classes..."
cp $FRAMEWORK_DIR/connectors/MCPAdapter.js $INSTANCE_DIR/connectors/ 2>/dev/null || true
cp $FRAMEWORK_DIR/connectors/APIClient.js $INSTANCE_DIR/connectors/ 2>/dev/null || true

# Clean up old directories that are no longer used
if [ -d "$INSTANCE_DIR/electron-app" ]; then
  echo "🧹 Removing old electron-app/ directory..."
  rm -rf $INSTANCE_DIR/electron-app
fi

if [ -d "$INSTANCE_DIR/web-app" ]; then
  echo "🧹 Removing old web-app/ directory..."
  rm -rf $INSTANCE_DIR/web-app
fi

# Migrate viz from data/viz/ to viz/ at workspace root
if [ -d "$INSTANCE_DIR/data/viz" ] && [ -n "$(ls -A $INSTANCE_DIR/data/viz 2>/dev/null)" ]; then
  echo "🔄 Migrating viz files from data/viz/ to viz/..."
  mkdir -p $INSTANCE_DIR/viz
  mv $INSTANCE_DIR/data/viz/* $INSTANCE_DIR/viz/ 2>/dev/null || true
  rmdir $INSTANCE_DIR/data/viz 2>/dev/null || true
fi

# Migrate visualizations.json from data/assets/ to viz/
if [ -f "$INSTANCE_DIR/data/assets/visualizations.json" ]; then
  echo "🔄 Migrating visualizations.json from data/assets/ to viz/..."
  mkdir -p $INSTANCE_DIR/viz
  mv $INSTANCE_DIR/data/assets/visualizations.json $INSTANCE_DIR/viz/ 2>/dev/null || true
  rmdir $INSTANCE_DIR/data/assets 2>/dev/null || true
fi

if [ -d "$INSTANCE_DIR/tools/connectors" ]; then
  echo "🧹 Removing old tools/connectors directory..."
  rm -rf $INSTANCE_DIR/tools/connectors
fi

echo ""
echo "✅ Framework sync complete!"
echo ""
echo "⚠️  IMPORTANT: If app dependencies changed, run:"
echo "   cd app && npm install"
echo ""
echo "🚨 INSTANCE-SPECIFIC FILES (NEVER sync these from framework):"
echo "   - CLAUDE.md (instance-specific context and connectors)"
echo "   - connectors/*/ (business-specific data connectors - base classes ARE synced)"
echo "   - data/ (business-specific databases)"
echo "   - viz/ (instance-specific visualizations)"
echo "   - env.local (instance-specific credentials)"
echo ""
echo "📋 Next steps:"
echo "   1. Install deps (if needed): cd app && npm install"
echo "   2. Start dev server: npm run dev"
echo "   3. Review changes: git status"
