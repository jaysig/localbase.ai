# LocalBase

> **Local-first analytics framework for small businesses**

LocalBase is a framework for building custom analytics dashboards that run entirely on your local machine. Combine your business data from multiple sources (QuickBooks, HubSpot, Google Ads, etc.) and query it using AI.

## Quick Start

### 1. Fork this repository

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/my-business-analytics.git
cd my-business-analytics
npm install

# Add upstream to pull framework updates
git remote add upstream https://github.com/ORIGINAL_OWNER/localbase.ai.git
```

**Pulling Framework Updates:**
```bash
# Get latest framework improvements
git fetch upstream
git merge upstream/main

# Resolve any conflicts (usually in connectors/ or data/ - keep your changes)
npm install  # Update dependencies if package.json changed
```

### 2. Start the servers

**Browser Mode (Web Dashboard):**
```bash
npm start           # Web dashboard (http://localhost:3000)
npm run mcp         # MCP server (for Claude Code AI integration)
```

**Desktop App Mode (Electron):**

**IMPORTANT:** In development, you must run the Express server separately:

```bash
# Terminal 1: Start Express server
npm start

# Terminal 2: Start Electron app
cd electron-app
npm install
npm run electron:dev
```

**Why?** Electron uses Node v18 (MODULE_VERSION 121) while better-sqlite3 is compiled for your system's Node version. Running the server separately allows better-sqlite3 to use the system Node version, avoiding native module version mismatches.

### 3. Build your first connector

See `connectors/example/` for a complete guide on building data connectors.

## What You Get

### 🖥️ Desktop App (Electron)
- **Home** - Beautiful starfield welcome screen
- **Visualizations** - Interactive charts and dashboards
- **Live Workspace** - Split view: terminal + live viz preview
- **Tools** - Extensible plugin system for custom business tools
- **Terminal** - Integrated terminal for running scripts
- **Settings** - Configure data sources and project paths

### 🤖 AI Integration (Claude Code + MCP)
Ask questions in natural language:
- "Show me Q3 revenue trends"
- "Which customers have the highest lifetime value?"
- "Create a chart comparing this year vs last year"

### 📊 Visualization System
- **ApexCharts** - Interactive line/bar/area charts
- **D3.js** - Custom visualizations
- **Chart.js** - Venn diagrams and specialty charts
- **Auto-registration** - Visualizations appear in dashboard automatically

### 🔌 Connector Framework
Build connectors for any data source:
- Extends `BaseConnector` class
- Automatic MCP tool registration
- Local SQLite storage
- Environment-based configuration

## Architecture

```
localbase-template/
├── electron-app/           # Desktop application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.jsx            # Welcome screen
│   │   │   ├── LiveWorkspace.jsx   # Terminal + viz preview
│   │   │   ├── Tools.jsx           # Plugin container
│   │   │   ├── Overview.jsx        # Settings
│   │   │   └── VisualizationViewer.jsx
│   │   ├── hooks/
│   │   │   └── useVimiumShortcuts.js  # Vim-style navigation
│   │   └── App.jsx
│   ├── electron/
│   │   ├── main.js        # Electron main process
│   │   └── preload.js     # IPC bridge
│   ├── build.sh           # Production build
│   └── install.sh         # Install to /Applications
│
├── tools/                  # Framework libraries
│   ├── viz/               # Visualization factory
│   ├── mcp/               # Claude Code integration
│   ├── server/            # Express.js backend
│   └── ocr/               # OCR text extraction
│
├── connectors/            # Data connectors
│   ├── base.js           # BaseConnector framework
│   ├── example/          # Example connector template
│   └── sync.md           # Connector documentation
│
├── app/                   # Web dashboard
│   ├── viz/              # Generated visualizations
│   ├── assets/           # Static resources
│   └── index.html        # Main dashboard
│
├── data/                  # Local SQLite databases
│   └── localbase_schema.json  # Schema documentation
│
└── env.local             # Environment variables (create this)
```

## Customizing for Your Business

### 1. Create connectors for your data sources

```bash
# Copy the example connector
cp -R connectors/example connectors/quickbooks
```

Edit `connectors/quickbooks/index.js`:
- Extend `BaseConnector`
- Define MCP tools
- Implement data fetching
- Store in local SQLite database

See `connectors/example/README.md` for complete guide.

### 2. Add environment variables

Create `env.local` in project root:

```bash
# QuickBooks
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret

