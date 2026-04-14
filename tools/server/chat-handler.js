/**
 * Chat Handler - Multi-provider AI integration with tool use
 * Supports Anthropic Claude and OpenAI GPT models
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { basename, join, dirname, normalize } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { isAllowedReadOnlySqlQuery, resolveWorkspaceDatabasePath } from './security-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Clients will be initialized lazily with workspace env
let anthropic = null;
let openai = null;
let gemini = null;
let lastEnvWorkspace = null;

export function resolveVisualizationPath(workspace, filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('Visualization filename is required');
  }

  if (!filename.endsWith('.html')) {
    throw new Error('Visualization filename must end with .html');
  }

  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Visualization filename must not include path separators');
  }

  const safeFilename = basename(filename);
  const vizDir = join(workspace, 'viz');
  const vizPath = join(vizDir, safeFilename);
  const normalizedVizDir = normalize(vizDir);
  const normalizedVizPath = normalize(vizPath);

  if (normalizedVizPath !== normalizedVizDir && !normalizedVizPath.startsWith(normalizedVizDir + '/')) {
    throw new Error('Visualization path must stay within the viz directory');
  }

  return { safeFilename, vizDir, vizPath };
}

/**
 * Load environment variables from workspace
 * Reloads if workspace changes
 */
function loadEnv(workspace) {
  if (lastEnvWorkspace === workspace) return;

  const envPath = join(workspace, 'env.local');
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    console.log('📋 Loaded env.local from workspace:', workspace);
  }
  lastEnvWorkspace = workspace;

  // Reset clients so they pick up new credentials
  openai = null;
  anthropic = null;
  gemini = null;
}

/**
 * Get chat configuration from environment
 */
export function getChatConfig() {
  return {
    provider: process.env.CHAT_PROVIDER || 'openai',
    model: process.env.CHAT_MODEL || 'gpt-4o',
    availableProviders: [
      { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'] },
      { id: 'anthropic', name: 'Anthropic', models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514'] },
      { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'] }
    ]
  };
}

/**
 * Initialize Anthropic client
 */
function getAnthropicClient(workspace) {
  loadEnv(workspace);
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(workspace) {
  loadEnv(workspace);
  if (!openai) {
    openai = new OpenAI();
  }
  return openai;
}

/**
 * Initialize Gemini client (via OpenAI-compatible endpoint)
 */
function getGeminiClient(workspace) {
  loadEnv(workspace);
  if (!gemini) {
    gemini = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
    });
  }
  return gemini;
}

// Tool definitions for Claude
const tools = [
  {
    name: 'query_database',
    description: 'Execute a SQL query against a SQLite database in the workspace. Use this to explore data, get counts, or retrieve information for visualizations.',
    input_schema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Path to database relative to workspace (e.g., "data/hubspot/companies.db")'
        },
        sql: {
          type: 'string',
          description: 'SQL query to execute (SELECT only for safety)'
        }
      },
      required: ['database', 'sql']
    }
  },
  {
    name: 'list_databases',
    description: 'List all SQLite databases in the workspace data directory',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_table_schema',
    description: 'Get the schema (columns and types) for a table in a database',
    input_schema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Path to database relative to workspace'
        },
        table: {
          type: 'string',
          description: 'Table name to get schema for'
        }
      },
      required: ['database', 'table']
    }
  },
  {
    name: 'create_visualization',
    description: 'Create an HTML visualization file with ApexCharts. The visualization will be saved and registered automatically.',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Filename for the visualization (e.g., "hubspot-companies-chart.html")'
        },
        title: {
          type: 'string',
          description: 'Title of the visualization'
        },
        html_content: {
          type: 'string',
          description: 'Complete HTML content including ApexCharts setup. Must be a complete HTML document with dark theme styling.'
        }
      },
      required: ['filename', 'title', 'html_content']
    }
  },
  {
    name: 'list_visualizations',
    description: 'List all existing visualizations in the workspace',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_visualization',
    description: 'Read the HTML content of an existing visualization file. Use this to see the current code before making modifications.',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Filename of the visualization (e.g., "hubspot-companies-timeline.html")'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'edit_visualization',
    description: 'Make a surgical edit to an existing visualization by replacing a specific string with a new string. PREFERRED over create_visualization when making small changes. The old_string must match exactly (including whitespace).',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Filename of the visualization to edit'
        },
        old_string: {
          type: 'string',
          description: 'The exact string to find and replace (must be unique in the file)'
        },
        new_string: {
          type: 'string',
          description: 'The replacement string'
        }
      },
      required: ['filename', 'old_string', 'new_string']
    }
  }
];

