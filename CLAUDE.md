# Claude Code Instructions

## 📋 Framework Context (Updated: 2025-10-21)

⚠️ **IMPORTANT:** This is the LocalBase.ai FRAMEWORK repository.
- For instance-specific context (connectors, data, sync process), see the instance's CLAUDE.md
- Instances: `~/Work/goskills/CLAUDE.md`, `~/Work/renu/CLAUDE.md`
- Instance setup guide: See `INSTANCE-SETUP.md`

### Recent Framework Updates (Oct 24, 2025)

**Build System:**
1. ✅ **Electron Build Working** - Production builds now work cleanly
   - Native modules (better-sqlite3, node-pty) rebuild automatically via electron-builder
   - DMG generation succeeds without errors on macOS 25.0.0
   - Command: `cd electron-app && npm run electron:build`
   - Output: `dist/electron/LocalBase-1.0.0-arm64.dmg` (~104MB)

### Framework Updates (Oct 21, 2025)

**Keyboard Navigation Improvements:**
1. ✅ **Terminal Keyboard Fix** - Fixed 'f' key blocking in Terminal/Live Workspace
   - Removed unconditional 'f' key blocking from vim hints integration
   - Now only blocks keys when vim hints are actually active
   - Allows normal typing in terminal while maintaining vim hints functionality
   - Location: `electron-app/src/components/Terminal.jsx`

**Instance-Specific File Protection:**
2. ✅ **CLAUDE.md Separation** - Framework vs Instance context split
   - Framework CLAUDE.md: Architecture, patterns, framework-level instructions
   - Instance CLAUDE.md: Business connectors, sync process, data status
   - See `INSTANCE-SETUP.md` for complete documentation
   - Updated `sync-framework.sh` to warn about instance-specific files

### Recent Changes & Fixes (Oct 20, 2025)

**Framework Updates (localbase.ai):**
1. ✅ **Dynamic Connector Loading** - App now scans workspace `connectors/` directory automatically
   - No more hardcoded connector lists
   - Shows correct connectors per workspace (GoSkills vs Renu)
   - Location: `electron-app/electron/main.js` + `Overview.jsx`

2. ✅ **Terminal Duplicate Output Fix** - Fixed zombie event handlers
   - Added `isMounted` flag to prevent stale callbacks
   - Terminal output now clean (no repeated "Thinking..." messages)
   - Location: `electron-app/src/components/Terminal.jsx`

3. ✅ **Visualization CSP Fix** - Allowed inline scripts for charts
   - Added `'unsafe-inline'` to production Content Security Policy
   - Charts now render properly in embedded views
   - Location: `electron-app/electron/main.js`

4. ✅ **BaseConnector Framework** - Restored full connector base class
   - 272 lines with HTTP methods, auth, rate limiting
   - Location: `tools/connectors/BaseConnector.js`

**Environment & Credentials:**
1. ✅ All sync scripts now properly load credentials from `env.local`
2. ✅ Instance-specific files protected from framework sync

### Known Issues

1. **Sync Button in Settings** - Currently hardcoded path
   - Needs unified sync script or per-connector controls
   - Status: Manual sync via terminal recommended for now

### Active Development

**Current Branch:** `main`
**Last Framework Sync:** October 20, 2025
**DevOps Setup:** ✅ Complete (see ~/Work/DEVOPS-WORKFLOW.md)

**Framework Development:**
```bash
# Work in framework repo
cd ~/Work/localbase.ai

# Make changes to electron-app/, tools/, app/

# Push framework updates to instances
cd ~/Work/goskills && ./sync-framework.sh
cd ~/Work/renu && ./sync-framework.sh
```

**Instance Data Syncs:**
See instance-specific CLAUDE.md files for sync commands.

### Architecture Decisions

