#!/bin/bash
# LocalBase Instance Bootstrap Script
# Creates a new LocalBase instance workspace

set -e

FRAMEWORK_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 LocalBase Instance Bootstrap${NC}"
echo ""

# Get instance name
if [ -z "$1" ]; then
  echo "Usage: ./bootstrap-instance.sh <instance-name>"
  echo ""
  echo "Example: ./bootstrap-instance.sh my-company"
  exit 1
fi

INSTANCE_NAME=$1
INSTANCE_DIR=~/Work/$INSTANCE_NAME

# Check if instance already exists
if [ -d "$INSTANCE_DIR" ]; then
  echo -e "${YELLOW}⚠️  Instance directory already exists: $INSTANCE_DIR${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo -e "${GREEN}Creating new instance: $INSTANCE_NAME${NC}"
  mkdir -p "$INSTANCE_DIR"
fi

cd "$INSTANCE_DIR"

# 1. Initialize git
echo -e "${BLUE}📦 Initializing git...${NC}"
if [ ! -d ".git" ]; then
  git init
  echo "✓ Git initialized"
else
  echo "✓ Git already initialized"
fi

# 2. Create instance-specific directories
echo -e "${BLUE}📁 Creating directory structure...${NC}"
mkdir -p connectors
mkdir -p data
mkdir -p projects
mkdir -p .logs
echo "✓ Created: connectors/, data/, projects/, .logs/"

# 3. Copy framework code
echo -e "${BLUE}🔧 Copying framework code...${NC}"

# Copy tools
rsync -av --exclude 'node_modules' --exclude '.DS_Store' \
  "$FRAMEWORK_DIR/tools/" "$INSTANCE_DIR/tools/"
echo "✓ Synced: tools/"

# Copy app
rsync -av \
  --exclude 'viz/*.html' \
  --exclude 'assets/visualizations.json' \
  --exclude '.DS_Store' \
  "$FRAMEWORK_DIR/app/" "$INSTANCE_DIR/app/"
echo "✓ Synced: app/"

# Copy electron-app
rsync -av --exclude 'node_modules' --exclude 'dist' --exclude '.DS_Store' \
  "$FRAMEWORK_DIR/electron-app/" "$INSTANCE_DIR/electron-app/"
echo "✓ Synced: electron-app/"

# 4. Create visualizations.json
echo -e "${BLUE}📊 Initializing visualizations registry...${NC}"
cat > app/assets/visualizations.json <<EOF
{
  "visualizations": [],
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "totalVisualizations": 0,
  "totalViews": 0,
  "version": "1.0"
}
EOF
echo "✓ Created: app/assets/visualizations.json"

# 5. Copy package.json from framework
echo -e "${BLUE}📦 Setting up package.json...${NC}"
if [ -f "$FRAMEWORK_DIR/package.json" ]; then
  cp "$FRAMEWORK_DIR/package.json" "$INSTANCE_DIR/package.json"
  # Update name field
  sed -i.bak "s/\"name\": \"localbase\"/\"name\": \"localbase-$INSTANCE_NAME\"/" package.json
  rm package.json.bak
  echo "✓ Created: package.json"
fi

# 6. Copy sync script
echo -e "${BLUE}🔄 Installing sync script...${NC}"
cat > sync-framework.sh <<'EOF'
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
echo "📋 Next steps:"
echo "   1. Test the app: cd electron-app && npm run electron:dev"
echo "   2. Review changes: git status"
echo "   3. Commit instance-specific fixes if needed"
EOF
chmod +x sync-framework.sh
echo "✓ Created: sync-framework.sh"

# 7. Copy start script
if [ -f "$FRAMEWORK_DIR/start.sh" ]; then
  cp "$FRAMEWORK_DIR/start.sh" "$INSTANCE_DIR/start.sh"
  chmod +x start.sh
  echo "✓ Created: start.sh"
fi