// Convert Anthropic tools to OpenAI format
const openaiTools = tools.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema
  }
}));

/**
 * Execute a tool and return result
 */
async function executeTool(toolName, toolInput, workspace) {
  console.log(`🔧 Executing tool: ${toolName}`, toolInput);

  try {
    switch (toolName) {
      case 'query_database': {
        let dbPath;
        try {
          ({ dbPath } = resolveWorkspaceDatabasePath(workspace, toolInput.database));
        } catch (error) {
          return { error: error.message };
        }

        if (!existsSync(dbPath)) {
          return { error: `Database not found: ${toolInput.database}` };
        }

        if (!isAllowedReadOnlySqlQuery(toolInput.sql)) {
          return { error: 'Only read-only SELECT queries are allowed' };
        }

        const db = new Database(dbPath, { readonly: true });
        try {
          const results = db.prepare(toolInput.sql).all();
          db.close();
          return {
            success: true,
            rowCount: results.length,
            data: results.slice(0, 100), // Limit to 100 rows
            truncated: results.length > 100
          };
        } catch (err) {
          db.close();
          return { error: err.message };
        }
      }

      case 'list_databases': {
        const dataDir = join(workspace, 'data');
        const databases = [];

        if (existsSync(dataDir)) {
          const findDbs = (dir, prefix = '') => {
            const items = readdirSync(dir);
            for (const item of items) {
              const itemPath = join(dir, item);
              const stat = statSync(itemPath);
              if (stat.isDirectory() && !item.startsWith('.')) {
                findDbs(itemPath, prefix ? `${prefix}/${item}` : item);
              } else if (item.endsWith('.db') || item.endsWith('.sqlite') || item.endsWith('.sqlite3')) {
                databases.push({
                  path: `data/${prefix ? prefix + '/' : ''}${item}`,
                  name: item,
                  size: stat.size
                });
              }
            }
          };
          findDbs(dataDir);
        }

        return { databases };
      }

      case 'get_table_schema': {
        let dbPath;
        try {
          ({ dbPath } = resolveWorkspaceDatabasePath(workspace, toolInput.database));
        } catch (error) {
          return { error: error.message };
        }

        if (!existsSync(dbPath)) {
          return { error: `Database not found: ${toolInput.database}` };
        }

        const db = new Database(dbPath, { readonly: true });
        try {
          // Get list of valid tables
          const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
          const validTables = tables.map(t => t.name);

          // Get table list if no specific table requested
          if (!toolInput.table) {
            db.close();
            return { tables: validTables };
          }

          // Security: Validate table name against actual tables (prevents SQL injection)
          if (!validTables.includes(toolInput.table)) {
            db.close();
            return { error: `Table not found: ${toolInput.table}` };
          }

          // Get schema for specific table (use bracket notation for safety)
          const schema = db.prepare(`PRAGMA table_info([${toolInput.table}])`).all();
          const sampleRow = db.prepare(`SELECT * FROM [${toolInput.table}] LIMIT 1`).get();
          db.close();

          return {
            table: toolInput.table,
            columns: schema.map(col => ({
              name: col.name,
              type: col.type,
              nullable: !col.notnull,
              primaryKey: col.pk === 1
            })),
            sampleRow
          };
        } catch (err) {
          db.close();
          return { error: err.message };
        }
      }

      case 'create_visualization': {
        const { safeFilename, vizDir, vizPath } = resolveVisualizationPath(workspace, toolInput.filename);
        const registryPath = join(workspace, 'viz', 'visualizations.json');

        // Ensure viz directory exists
        if (!existsSync(vizDir)) {
          return { error: 'Visualization directory not found' };
        }

        // Write the HTML file
        writeFileSync(vizPath, toolInput.html_content);

        // Update registry
        let registry = { visualizations: [] };
        if (existsSync(registryPath)) {
          registry = JSON.parse(readFileSync(registryPath, 'utf8'));
        }

        // Generate ID from filename
        const id = safeFilename.replace('.html', '').replace(/[^a-z0-9-]/gi, '-');

        // Check if already exists
        const existingIndex = registry.visualizations.findIndex(v => v.id === id);
        const vizEntry = {
          id,
          filename: safeFilename,
          title: toolInput.title,
          type: 'chart',
          library: 'apexcharts',
          url: `/viz/${safeFilename}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
          registry.visualizations[existingIndex] = {
            ...registry.visualizations[existingIndex],
            ...vizEntry
          };
        } else {
          registry.visualizations.unshift(vizEntry);
        }

        writeFileSync(registryPath, JSON.stringify(registry, null, 2));

        return {
          success: true,
          message: `Visualization created: ${safeFilename}`,
          url: `/viz/${safeFilename}`,
          id
        };
      }

      case 'list_visualizations': {
        const registryPath = join(workspace, 'viz', 'visualizations.json');
        if (!existsSync(registryPath)) {
          return { visualizations: [] };
        }

        const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
        return {
          visualizations: registry.visualizations.map(v => ({
            id: v.id,
            title: v.title,
            type: v.type,
            url: v.url
          }))
        };
      }

      case 'read_visualization': {
        const { safeFilename, vizPath } = resolveVisualizationPath(workspace, toolInput.filename);
        if (!existsSync(vizPath)) {
          return { error: `Visualization not found: ${safeFilename}` };
        }

        const content = readFileSync(vizPath, 'utf8');
        return {
          filename: safeFilename,
          content: content,
          size: content.length
        };
      }

      case 'edit_visualization': {
        const { safeFilename, vizPath } = resolveVisualizationPath(workspace, toolInput.filename);
        if (!existsSync(vizPath)) {
          return { error: `Visualization not found: ${safeFilename}` };
        }

        const content = readFileSync(vizPath, 'utf8');

        // Check if old_string exists and is unique
        const occurrences = content.split(toolInput.old_string).length - 1;
        if (occurrences === 0) {
          return {
            error: `String not found in file. Make sure old_string matches exactly (including whitespace).`,
            hint: 'Use read_visualization first to see the exact content.'
          };
        }
        if (occurrences > 1) {
          return {
            error: `String found ${occurrences} times. old_string must be unique. Add more context to make it unique.`
          };
        }

        // Perform the replacement
        const newContent = content.replace(toolInput.old_string, toolInput.new_string);
        writeFileSync(vizPath, newContent);

        return {
          success: true,
          message: `Successfully edited ${safeFilename}`,
          filename: safeFilename
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`Tool execution error (${toolName}):`, err);
    return { error: err.message };
  }
}

/**
 * System prompt for the chat assistant
 */
const SYSTEM_PROMPT = `You are LocalBase Assistant, an AI helper for data visualization and analytics.

IMPORTANT: You MUST use your tools to complete tasks. Never just describe what you would do - actually DO it by calling the appropriate tool.

You have access to the user's LocalBase workspace which contains:
- SQLite databases with business data (HubSpot, Mixpanel, G2, etc.)
- A visualization system using ApexCharts

Your capabilities:
1. Query databases to explore and analyze data
2. Create visualizations (charts, graphs) using ApexCharts
3. Help users understand their data

MODIFYING EXISTING VISUALIZATIONS (CRITICAL):
When asked to modify/update/change a visualization:

1. FIRST: Call read_visualization to see the FULL current code
2. ANALYZE: Identify the SPECIFIC lines that need to change
3. USE edit_visualization for small changes (PREFERRED):
   - Use edit_visualization to make surgical replacements
   - Only change what's necessary - preserve everything else
   - The old_string must match EXACTLY (copy from read output)
4. Only use create_visualization if you need to rewrite the entire file

PRINCIPLES FOR MODIFICATIONS:
- MINIMAL CHANGES: Only modify the specific code that needs to change
- PRESERVE PATTERNS: If the viz uses type="month", keep using type="month"
- DON'T BREAK WORKING CODE: If something works, don't change it
- MATCH EXACT WHITESPACE: When using edit_visualization, copy strings exactly

CRITICAL RULES FOR VISUALIZATIONS:

1. DATA: Always embed REAL query results directly in the HTML as a JavaScript const.
   - Query the database first, then embed those exact results
   - NEVER use fetch() to call APIs - there are no data APIs
   - NEVER use placeholder, sample, or Math.random() data

2. STYLING: Use these exact colors (no gradients, no custom schemes):
   - Page background: #0a0a0f
   - Card/container background: #1a1a2e
   - Text: #e5e5e5
   - Muted text: #a0a0a0
   - Border: #2a2a3e
   - Accent: #22c55e (green)
   - Chart colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

3. HTML TEMPLATE:
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
  <style>
    body { background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 20px; }
    .chart-container { background: #1a1a2e; border-radius: 8px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Chart Title</h1>
    <div class="chart-container"><div id="chart"></div></div>
  </div>
  <script>
    const data = [/* ACTUAL QUERY RESULTS HERE */];
    // ApexCharts config with theme: 'dark', chart.background: 'transparent'
  </script>
</body>
</html>
\`\`\`

WORKFLOW:
1. Query database to get real data
2. Create visualization with that data embedded as const
3. Never fetch from APIs

Be concise. When done, tell user the viz is in the Visualizations tab.`;

/**
 * Handle a chat request with Anthropic Claude
 */
async function handleAnthropicChat(messages, workspace, systemPrompt, model) {
  const client = getAnthropicClient(workspace);
  const anthropicMessages = messages.map(m => ({ role: m.role, content: m.content }));

  let toolsUsed = [];
  let finalResponse = '';

  let stream = await client.messages.stream({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    tools,
    messages: anthropicMessages
  });
  let response = await stream.finalMessage();

  while (response.stop_reason === 'tool_use') {
    console.log(`🔄 Tool loop iteration - stop_reason: ${response.stop_reason}`);
    const assistantMessage = { role: 'assistant', content: response.content };
    anthropicMessages.push(assistantMessage);

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`🔧 Tool call: ${block.name}`, JSON.stringify(block.input).slice(0, 200));
        toolsUsed.push(block.name);
        const result = await executeTool(block.name, block.input, workspace);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result)
        });
      }
    }

    anthropicMessages.push({ role: 'user', content: toolResults });
    stream = await client.messages.stream({
      model,
      max_tokens: 16384,
      system: systemPrompt,
      tools,
      messages: anthropicMessages
    });
    response = await stream.finalMessage();
  }

  console.log(`✅ Anthropic tool loop ended - final stop_reason: ${response.stop_reason}`);
  for (const block of response.content) {
    if (block.type === 'text') {
      finalResponse += block.text;
    }
  }

  return { response: finalResponse, toolsUsed };
}

