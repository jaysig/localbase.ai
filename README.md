# LocalBase

**Local-first analytics workspace for your business**

Query your business data with AI. Your data stays on your machine - no cloud dashboards, no SaaS subscriptions.

## How It Works

LocalBase runs a local web server on your machine. Your data lives in SQLite databases on your hard drive. When you open `http://localhost:5173`, you're connecting to a server running on your own computer - not a cloud service.

This means:
- Your databases stay on your machine
- No SaaS accounts or monthly fees
- No third-party analytics platforms seeing your data
- You own everything

**Note:** When you use AI features (Chat, Claude Code), the data you query gets sent to Claude. Claude sees whatever you ask about - not your entire database, but the specific data in your prompts and results.

## Quick Start

```bash
git clone https://github.com/rriggin/localbase.ai.git
cd localbase.ai
npm install
npm run dev
```

Open http://localhost:5173

## Data Setup

The `data/` folder contains your SQLite databases. It's gitignored (not included in the repo) because it holds your actual business data.

To set up:
1. Copy `env.local.example` to `env.local` and add your API credentials
2. Run a connector to sync data: `node connectors/example/sync.js`
3. Or ask Claude: "Help me create a connector for [service name]"

## The Dashboard

The web UI gives you:

- **Chat** - Ask questions about your data in natural language
- **Visualizations** - Browse and interact with charts
- **Settings** - See connected data sources and sync status

The chat can create visualizations on the fly. Ask "show me a chart of monthly revenue" and it generates an interactive chart.

## Using with Claude Code

You can also work from the terminal:

```bash
claude   # Start Claude Code in your LocalBase directory
```

Then ask:
- "Show me revenue for Q4"
- "Create a chart of deals by stage"
- "Sync my data"

Both the web chat and terminal query the same local databases.

## Creating Visualizations

Ask Claude to create a visualization and it will:
1. Create a standalone HTML file in `viz/`
2. Register it in `viz/visualizations.json`
3. Use ApexCharts for interactive charts

Visualizations are self-contained HTML files that query your local databases via the Express API.

## Adding Connectors

Connectors sync data from external APIs into local SQLite databases.

```bash
cp -R connectors/example connectors/mydata
# Edit connectors/mydata/index.js
node connectors/mydata/sync.js
```

Or ask Claude: "Help me create a connector for [service name]"

## Project Structure

```
localbase.ai/
├── app/             # Browser UI (Vite + React)
├── connectors/      # Data source connectors
├── tools/           # Express API + MCP server
├── scripts/         # Utility scripts
├── viz/             # Visualization HTML files
├── test/            # Test suite
└── data/            # SQLite databases (gitignored)
```

## Development

```bash
npm run dev          # Start dev server (API + UI)
npm test             # Run test suite (40 tests)
npm start            # Start API server only
```

## Stack

- **Node.js 18+** - Runtime
- **SQLite** - Local database (better-sqlite3)
- **Express** - API server
- **Vite + React** - Dashboard UI
- **ApexCharts** - Visualizations
- **MCP** - Claude integration protocol

## Requirements

- Node.js 18+
- Claude Code or Claude Desktop (for AI features)
