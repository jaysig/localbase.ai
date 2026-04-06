# LocalBase

> **🚧 Work in Progress** - This project is under active development. APIs and features may change. Contributions welcome!

> **⚠️ Security Notice:** LocalBase is designed for **local/trusted network use only**. The server has no authentication - anyone with network access can read and modify your data. **Do not expose to the public internet** without adding authentication. See [Security](#security) below.

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

## Getting Started

### Step 1: Create a GitHub Account

If you don't have one already, sign up at [github.com](https://github.com). This is where the code lives.

### Step 2: Open Terminal

On Mac, press `Cmd + Space`, type "Terminal", and hit Enter. You'll see a window with a blinking cursor - this is where you'll type commands.

Don't worry, you can't break anything. If something goes wrong, just close the window and open a new one.

### Step 3: Get Comfortable with Basic Commands

Try these to get a feel for it:

- `ls` - Lists files in the current folder
- `cd Documents` - Moves into the Documents folder
- `cd ..` - Moves back up one folder
- `pwd` - Shows where you are

That's it. You now know enough terminal to continue.

### Step 4: Install the Tools

Copy and paste these one at a time. Each one installs something you'll need:

**Install Homebrew** (a tool that installs other tools):
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Install GitHub CLI:**
```
brew install gh
```

**Install Node.js:**
```
brew install node
```

**Install Claude Code:**

Visit [claude.ai/code](https://claude.ai/code) and follow the instructions.

### Step 5: Log into GitHub

Run this command:
```
gh auth login
```

It will ask you some questions - just follow the prompts. It opens your browser to complete the login.

### Step 6: Download LocalBase

Now you can grab the code:
```
gh repo clone localbase-ai/localbase.ai
cd localbase.ai
npm install
```

### Step 7: Start It Up

```
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You're in.

## How to Use This

Pick your style:

| Mode | Setup | Who it's for |
|------|-------|--------------|
| **Browser** | Everything in one window | Just want to ask questions and see answers |
| **Split** | Terminal left, browser right | The default. Ask Claude, see results update live |
| **Code** | Terminal left, terminal right | Building connectors, customizing, power users |

Start with Browser mode. When you're ready for more control, open a terminal next to your browser. When you want to build things, go full terminal.

There's no wrong way. The terminal isn't scary - you've just been told it is.

## Data Setup

The `data/` folder contains your SQLite databases and local runtime configuration. Business data and live workspace config stay local and are gitignored.

To set up:
1. Copy `env.local.example` to `env.local` and add your API credentials
2. Copy `data/data-sources.example.json` to `data/data-sources.local.json` and adjust it for your workspace
3. Run a connector to sync data: `node connectors/example/sync.js`
4. Or ask Claude: "Help me create a connector for [service name]"

## The Dashboard

The web UI gives you:

- **Chat** (beta) - Ask questions about your data in natural language
- **Visualizations** - Browse and interact with charts
- **Settings** - See connected data sources and sync status

The chat can create visualizations on the fly. Ask "show me a chart of monthly revenue" and it generates an interactive chart.

*The web chat is still in beta. For the full experience, use Claude Code in the terminal.*

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
