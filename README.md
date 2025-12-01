# LocalBase

**Local-first analytics workspace for your business**

Query your business data (QuickBooks, HubSpot, etc.) with AI. Everything runs locally on your machine.

## Quick Start

```bash
git clone https://github.com/rriggin/localbase.ai.git
cd localbase.ai
npm install
npm start
```

Open http://localhost:3000

## Ask AI About Your Data

```bash
# In another terminal
npm run mcp  # Start MCP server
claude       # Or any MCP-compatible AI
```

Then ask questions:
- "Show me revenue for Q4"
- "Which customers bought the most?"
- "Create a chart of sales trends"

## How It Works

1. **Connectors** pull data from your tools (APIs, databases, etc.)
2. **SQLite** stores everything locally
3. **MCP** lets AI query your data
4. **Charts** auto-generate and display in the dashboard

## Add Your Data

```bash
# Copy example connector
cp -R connectors/example connectors/mydata

# Add your API credentials
cp env.local.example env.local
# Edit env.local with your API keys
```

Edit `connectors/mydata/index.js` to fetch your data. See `connectors/example/README.md` for details.

## What's Inside

```
localbase.ai/
├── app/             # Browser UI (Vite + React)
├── connectors/      # Your data sources
├── tools/           # Framework (MCP server, charts, etc.)
├── viz/             # Visualization registry
└── data/            # SQLite databases
```

## Stack

- **Node.js** - Runtime
- **SQLite** - Local database
- **MCP** - AI integration
- **Express** - Web server
- **React** - Dashboard UI
- **ApexCharts** - Visualizations

## Requirements

- Node.js 18+
- Claude Desktop (or any MCP-compatible AI)