# 8. Create env.local template
echo -e "${BLUE}🔐 Creating env.local template...${NC}"
cat > env.local <<EOF
# LocalBase Instance: $INSTANCE_NAME
# Environment Configuration

# Add your API keys and credentials here
# Example:
# HUBSPOT_API_KEY=your_key_here
# QUICKBOOKS_CLIENT_ID=your_client_id
# QUICKBOOKS_CLIENT_SECRET=your_secret
EOF
echo "✓ Created: env.local (template)"

# 9. Create .gitignore
echo -e "${BLUE}📝 Creating .gitignore...${NC}"
cat > .gitignore <<EOF
# Dependencies
node_modules/
package-lock.json

# Environment
env.local
.env

# Data
data/*.db
data/*.sqlite
data/*.sqlite3

# Logs
.logs/
*.log

# Build outputs
electron-app/dist/
electron-app/node_modules/
electron-app/build-resources/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Temporary files
tmp/
*.tmp
EOF
echo "✓ Created: .gitignore"

# 10. Create example connector
echo -e "${BLUE}🔌 Creating example connector...${NC}"
mkdir -p connectors/example
cat > connectors/example/README.md <<EOF
# Example Connector

This is a template for creating new connectors in your LocalBase instance.

## Structure
- \`config.json\` - Connector metadata and configuration
- \`sync.js\` - Data sync script
- \`connector.js\` - MCP tools implementation (optional)

## Getting Started
1. Copy this directory to create a new connector
2. Update config.json with your connector details
3. Implement sync.js to fetch and store data
4. (Optional) Add MCP tools in connector.js for Claude integration
EOF
echo "✓ Created: connectors/example/"

# 11. Create CLAUDE.md
echo -e "${BLUE}📚 Creating CLAUDE.md...${NC}"
cat > CLAUDE.md <<EOF
# Claude Code Instructions - $INSTANCE_NAME

## Instance Overview
This is a LocalBase instance workspace for: **$INSTANCE_NAME**

## Key Directories
- \`connectors/\` - Data source connectors specific to this instance
- \`data/\` - Local SQLite databases
- \`tools/\`, \`app/\`, \`electron-app/\` - Framework code (synced from localbase.ai)
- \`env.local\` - API credentials and environment variables

## Workflow
1. Add connectors in \`connectors/\` directory
2. Store data in \`data/\` SQLite databases
3. Create visualizations in \`app/viz/\`
4. Pull framework updates: \`./sync-framework.sh\`

## Important
- Never commit \`env.local\` or \`data/\` to git
- Framework files are synced, not edited directly
- Instance-specific code stays in this repo
- All visualizations auto-tagged with \`workspace: "$INSTANCE_NAME"\`

## Quick Start
\`\`\`bash
# Install dependencies
npm install

# Start servers
npm start

# Create visualizations (via Claude or MCP tools)
# Visualizations auto-save to app/viz/
\`\`\`
EOF
echo "✓ Created: CLAUDE.md"

# 12. Initial commit
echo -e "${BLUE}💾 Creating initial commit...${NC}"
git add .
git commit -m "Initial commit: Bootstrap LocalBase instance '$INSTANCE_NAME'

Created by bootstrap-instance.sh from localbase.ai framework

Instance structure:
- Framework code: tools/, app/, electron-app/
- Instance-specific: connectors/, data/, env.local
- Auto-workspace tagging: visualizations tagged with workspace: '$INSTANCE_NAME'

🤖 Generated with LocalBase Framework"

echo ""
echo -e "${GREEN}✅ Instance '$INSTANCE_NAME' created successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. cd $INSTANCE_DIR"
echo "2. Edit env.local with your API credentials"
echo "3. npm install"
echo "4. Add connectors in connectors/ directory"
echo "5. npm start (or npm run dev)"
echo ""
echo -e "${BLUE}🔄 Future framework updates:${NC}"
echo "   ./sync-framework.sh"
echo ""
