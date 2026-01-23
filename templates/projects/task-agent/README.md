# Task Agent Template

A template for building task-based agents in LocalBase.

## What is a Task Agent?

A task agent is a project that processes data in sequential steps. Each step is a separate script that:
1. Reads input (from previous step or data sources)
2. Processes/transforms data
3. Writes output for the next step

## Quick Start

```bash
# Copy this template to your projects folder
cp -r ~/Work/localbase.ai/templates/projects/task-agent projects/my-agent

# Edit agent.json to configure your agent
# Edit 1-example-task/run.js or create new tasks

# Run your tasks
cd projects/my-agent
node 1-example-task/run.js
```

## Structure

```
my-agent/
├── agent.json              # Agent configuration (required)
├── README.md               # Documentation
├── 1-first-task/
│   └── run.js              # Task 1 script
├── 2-second-task/
│   └── run.js              # Task 2 script
└── output/                 # Task outputs
    └── result.json
```

## agent.json Schema

```json
{
  "name": "my-agent",
  "version": "1.0.0",
  "description": "What this agent does",
  "tasks": [
    {
      "id": "1-task-name",
      "name": "Human Readable Name",
      "entry": "1-task-name/run.js",
      "description": "What this task does"
    }
  ],
  "inputs": {
    "data": ["data-source-1"],    // Data sources this agent needs
    "config": {                    // Configuration options
      "option1": "default"
    }
  },
  "outputs": {
    "main": "output/result.json"   // Primary output file
  },
  "schedule": null                 // Future: cron schedule
}
```

## Adding Tasks

1. Create a new folder: `2-my-task/`
2. Add a `run.js` script
3. Register it in `agent.json` tasks array

### Task Script Pattern

```javascript
#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output')
const CONFIG = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'agent.json'), 'utf-8'))

// Ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

console.log('=== Task Name ===\n')

// 1. Load input (previous task output or database)
// 2. Process data
// 3. Write output

const result = { /* your data */ }
fs.writeFileSync(path.join(OUTPUT_DIR, 'result.json'), JSON.stringify(result, null, 2))

console.log('✓ Done')
```

## Data Sources

Reference data in `../../data/` relative to your project:

```javascript
import Database from 'better-sqlite3'
const db = new Database(path.join(PROJECT_ROOT, '../../data/my-data/db.sqlite'), { readonly: true })
```

## Examples

See instance-specific implementations:
- GoSkills: `sdr-agent` (G2 intent + HubSpot deals → outreach lists)
- Partnernomics: `sdr-agent` (LearnDash users → HubSpot sync)
