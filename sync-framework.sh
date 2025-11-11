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

# Sync app framework (if exists)
if [ -d "$FRAMEWORK_DIR/app" ]; then
  echo "🎨 Syncing app..."
  rsync -av \
    --exclude 'viz/*.html' \
    --exclude 'assets/visualizations.json' \
    --exclude '.DS_Store' \
    $FRAMEWORK_DIR/app/ $INSTANCE_DIR/app/
fi

echo ""
echo "✅ Framework sync complete!"
echo ""
echo "⚠️  IMPORTANT: If electron-app dependencies changed, run:"
echo "   cd electron-app && npm install"
echo ""
echo "🚨 INSTANCE-SPECIFIC FILES (NEVER sync these from framework):"
echo "   - CLAUDE.md (instance-specific context and connectors)"
echo "   - connectors/ (business-specific data connectors)"
echo "   - extensions/ (business-specific tools like CRM, MediaTrader)"
echo "   - data/ (business-specific databases)"
echo "   - env.local (instance-specific credentials)"
echo "   - app/assets/visualizations.json (instance-specific viz registry)"
echo ""
echo "📋 Next steps:"
echo "   1. Install deps (if needed): cd electron-app && npm install"
echo "   2. Test the app: cd electron-app && npm run electron:dev"
echo "   3. Review changes: git status"
echo "   4. Commit instance-specific fixes if needed"
