#!/bin/bash
# Sync framework code from localbase.ai to this instance
# Run from INSTANCE directory: ./scripts/sync-framework.sh

set -e

FRAMEWORK_DIR=~/Work/localbase.ai
INSTANCE_DIR=$(pwd)

echo "🔄 Syncing framework from localbase.ai..."
echo "   Source: $FRAMEWORK_DIR"
echo "   Target: $INSTANCE_DIR"
echo ""

# Sync app/ (Vite + React UI)
echo "📱 Syncing app/..."
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/app/ $INSTANCE_DIR/app/

# Sync tools/ framework
echo "🔧 Syncing tools/..."
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/tools/ $INSTANCE_DIR/tools/

# Sync scripts/ (except sync-framework.sh which must stay instance-local)
echo "📜 Syncing scripts/..."
mkdir -p $INSTANCE_DIR/scripts
rsync -av \
  --exclude 'sync-framework.sh' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/scripts/ $INSTANCE_DIR/scripts/

# Sync connector base classes (NOT business connectors)
echo "🔌 Syncing connector base classes..."
cp $FRAMEWORK_DIR/connectors/MCPAdapter.js $INSTANCE_DIR/connectors/ 2>/dev/null || true
cp $FRAMEWORK_DIR/connectors/APIClient.js $INSTANCE_DIR/connectors/ 2>/dev/null || true

# Sync viz/ html templates (but not instance-specific visualizations)
echo "📊 Syncing viz/ templates..."
mkdir -p $INSTANCE_DIR/viz
# Only sync framework templates if they exist
for f in $FRAMEWORK_DIR/viz/*.html; do
  [ -e "$f" ] && cp "$f" $INSTANCE_DIR/viz/ 2>/dev/null || true
done

# Clean up old directories that no longer exist in framework
for OLD_DIR in electron-app web-app tools/connectors; do
  if [ -d "$INSTANCE_DIR/$OLD_DIR" ]; then
    echo "🧹 Removing deprecated $OLD_DIR..."
    rm -rf "$INSTANCE_DIR/$OLD_DIR"
  fi
done

echo ""
echo "✅ Framework sync complete!"
echo ""
echo "🚨 INSTANCE-SPECIFIC (never synced from framework):"
echo "   - CLAUDE.md"
echo "   - connectors/*/ (business connectors)"
echo "   - extensions/"
echo "   - projects/"
echo "   - data/"
echo "   - env.local"
echo ""
echo "📋 Next steps:"
echo "   1. npm install (if package.json changed)"
echo "   2. git status to review changes"
