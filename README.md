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

### 2. Start the server

```bash
npm start           # Web dashboard (http://localhost:3000)
npm run mcp         # MCP server (for Claude Code AI integration)
```

Access the dashboard at http://localhost:3000

### 3. Build your first connector

See `connectors/example/` for a complete guide on building data connectors.

## What You Get

### 🌐 Web Dashboard
- **Visualizations** - Interactive charts and dashboards
- **Auto-refresh** - New visualizations appear automatically
- **Vim navigation** - Keyboard shortcuts (j/k/h/l)
- **Search & filter** - Find visualizations quickly

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
localbase.ai/
├── tools/                  # Framework libraries
│   ├── viz/               # Visualization generators
│   ├── mcp/               # Claude Code integration
│   ├── server/            # Express.js backend
│   ├── connectors/        # BaseConnector class
│   └── ocr/               # OCR text extraction
│
├── web-app/               # Web dashboard
│   ├── viz/              # Generated visualizations
│   ├── assets/           # Chart libraries, styles
│   └── index.html        # Main dashboard
│
├── connectors/            # Data connectors (your code)
│   ├── base.js           # BaseConnector framework
│   └── example/          # Example connector template
│
├── data/                  # Local SQLite databases
│   └── .gitkeep          # Databases not committed
│
├── scripts/               # Utility scripts
│   ├── sync-framework.sh # Sync framework to instances
│   └── bootstrap-instance.sh
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

### 3. Customize the dashboard

Edit `web-app/index.html`:
- Update page title and branding
- Customize colors and styling
- Add your business logo

## Features

### Vimium Keyboard Shortcuts
- `j/k` - Scroll down/up
- `gg` - Scroll to top
- `G` - Scroll to bottom
- `f` - Link hints (click with keyboard)
- `F` - Link hints (open in new tab)
- `d/u` - Scroll half page

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

Charts automatically appear in the web dashboard and refresh every 30 seconds.

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

**Key packages:**
- `better-sqlite3` - Database operations
- `express` - Web server
- `dotenv` - Environment config
- `apexcharts` - Charting library
- `d3` - Custom visualizations
- `chart.js` - Specialty charts

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

## Next Steps

1. **Create connectors** for your data sources
2. **Generate visualizations** for key metrics
3. **Customize** the dashboard for your business
4. **Integrate with Claude Code** for AI-powered analytics
5. **Iterate** - Add more connectors and visualizations as needed

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