/**
 * Handle a chat request with OpenAI GPT
 */
async function handleOpenAIChat(messages, workspace, systemPrompt, model, client = null) {
  if (!client) client = getOpenAIClient(workspace);
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  let toolsUsed = [];
  let finalResponse = '';

  let response = await client.chat.completions.create({
    model,
    max_tokens: 16384,
    messages: openaiMessages,
    tools: openaiTools
  });

  let message = response.choices[0].message;

  while (message.tool_calls && message.tool_calls.length > 0) {
    console.log(`🔄 OpenAI tool loop - ${message.tool_calls.length} tool calls`);
    openaiMessages.push(message);

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolInput = JSON.parse(toolCall.function.arguments);
      console.log(`🔧 Tool call: ${toolName}`, JSON.stringify(toolInput).slice(0, 200));
      toolsUsed.push(toolName);

      const result = await executeTool(toolName, toolInput, workspace);
      openaiMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    response = await client.chat.completions.create({
      model,
      max_tokens: 16384,
      messages: openaiMessages,
      tools: openaiTools
    });
    message = response.choices[0].message;
  }

  console.log(`✅ OpenAI tool loop ended`);
  finalResponse = message.content || '';

  return { response: finalResponse, toolsUsed };
}

/**
 * Handle a chat request
 * @param {Array} messages - Chat messages [{role, content}]
 * @param {string} workspace - Current workspace path
 * @param {Object} currentViz - Currently open visualization (optional)
 * @param {Object} options - Optional config overrides {provider, model}
 * @returns {Promise<{response: string, toolsUsed: Array}>}
 */