# Other services
HUBSPOT_API_KEY=your_api_key
GOOGLE_ADS_DEVELOPER_TOKEN=your_token
```

### 3. Build custom tools (plugins)

Tools are React components that appear in the Tools tab:

```javascript
// electron-app/src/components/tools/SalesAnalyzer.jsx
export default function SalesAnalyzer() {
  // Your custom business logic
  return <div>Custom sales analysis tool</div>
}
```

Register in `electron-app/src/components/Tools.jsx`:

```javascript
const tools = [
  {
    id: 'salesanalyzer',
    name: 'Sales Analyzer',
    description: 'Analyze sales performance',
    icon: TrendingUp,
    component: SalesAnalyzer
  }
]
```

### 4. Update branding

Edit `electron-app/package.json`:

```json
{
  "name": "my-business-analytics",
  "productName": "MyBusiness Analytics",
  "description": "Analytics dashboard for MyBusiness Inc"
}
```

Edit `electron-app/src/components/Home.jsx`:
- Change app name
- Update welcome message
- Customize colors

## Desktop App Development

```bash
cd electron-app
npm install
npm run electron:dev    # Start dev mode (Vite + Electron)
```

### Production Build

```bash
cd electron-app
./build.sh              # Build production app
./install.sh            # Install to /Applications
```

Or combined:

```bash
npm run prod:install    # Build + install in one step
```

### Syncing Electron App to Workspaces

The LocalBase framework maintains the canonical `electron-app/` code. To push updates to your workspaces:

```bash
# From framework directory (localbase.ai)
./sync-electron.sh
```

This will:
1. Auto-detect all LocalBase workspaces in `~/Work/`
2. Copy `electron-app/` to each workspace
3. Exclude build artifacts (node_modules, dist, etc)

After syncing, rebuild the app in each workspace:

```bash
# In each workspace
cd electron-app
npm install              # If package.json changed
npm run prod:install    # Build + install
```

**Development Workflow:**
1. Make changes in framework's `electron-app/`
2. Run `./sync-electron.sh` to push to workspaces
3. Test in each workspace
4. Commit changes to framework repo

**What Gets Synced:**
- ✅ Source code (src/, electron/)
- ✅ Config files (package.json, vite.config.js)
- ✅ Build scripts (build.sh, install.sh)
- ❌ node_modules (excluded)
- ❌ dist/ (excluded)
- ❌ build outputs (excluded)

**Note:** Workspaces should **not** commit their `electron-app/` directories since they're generated from the framework.

## Features

### Vimium Keyboard Shortcuts
- `j/k` - Scroll down/up
- `gg` - Scroll to top
- `G` - Scroll to bottom
- `f` - Link hints (click with keyboard)
- `F` - Link hints (open in new tab)
- `d/u` - Scroll half page

### Live Workspace
Split terminal + visualization preview:
- Run scripts in terminal
- Visualizations appear automatically
- Auto-refresh every 2 seconds
- Toggle horizontal/vertical split

### Visualization Auto-Detection
Generate charts and they automatically appear in the dashboard:

```javascript
const { generateMultilineChart } = require('./tools/generate-multiline-chart.js')

await generateMultilineChart({
  title: 'Revenue Trends',
  data: monthlyRevenue,
  // ... chart config
})
```

Chart appears in:
1. Web dashboard
2. Live Workspace preview
3. Visualizations tab

## Real-World Use Cases

LocalBase can power analytics for:
- Service businesses (QuickBooks, CRM, scheduling tools)
- SaaS companies (HubSpot, Mixpanel, analytics platforms)
- E-commerce (Shopify, Stripe, Google Analytics)

## MCP Tools

Once connectors are built, query with AI:

```
You: "Show me total revenue for Q4"
Claude: Querying quickbooks_get_revenue...
[Returns formatted data]

You: "Create a chart comparing this year vs last"
Claude: Generating visualization...
[Creates chart, opens in dashboard]
```

## Web Server

```bash
npm start               # Start Express server (port 3000)
```

Access:
- Dashboard: http://localhost:3000
- Health: http://localhost:3000/health
- API: http://localhost:3000/api/viz

## Database Schema

LocalBase uses SQLite for all data storage:

```sql
-- Example schema (customize for your business)
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  amount DECIMAL(10,2),
  date DATE,
  status TEXT
);
```

Store databases in `data/[source]/` directories.

## Dependencies

**Core:**
- Node.js 18+
- SQLite 3
- Electron 29+

**Key packages:**
- `better-sqlite3` - Database operations
- `express` - Web server
- `dotenv` - Environment config
- `react` - UI framework
- `apexcharts` - Charting library

## Project Structure Best Practices

1. **Flat is better than nested** - Avoid deep directory structures
2. **One connector per data source** - Keep connectors focused
3. **Use BaseConnector pattern** - Ensures MCP integration works
4. **Store everything locally** - No cloud dependencies
5. **Environment variables for secrets** - Never commit credentials
6. **Auto-register visualizations** - Use the viz factory pattern

## Getting Help

- **Connector Guide**: See `connectors/example/README.md`
- **BaseConnector API**: See `connectors/base.js`
- **Chart Templates**: See `tools/templates/`
- **Electron App**: See `electron-app/README.md`

## Next Steps

1. **Create connectors** for your data sources
2. **Build custom tools** for your business workflows
3. **Generate visualizations** for key metrics
4. **Deploy** - Build desktop app and install locally
5. **Iterate** - Add more connectors and tools as needed

---

## Template vs Instance

This is the **template** - a clean starting point.

To create a business instance:
1. Clone this template
2. Add your business connectors
3. Customize branding
4. Build custom tools
5. Deploy to your team

**Don't edit the template directly** - clone it for each new business.

---

*LocalBase: Your data, your machine, your insights.*
