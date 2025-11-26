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

# Sync electron-app (full replacement since it's gitignored)
echo "📱 Syncing electron-app..."
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/electron-app/ $INSTANCE_DIR/electron-app/

# Sync tools framework
echo "🔧 Syncing tools..."
rsync -av \
  --exclude 'node_modules' \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/tools/ $INSTANCE_DIR/tools/

# Sync web-app framework (if exists)
if [ -d "$FRAMEWORK_DIR/web-app" ]; then
  echo "🎨 Syncing web-app..."
  rsync -av \
    --exclude 'viz/*.html' \
    --exclude 'assets/visualizations.json' \
    --exclude '.DS_Store' \
    $FRAMEWORK_DIR/web-app/ $INSTANCE_DIR/web-app/
fi

# Sync scripts (except sync-framework.sh which must stay instance-local)
if [ -d "$FRAMEWORK_DIR/scripts" ]; then
  echo "📜 Syncing scripts..."
  mkdir -p $INSTANCE_DIR/scripts
  rsync -av \
    --exclude 'sync-framework.sh' \
    --exclude '.DS_Store' \
    $FRAMEWORK_DIR/scripts/ $INSTANCE_DIR/scripts/
fi

# Sync connector base classes (NOT business connectors)
echo "🔌 Syncing connector base classes..."
cp $FRAMEWORK_DIR/connectors/MCPAdapter.js $INSTANCE_DIR/connectors/ 2>/dev/null || true
cp $FRAMEWORK_DIR/connectors/APIClient.js $INSTANCE_DIR/connectors/ 2>/dev/null || true

# Migrate old import paths in instance connectors
echo "🔄 Migrating connector imports..."
# Fix old ../base.js imports -> ../MCPAdapter.js
find $INSTANCE_DIR/connectors -name "*.js" -type f -exec \
  sed -i '' "s|from '../base.js'|from '../MCPAdapter.js'|g" {} \; 2>/dev/null || true
find $INSTANCE_DIR/connectors -name "*.js" -type f -exec \
  sed -i '' "s|from \"../base.js\"|from \"../MCPAdapter.js\"|g" {} \; 2>/dev/null || true
# Fix old ../MCPConnector.js imports -> ../MCPAdapter.js
find $INSTANCE_DIR/connectors -name "*.js" -type f -exec \
  sed -i '' "s|from '../MCPConnector.js'|from '../MCPAdapter.js'|g" {} \; 2>/dev/null || true
find $INSTANCE_DIR/connectors -name "*.js" -type f -exec \
  sed -i '' "s|from \"../MCPConnector.js\"|from \"../MCPAdapter.js\"|g" {} \; 2>/dev/null || true

# Fix old ../../tools/connectors/BaseConnector.js imports -> ../APIClient.js
find $INSTANCE_DIR/connectors -name "*.js" -type f -exec \
  sed -i '' "s|from '../../tools/connectors/BaseConnector.js'|from '../APIClient.js'|g" {} \; 2>/dev/null || true
find $INSTANCE_DIR/connectors -name "*.js" -type f -exec \
  sed -i '' "s|from \"../../tools/connectors/BaseConnector.js\"|from \"../APIClient.js\"|g" {} \; 2>/dev/null || true

# Clean up old tools/connectors directory if it exists
if [ -d "$INSTANCE_DIR/tools/connectors" ]; then
  echo "🧹 Removing old tools/connectors directory..."
  rm -rf $INSTANCE_DIR/tools/connectors
fi

echo ""
echo "✅ Framework sync complete!"
echo ""
echo "⚠️  IMPORTANT: If electron-app dependencies changed, run:"
echo "   cd electron-app && npm install"
echo ""
echo "🚨 INSTANCE-SPECIFIC FILES (NEVER sync these from framework):"
echo "   - CLAUDE.md (instance-specific context and connectors)"
echo "   - connectors/*/ (business-specific data connectors - base classes ARE synced)"
echo "   - extensions/ (business-specific tools like CRM, MediaTrader)"
echo "   - data/ (business-specific databases)"
echo "   - env.local (instance-specific credentials)"
echo "   - web-app/assets/visualizations.json (instance-specific viz registry)"
echo ""
echo "📋 Next steps:"
echo "   1. Install deps (if needed): cd electron-app && npm install"
echo "   2. Test the app: cd electron-app && npm run electron:dev"
echo "   3. Review changes: git status"
echo "   4. Commit instance-specific fixes if needed"
