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

Open http://localhost:3000 - you'll see a setup guide with instructions to create your first workspace.

## Ask AI About Your Data

```bash
# In another terminal
npm run mcp  # Start MCP server
claude       # Or any local AI with MCP support
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
cp -R connectors/example connectors/quickbooks

# Add your API credentials
cp env.local.example env.local
# Edit env.local with your API keys
```

Edit `connectors/quickbooks/index.js` to fetch your data.

See `connectors/example/README.md` for details.

## Desktop App (Optional)

Build and run the Electron desktop app for an IDE-like experience with embedded terminal and Claude integration:

```bash
cd electron-app
npm install
npm run electron:dev      # Development mode
npm run electron:build    # Production build (macOS, Linux)
```

The desktop app includes:
- Embedded terminal with full shell access
- Auto-starting MCP server for Claude integration
- Live visualization updates (refreshes every 3 seconds)
- Server health monitoring

## What's Inside

```
localbase.ai/
├── tools/           # Framework (MCP server, charts, etc.)
├── connectors/      # Your data sources (start with examples)
├── data/           # SQLite databases
├── web-app/        # Dashboard
└── electron-app/   # Desktop application
```

## Stack

- **Node.js** - Runtime
- **SQLite** - Local database
- **MCP** - AI integration
- **Express** - Web server
- **Electron** - Desktop app (optional)
- **ApexCharts** - Visualizations

## Requirements

- Node.js 18+
- Claude Desktop (or any MCP-compatible AI)

## Security

Run security check before commits:
```bash
./scripts/security-check.sh
```

Automatically checks for:
- Secrets and API keys
- Personal information
- Database files
- Environment variables

---