1. **Multi-instance model** - One framework (localbase.ai), multiple business instances
2. **GitIgnore electron-app/** - Generated from framework, not tracked in instances
3. **env.local for credentials** - Never committed, instance-specific
4. **MCP auto-starts** - Runs in Electron process for Claude Desktop CLI integration
5. **Express separate** - Runs in separate Node.js process from Electron for clean service separation
   - Electron uses `better-sqlite3@^12.4.1` (rebuilt for Electron runtime)
   - Express uses `better-sqlite3@^12.2.0` (runs in standard Node.js)
   - Both can run simultaneously without conflicts

---

## Multi-Instance Development Workflow

LocalBase.ai is the **core framework**. Renu and GoSkills are **instances** (separate repos with their own connectors).

**Directory Structure:**
```
~/Work/
├── localbase.ai/     # Core framework (this repo)
├── renu/             # Renu instance (full framework + renu connectors)
└── goskills/         # GoSkills instance (full framework + goskills connectors)
```

**What stays in instances:**
- `connectors/` - Business-specific data connectors
- `data/` - Business-specific databases
- `env.local` - Business-specific credentials

**What goes in core (localbase.ai):**
- `tools/` - Framework libraries (viz, mcp, server, ocr, surge)
- `web-app/` - Web dashboard UI
- `electron-app/` - Desktop app
- `connectors/base.js` and `connectors/example/` - Connector framework

### Feature Branch Workflow

**ALWAYS use feature branches for framework development:**

```bash
# 1️⃣ Create feature branch in framework
cd ~/Work/localbase.ai
git checkout -b feature/your-feature-name

# 2️⃣ Develop & commit to feature branch
# Make changes to electron-app/, tools/, app/
git add .
git commit -m "Add feature: description"
git push origin feature/your-feature-name

# 3️⃣ Test with real data (sync to instance)
cd ~/Work/goskills
./sync-framework.sh
cd electron-app && npm run electron:dev

# 4️⃣ Merge to main when ready
cd ~/Work/localbase.ai
git checkout main
git merge feature/your-feature-name
git push origin main

# 5️⃣ Sync to all instances
cd ~/Work/goskills && ./sync-framework.sh
cd ~/Work/renu && ./sync-framework.sh
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation

**Why build from instances:**
- Framework = code only (no business data)
- Instances = framework code + connectors + data + credentials
- Production builds need real data, so always build from instance directory

## Electron App Features

The Electron desktop app provides a complete IDE experience for analytics work:

**Auto-Starting Services:**
- MCP server starts automatically when the app launches (for Claude integration)
- Express server runs separately (`npm start`) for clean service separation
- Server status is visible in Settings tab with live health checks

**Embedded Terminal + Claude Workflow:**
1. Open LocalBase Electron app
2. Terminal tab → full bash/zsh terminal in project root
3. Run `claude` (Claude Desktop CLI)
4. Claude auto-connects to MCP server (already running)
5. Ask Claude to create visualizations
6. Switch to Visualizations tab → auto-refreshes every 3 seconds to show new viz

**Visualizations Tab:**
- Auto-refreshes every 3 seconds to detect new visualizations
- Embedded view of charts (no external browser needed)
- Grid view with thumbnails

**Settings/Overview Tab:**
- Live server status for Express and MCP servers
- Connector health and sync status
- Quick stats (connectors, data sources, visualizations)

## Data Sources
All connectors are unified Node.js implementations extending `BaseConnector`:

- **Gmail**: `data/roofr/appointments.db` - Appointment confirmation emails from Roofr
- **Roofr**: `data/roofr/roofr_proposals.db` - Proposal management (sent/signed tracking)
- **RoofMaxx**: `data/roofmaxx_deals/roofmaxx_deals.db` - Deal pipeline and CRM data
- **QuickBooks**: `data/quickbooks/quickbooks.db` - Financial transactions and customer data
- **Zapier**: Webhook integrations for real-time data flow

Each connector provides MCP tools for Claude Code integration and stores data in local SQLite databases.

## Channel Groupings
2. **Lead Source Attribution**
   - **Library**: `tools/channel-groupings.js` - Reusable channel grouping utilities
   - **Direct Channels**: micro, GRML, direct bud roofing lead, SG, DDSM
   - **Third Party Channels**: All other channels (NAP, NAP-L, NAP-S, etc.)
   - **Database**: `customer_relationships` table in `localbase.db`
     - `source_system`: roofmaxx, roofr, quickbooks, dispatch
     - `lead_channel`: Detailed attribution (primarily RoofMaxx data)
   - **Functions**: `getChannelGroup()`, `aggregateByChannelGroup()`, `calculateGroupPercentages()`
   - Use this library for consistent channel categorization across all visualizations

## Common Commands

## Chart System
3. **Standard Multiline Chart Pattern**: Use the proven business metrics visualization pattern
   - Generator: `const { generateMultilineChart } = require('./tools/generate-multiline-chart.js')`
   - Template: `tools/templates/multiline-chart-template.html` (based on successful business metrics chart)
   - Features: Interactive legend, date filters, day/week/month aggregation, dual Y-axis support
   - Auto-registers in `web-app/assets/visualizations.json` with unique IDs
   - **INSTANT GENERATION**: One function call creates complete, fully-featured chart
   - **REPLACES**: Old VizFactory complexity - this is now the standard method

## Chart Display Behavior
4. **Auto-Embedded Visualizations**: All newly generated visualizations load embedded in the main dashboard
   - **NO IFRAMES**: All visualizations must render directly in-page, never use iframe elements
   - Visualizations display in inline embedded view with navigation tabs, NOT as standalone pages
   - Auto-detection triggers within 30 seconds of visualization generation
   - Tab is automatically created with visualization name (e.g., "✨ long-term-deals-trends")
   - Users can click visualization cards to load them embedded or close embedded view with × button
   - **IMPORTANT**: When viewing embedded visualization via tab click, hide the entire visualization grid and show only the new visualization (focused view)
   - Visualization URLs use `/web-app/viz/` path structure

## Server Management
5. **Simple server operation**
   - `npm start` - Start Express web server (port 3000)
   - `npm run mcp` - Start MCP server (stdio for Claude Code)
   - `npm run dev` - Development server with auto-restart
   - Web server serves from web-app/ directory with Express.js backend

## Architecture
6. **LocalBase Structure**
   - `tools/` - Framework libraries (viz, mcp, server, ocr, surge)
   - `connectors/` - Unified Node.js data connectors (gmail, roofr, roofmaxx, quickbooks)
   - `web-app/` - Web visualization dashboard (viz, assets, index.html)
   - `data/` - Local SQLite databases
   - Each connector extends `BaseConnector` and provides MCP tools

## Development Guidelines
11. **Code & File Management**
   - **NEVER write any code or create new files without confirming with the user first**
   - **ALWAYS check existing tools, connectors, CLAUDE.md to see if what the user is asking for in natural language has been built into our connectors, or has been solved for with a tool in tools/**
   - **Flat is better than nested** - avoid deep directory structures
   - Check before creating - the user may already have what they need
   - Use the VizFactory for complex dashboards, but simple charts may require direct HTML approach

## Connector Framework
12. **BaseConnector Pattern** (ALL connectors must follow)
   - **Extends BaseConnector**: `import { BaseConnector } from '../base.js'`
   - **Constructor**: Call `super(connectorName)` to initialize
   - **Required Methods**: `getTools()`, `canHandleTool()`, `handleTool()`
   - **Error Handling**: Use `this.formatError(error)` and `this.formatResponse(data)`
   - **Database**: Use `better-sqlite3` for all SQLite operations
   - **Environment**: Load config from `env.local` using dotenv
   - **MCP Integration**: Tools auto-register with MCP server for Claude Code

## Script Organization
13. **Script Placement Rules** (NO EXCEPTIONS)
   - **Connector scripts** → `connectors/{source}/` (e.g., `connectors/roofmaxx/update.js`)
   - **Temporary scripts** → `/tmp/` ALWAYS (keep this folder clean!)
   - **Experimental projects** → `/projects/` (see `projects/projects.json` for current projects)
   - **NO /scripts directory** - removed entirely for cleaner architecture
   - Each connector owns its update/analysis scripts
   - If script doesn't belong to a connector: `/tmp` for throwaway, `/projects` for keeper

## Pre-Commit Cleanup Process
14. **Before Every Git Commit**
   1. **Clean /tmp folder** - Remove or relocate temporary files
   2. **Audit script placement** - Move any misplaced scripts to correct locations
   3. **Find homes for orphaned scripts** - Assign to connector or justify placement
   - This keeps the codebase organized and prevents script sprawl

## Markdown Formatting Standards
15. **Table Formatting**: All markdown tables must use proper column alignment
   - Use consistent spacing to align columns vertically
   - Calculate appropriate column widths based on content length
   - Never use bold formatting (**text**) within table cells
   - Format example:
   ```
   | Company Name              | Contact Name          | Email                        |
   |---------------------------|-----------------------|------------------------------|
   | Company A                 | John Smith            | john.smith@companya.com      |
   | Company B                 | Jane Doe              | jane.doe@companyb.com        |
   ```
   - This ensures tables are readable in both raw markdown and rendered views

## Stacked Bar Chart Visualizations
16. **Stacked Bar Chart Pattern**: Exact process for creating professional stacked bar charts
   - **Data Structure**: Array of objects with `name`, `events` array, and metadata
   - **Event Categorization**: Group events into 4-5 color-coded categories with semantic meaning
   - **Custom Legend**: Create 5-column grid layout, one column per category, showing individual events
   - **Color Mapping**: Map each individual event to its category color using consistent color scheme
   - **Y-Axis Labels**: Include metadata in brackets format: "Entity Name [Type]"
   - **Chart Sizing**: Use 1500px height for readability, maxWidth: 400 for y-axis labels
   - **Series Generation**: Create one series per individual event, but color by category
   - **Legend Format**: `● Event Name` with category color, no category labels (obvious grouping)
   - **Stats Summary**: Calculate totals by event type and show top 5 events
   - **File Location**: Save to `/web-app/viz/` with descriptive filename
   - **ApexCharts Config**: horizontal bar, stacked: true, 1500px height, custom legend disabled
   - **CRITICAL**: ALWAYS register in `/web-app/assets/visualizations.json` with unique ID, filename, title, type: "chart", library: "apexcharts", URL, size, and timestamps

## Table Visualizations
17. **Simple Table Viz**: When user asks for a table visualization
   - Generate a simple HTML table visualization (no D3 or chart libraries needed)
   - Tables should have `type: "table"` in the visualization registry
   - Support CSV, markdown, or other tabular data formats
   - Create a 'table' pill filter in the navigation for table visualizations
   - Use clean, responsive HTML table styling

## Chart Creation Patterns
18. **Simple Chart Pattern** (Alternative to VizFactory for basic charts)
   - **When to use**: Single charts with custom filters, grouped columns, revenue data
   - **Approach**: Direct HTML + ApexCharts + database query script
   - **Benefits**: Full control, custom interactions, no VizFactory routing complexity
   - **Registry**: Manually add to `web-app/assets/visualizations.json` with proper metadata
   - **Template**: Dark theme styling, proper chart dimensions (600px height), responsive design

19. **VizFactory vs Simple Chart Decision Matrix**
   - **Use VizFactory**: Complex dashboards, multiple charts, standard patterns
   - **Use Simple Chart**: Custom filters, business-specific styling, pipeline analysis
   - **Hybrid Approach**: VizFactory for initial generation, manual refinement for customization

## Venn Diagram Creation Process
20. **Chart.js Venn Diagrams** - Complete step-by-step process for creating working Venn diagrams

   **Prerequisites:**
   - Install chartjs-chart-venn package: `npm install chartjs-chart-venn`
   - Copy plugin to assets: `cp node_modules/chartjs-chart-venn/build/index.umd.js web-app/assets/chartjs-chart-venn.js`
   - Add to main dashboard: `<script src="/assets/chartjs-chart-venn.js"></script>`

   **Data Structure (Critical):**
   ```javascript
   // Create proper overlap data structure
   const datasetA = [];
   for (let i = 0; i < 45; i++) datasetA.push(`a-only-${i}`);
   for (let i = 0; i < 69; i++) datasetA.push(`shared-${i}`);

   const datasetB = [];
   for (let i = 0; i < 12; i++) datasetB.push(`b-only-${i}`);
   for (let i = 0; i < 69; i++) datasetB.push(`shared-${i}`); // Same shared IDs

   const rawData = [
     { label: 'Dataset A', values: datasetA },
     { label: 'Dataset B', values: datasetB }
   ];
   ```

   **Chart Creation:**
   ```javascript
   const data = ChartVenn.extractSets(rawData, { label: 'Items' });
   const chart = new Chart(ctx, {
     type: 'venn', // NOT 'vennDiagram'
     data: data,
     options: { responsive: false }
   });
   ```

   **Embedding Integration:**
   - Dashboard embedding checks for `typeof ChartVenn !== 'undefined'`
   - Passes `window.ChartVenn` parameter to embedded script wrapper
   - Shows `hasVenn: true` when plugin loads correctly

   **Common Issues & Solutions:**
   - **"vennDiagram is not registered"**: Use `type: 'venn'`, not `type: 'vennDiagram'`
   - **Wrong overlap numbers**: Ensure shared array elements have identical IDs
   - **Plugin not loading**: Check `typeof ChartVenn !== 'undefined'` and console for `hasVenn: true`
   - **Zero dimensions**: Add explicit canvas dimensions and container padding

- Always check claude.md for reference before executing tasks.
- Always store log files in .logs and not logs
- Current session task list, progress and notes always in ~/notes.md
-
