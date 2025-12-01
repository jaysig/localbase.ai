# LocalBase Framework

LocalBase is a local-first analytics framework for building data connectors and visualizations.

## Directory Structure

```
localbase.ai/
├── app/              # Browser UI (Vite + React)
├── connectors/       # Data connector framework
│   ├── MCPAdapter.js   # Base class for MCP tools
│   ├── APIClient.js    # Base class for HTTP clients
│   └── example/        # Example connector
├── tools/            # Framework libraries
│   ├── server/         # Express API server
│   ├── mcp/            # MCP server for Claude
│   ├── viz/            # Visualization utilities
│   ├── templates/      # Chart templates
│   ├── ocr/            # OCR utilities
│   └── surge/          # Deploy utilities
├── viz/              # Visualization registry (runtime)
├── data/             # SQLite databases
├── scripts/          # Utility scripts
├── extensions/       # Custom extensions (preserved on sync)
└── projects/         # Experimental projects (preserved on sync)
```

## Commands

```bash
npm start        # Start Express server (port 3000)
npm run dev      # Start server + Vite dev server
npm run mcp      # Start MCP server (stdio)
npm test         # Run tests
```

## Multi-Instance Architecture

This is the **framework** repo. Business instances are separate repos that contain:
- Their own `connectors/` (business-specific)
- Their own `data/` (business-specific databases)
- Their own `env.local` (credentials)
- Their own `CLAUDE.md` (instance context)

Sync framework to an instance: `cd <instance-dir> && ./scripts/sync-framework.sh`

## Connector Framework

**MCPAdapter** - For exposing tools to Claude:
```javascript
import { BaseConnector } from '../MCPAdapter.js';
// Required: getTools(), canHandleTool(), handleTool()
```

**APIClient** - For HTTP clients with auth/retry:
```javascript
import { BaseConnector } from '../APIClient.js';
// Features: auth, rate limiting, pagination
```

## Development Guidelines

- Check existing tools before creating new ones
- Connector scripts go in `connectors/{name}/`
- Temporary scripts go in `/tmp/`
- Use `better-sqlite3` for database operations
- Load credentials from `env.local`