export async function handleChat(messages, workspace, currentViz = null, options = {}) {
  // Load env and get config
  loadEnv(workspace);
  const config = getChatConfig();
  const provider = options.provider || config.provider;
  const model = options.model || config.model;

  console.log(`💬 Chat handler: ${messages.length} messages, provider: ${provider}, model: ${model}`);
  if (currentViz) {
    console.log(`📊 Current viz context: ${currentViz.title} (${currentViz.filename})`);
  }

  // Build system prompt with current viz context
  let systemPrompt = SYSTEM_PROMPT;
  if (currentViz) {
    systemPrompt += `\n\nCURRENT VISUALIZATION CONTEXT:
The user has "${currentViz.title}" open in the preview pane.
- Filename: ${currentViz.filename}
- ID: ${currentViz.id}

When the user asks to modify "it", "this", or "the chart", they mean this visualization.
Use read_visualization to get the current code, then use create_visualization with the SAME filename to update it.`;
  }

  try {
    let result;
    if (provider === 'anthropic') {
      result = await handleAnthropicChat(messages, workspace, systemPrompt, model);
    } else if (provider === 'gemini') {
      result = await handleOpenAIChat(messages, workspace, systemPrompt, model, getGeminiClient(workspace));
    } else {
      result = await handleOpenAIChat(messages, workspace, systemPrompt, model);
    }

    console.log(`📊 Tools used in session:`, result.toolsUsed);
    return {
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      provider,
      model
    };

  } catch (error) {
    console.error('Chat handler error:', error);
    return {
      success: false,
      error: error.message,
      response: `Error: ${error.message}`,
      provider,
      model
    };
  }
}
