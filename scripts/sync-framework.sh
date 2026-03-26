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
  --exclude 'src/components/tools/' \
  --exclude 'src/components/crm/' \
  --exclude 'src/components/index/' \
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

# Sync .claude/commands/ (Claude Code slash commands)
echo "🤖 Syncing .claude/commands/..."
mkdir -p $INSTANCE_DIR/.claude/commands
rsync -av \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/.claude/commands/ $INSTANCE_DIR/.claude/commands/

# Sync connector base classes (NOT business connectors)
echo "🔌 Syncing connector base classes..."
cp $FRAMEWORK_DIR/connectors/MCPAdapter.js $INSTANCE_DIR/connectors/ 2>/dev/null || true
cp $FRAMEWORK_DIR/connectors/APIClient.js $INSTANCE_DIR/connectors/ 2>/dev/null || true

# Sync viz/ html templates (but not instance-specific visualizations)
# Only copies generic templates — company profiles and instance vizzes stay local
echo "📊 Syncing viz/ templates..."
mkdir -p $INSTANCE_DIR/viz
for f in $FRAMEWORK_DIR/viz/*.html; do
  [ -e "$f" ] || continue
  basename=$(basename "$f")
  # Skip instance-specific vizzes (company profiles, etc.)
  case "$basename" in company-profile-*|five-elms-*|sales-pipeline*) continue ;; esac
  cp "$f" $INSTANCE_DIR/viz/
done

# Sync templates/ (project templates, etc.)
echo "📦 Syncing templates/..."
mkdir -p $INSTANCE_DIR/templates
rsync -av --delete \
  --exclude '.DS_Store' \
  $FRAMEWORK_DIR/templates/ $INSTANCE_DIR/templates/

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
echo "   - app/src/components/tools/ (instance components)"
echo "   - app/src/components/crm/ (instance components)"
echo "   - app/src/components/index/ (localbase-index components)"
echo ""
echo "📦 TEMPLATES (synced, copy to use):"
echo "   - templates/projects/task-agent → cp to projects/my-agent"
echo ""
echo "📋 Next steps:"
echo "   1. npm install (if package.json changed)"
echo "   2. git status to review changes"
