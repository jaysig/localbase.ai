#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory first
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from env.local (relative to project root)
config({ path: path.join(__dirname, '..', '..', 'env.local') });

/**
 * LocalBase Insights MCP Server
 * Basic server for fresh installations - exposes core data querying capabilities
 */
class LocalBaseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'localbase-insights-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_datasets',
            description: 'List all available datasets in the data directory',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_data_summary',
            description: 'Get a summary of a specific dataset (columns, row count, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                dataset: {
                  type: 'string',
                  description: 'Dataset name to summarize',
                },
              },
              required: ['dataset'],
            },
          },
          {
            name: 'query_csv_data',
            description: 'Query data from CSV files in the data directory',
            inputSchema: {
              type: 'object',
              properties: {
                dataset: {
                  type: 'string',
                  description: 'Dataset to query (e.g., "sales-data", "customers")',
                },
                query: {
                  type: 'string',
                  description: 'Natural language query about the data',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of rows to return (default: 10)',
                  default: 10,
                },
              },
              required: ['dataset', 'query'],
            },
          },
          {
            name: 'generate_chart',
            description: 'Generate a basic chart from data',
            inputSchema: {
              type: 'object',
              properties: {
                chartType: {
                  type: 'string',
                  enum: ['line', 'bar', 'pie', 'scatter'],
                  description: 'Type of chart to generate',
                },
                data: {
                  type: 'array',
                  description: 'Array of data points for the chart',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      value: { type: 'number' },
                    },
                  },
                },
                title: {
                  type: 'string',
                  description: 'Chart title',
                },
              },
              required: ['chartType', 'data'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_datasets':
            return await this.listDatasets();

          case 'get_data_summary':
            return await this.getDataSummary(args.dataset);

          case 'query_csv_data':
            return await this.queryCsvData(args.dataset, args.query, args.limit);

          case 'generate_chart':
            return await this.generateChart(args.chartType, args.data, args.title);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async listDatasets() {
    const { readdir } = await import('fs/promises');
    const dataPath = path.join(__dirname, '..', '..', 'data');

    try {
      const items = await readdir(dataPath, { withFileTypes: true });
      const datasets = items
        .filter(item => item.isDirectory())
        .map(dir => dir.name)
        .sort();

      // Also look for CSV files in root data directory
      const csvFiles = items
        .filter(item => item.isFile() && item.name.endsWith('.csv'))
        .map(file => file.name.replace('.csv', ''));

      const allDatasets = [...datasets, ...csvFiles];

      return {
        content: [
          {
            type: 'text',
            text: allDatasets.length > 0
              ? `Available datasets:\n${allDatasets.map(d => `• ${d}`).join('\n')}`
              : 'No datasets found. Add CSV files or directories to the data/ folder.',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `No data directory found. Create a 'data/' folder and add CSV files to get started.`,
          },
        ],
      };
    }
  }

  async getDataSummary(dataset) {
    const dataPath = path.join(__dirname, '..', '..', 'data');

    try {
      const { readdir, stat } = await import('fs/promises');

      // Check if it's a directory or CSV file
      const datasetPath = path.join(dataPath, dataset);
      const csvPath = path.join(dataPath, `${dataset}.csv`);

      let filePath;
      let isDirectory = false;

      try {
        const stats = await stat(datasetPath);
        if (stats.isDirectory()) {
          // Look for CSV files in the directory
          const files = await readdir(datasetPath);
          const csvFiles = files.filter(f => f.endsWith('.csv'));

          if (csvFiles.length === 0) {
            throw new Error(`No CSV files found in dataset directory: ${dataset}`);
          }

          filePath = path.join(datasetPath, csvFiles[0]);
          isDirectory = true;
        } else {
          filePath = datasetPath;
        }
      } catch {
        // Try as CSV file
        filePath = csvPath;
        await stat(csvPath); // This will throw if file doesn't exist
      }

      // Read and analyze the CSV
      const content = await readFile(filePath, 'utf-8');
      const rows = parse(content, { columns: true });

      const summary = {
        dataset,
        type: isDirectory ? 'directory' : 'file',
        totalRows: rows.length,
        columns: Object.keys(rows[0] || {}),
        sampleData: rows.slice(0, 3),
      };

      return {
        content: [
          {
            type: 'text',
            text: `Dataset: ${dataset}\n` +
                  `Type: ${summary.type}\n` +
                  `Rows: ${summary.totalRows}\n` +
                  `Columns: ${summary.columns.join(', ')}\n\n` +
                  `Sample data:\n${JSON.stringify(summary.sampleData, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get summary for ${dataset}: ${error.message}`);
    }
  }

  async queryCsvData(dataset, query, limit = 10) {
    const dataPath = path.join(__dirname, '..', '..', 'data');

    try {
      const { readdir, stat } = await import('fs/promises');

      // Find the CSV file
      const datasetPath = path.join(dataPath, dataset);
      const csvPath = path.join(dataPath, `${dataset}.csv`);

      let filePath;

      try {
        const stats = await stat(datasetPath);
        if (stats.isDirectory()) {
          const files = await readdir(datasetPath);
          const csvFiles = files.filter(f => f.endsWith('.csv'));
          if (csvFiles.length === 0) {
            throw new Error(`No CSV files found in dataset: ${dataset}`);
          }
          filePath = path.join(datasetPath, csvFiles[0]);
        } else {
          filePath = datasetPath;
        }
      } catch {
        filePath = csvPath;
        await stat(csvPath);
      }

      // Read and parse CSV
      const content = await readFile(filePath, 'utf-8');
      const rows = parse(content, { columns: true });

      // Simple filtering based on query keywords
      let filteredRows = rows;
      const queryLower = query.toLowerCase();

      if (queryLower.includes('recent') || queryLower.includes('latest')) {
        filteredRows = rows.slice(-limit);
      } else if (queryLower.includes('first') || queryLower.includes('earliest')) {
        filteredRows = rows.slice(0, limit);
      } else {
        filteredRows = rows.slice(0, limit);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Query: "${query}"\n` +
                  `Dataset: ${dataset}\n` +
                  `Results (${filteredRows.length} rows):\n\n` +
                  JSON.stringify(filteredRows, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to query ${dataset}: ${error.message}`);
    }
  }

  async generateChart(chartType, data, title = 'Chart') {
    // For now, return a text representation
    // TODO: Integrate with visualization system

    const chartData = data.map(d => `${d.label}: ${d.value}`).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Chart: ${title}\n` +
                `Type: ${chartType}\n\n` +
                `Data:\n${chartData}\n\n` +
                `[Chart generation with visualization system integration coming next...]`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LocalBase Insights MCP Server running on stdio');
    console.error('Available tools: list_datasets, get_data_summary, query_csv_data, generate_chart');
  }
}

// Start the server
const server = new LocalBaseMCPServer();
server.run().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});