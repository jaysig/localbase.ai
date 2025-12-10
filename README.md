# LocalBase

**Local-first analytics workspace for your business**

Query your business data (QuickBooks, HubSpot, etc.) with AI. Everything runs locally on your machine.

## Quick Start

```bash
git clone https://github.com/rriggin/localbase.ai.git
cd localbase.ai
npm install
./scripts/start.sh   # Or: npm run dev
```

Open http://localhost:5173

## Using the Web UI

The LocalBase dashboard gives you:

- **Chat** - Ask questions about your data in natural language
- **Visualizations** - Browse and interact with charts you've created
- **Data Sources** - See connected data and record counts

The chat interface can create visualizations on the fly. Ask something like "show me a chart of monthly revenue" and it will generate an interactive visualization.

## Using with Claude Code (Terminal)

You can also work entirely from the terminal with Claude Code:

```bash
claude   # Start Claude Code in your LocalBase directory
```

Then ask:
- "Show me revenue for Q4"
- "Create a visualization of deal pipeline by stage"
- "Sync my HubSpot data"

Both the web UI chat and terminal work the same way - they query your local SQLite databases and can create visualizations.

## Syncing Data

Ask Claude to sync your data:
- "Sync my HubSpot deals"
- "Update G2 analytics"
- "Refresh all connectors"

Or run sync commands directly:
```bash
node connectors/hubspot/sync-deals.js
node connectors/g2-api/sync.js
```

## Creating Visualizations

Ask Claude to create a visualization and it will:
1. Create a standalone HTML file in `viz/` with embedded data queries
2. Register it in `viz/visualizations.json` so it appears in the UI
3. Use ApexCharts for interactive charts with tooltips, zoom, and export

Example prompts:
- "Create a chart showing ad spend vs organic traffic over time"
- "Build a visualization of deal pipeline by stage"
- "Show me monthly revenue trends with a table breakdown"

Visualizations are self-contained HTML files that query your local SQLite databases via the Express API.

## Adding a New Connector

1. Copy the example connector:
```bash
cp -R connectors/example connectors/mydata
```

2. Add your API credentials to `env.local`:
```bash
cp env.local.example env.local
# Edit env.local with your API keys
```

3. Edit `connectors/mydata/index.js` to fetch your data

4. Run your connector:
```bash
node connectors/mydata/index.js
```

Or just ask Claude: "Help me create a connector for [service name]"

See `connectors/example/README.md` for detailed examples.

## What's Inside

```
localbase.ai/
├── app/             # Browser UI (Vite + React)
├── connectors/      # Your data sources
├── tools/           # Framework (MCP server, Express API)
├── scripts/         # Start, sync, security scripts
├── viz/             # Visualization HTML files
└── data/            # SQLite databases (gitignored)
```

## Stack

- **Node.js** - Runtime
- **SQLite** - Local database (better-sqlite3)
- **Express** - Web server + API
- **Vite + React** - Dashboard UI
- **ApexCharts** - Visualizations
- **MCP** - AI integration protocol

## Requirements

- Node.js 18+
- Claude Code or Claude Desktop (for AI features)
