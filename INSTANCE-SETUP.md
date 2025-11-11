# Instance Setup Guide

This document explains how to create and maintain LocalBase instances (business-specific workspaces).

## Architecture Overview

**LocalBase has a 3-tier architecture:**

1. **Framework** (`~/Work/localbase.ai`) - Core codebase
   - `electron-app/` - Desktop application
   - `tools/` - Shared libraries (viz, mcp, server, etc.)
   - `app/` - Web UI framework

2. **Instances** (`~/Work/goskills`, `~/Work/renu`) - Business workspaces
   - Contains framework code (synced via script)
   - Contains instance-specific data and connectors

3. **Installed App** (`/Applications/LocalBase.app`) - Single global app
   - Works with any instance via workspace chooser

## Instance-Specific Files (NEVER SYNC FROM FRAMEWORK)

These files are unique to each instance and should **never** be synced from the framework:

### 🚨 CRITICAL - Instance-Only Files

| File/Directory | Purpose | Example |
|----------------|---------|---------|
| `CLAUDE.md` | Instance-specific context and connector documentation | Renu connectors vs GoSkills connectors |
| `connectors/` | Business-specific data connectors | QuickBooks, HubSpot, G2, etc. |
| `data/` | Business-specific SQLite databases | Customer data, deals, metrics |
| `env.local` | Instance-specific API credentials | Never committed, never shared |
| `app/assets/visualizations.json` | Instance-specific visualization registry | Business dashboards |

### ⚙️ Framework Files (SYNCED FROM FRAMEWORK)

| File/Directory | Purpose | Sync Method |
|----------------|---------|-------------|
| `electron-app/` | Desktop app code | `./sync-framework.sh` (full replacement) |
| `tools/` | Shared libraries | `./sync-framework.sh` |
| `app/` | Web UI framework | `./sync-framework.sh` (excludes viz/visualizations.json) |

## Creating a New Instance

```bash
# 1. Create instance directory
mkdir ~/Work/my-business
cd ~/Work/my-business

# 2. Copy sync script from framework
cp ~/Work/localbase.ai/sync-framework.sh .

# 3. Run initial sync to get framework code
./sync-framework.sh

# 4. Install dependencies
cd electron-app && npm install && cd ..

# 5. Create instance-specific files
touch env.local
mkdir -p connectors data

# 6. Create CLAUDE.md with instance-specific context
cat > CLAUDE.md << 'EOF'
# Claude Code Instructions - MY BUSINESS

## Current Data Status
Last Synced: [DATE]

| Connector | Data Type | Status | Notes |
|-----------|-----------|--------|-------|
| **[Connector]** | [Type] | 🔄 Available | [Notes] |

## Sync Process
```bash
node connectors/nightly-sync.js
```
EOF

# 7. Initialize git
git init
git add .
git commit -m "Initial instance setup"
```

## Syncing Framework Updates

When the framework is updated:

```bash
cd ~/Work/my-business
./sync-framework.sh
```

**What gets updated:**
- ✅ `electron-app/` - Full replacement
- ✅ `tools/` - Framework libraries
- ✅ `app/` - UI framework (preserves visualizations)

**What stays untouched:**
- ✅ `CLAUDE.md` - Your instance context
- ✅ `connectors/` - Your business connectors
- ✅ `data/` - Your databases
- ✅ `env.local` - Your credentials

## Common Mistakes to Avoid

### ❌ DON'T: Copy CLAUDE.md from framework to instances
The framework CLAUDE.md should only contain framework-level instructions, not instance-specific data.

### ❌ DON'T: Commit instance data to framework
Never commit business-specific connectors, data, or credentials to the framework repo.

### ❌ DON'T: Manually edit electron-app/ in instances
Always sync from framework. Local changes will be overwritten on next sync.

### ✅ DO: Keep instance CLAUDE.md updated
Document your connectors, sync process, and business-specific context.

### ✅ DO: Use env.local for credentials
Never commit API keys, tokens, or passwords.

### ✅ DO: Sync framework regularly
Pull updates from framework to get bug fixes and new features.

## Workspace Switching

The LocalBase app can work with multiple instances:

1. Open LocalBase from `/Applications/`
2. Use workspace chooser to select instance
3. App operates on that instance's data/connectors

The app stores the workspace path in its config and remembers your last selection.

## GitIgnore Patterns

**Framework `.gitignore`:**
```
node_modules/
dist/
env.local
data/**/*.db
```

**Instance `.gitignore`:**
```
node_modules/
dist/
env.local
data/**/*.db
electron-app/      # Generated from framework
```

## Questions?

See:
- Framework README: `~/Work/localbase.ai/README.md`
- Sync script: `./sync-framework.sh` (has helpful output)
- Instance CLAUDE.md files for examples
