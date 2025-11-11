/**
 * ApexGrid Service for Data Tables
 * Using AG-Grid Community Edition for professional data grids
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class ApexGridService {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'app/viz';
  }

  /**
   * Create ApexGrid Data Table
   * @param {Array} data - Array of row objects
   * @param {Object} config - Configuration including columns, title, etc.
   */
  async createGrid(data, config) {
    const filename = `${config.filename}.html`;
    const localPath = join(this.outputDir, filename);

    // Generate HTML with ApexGrid
    const html = this.generateGridHTML(data, config);

    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });

    // Save HTML file
    writeFileSync(localPath, html);
    console.log(`✅ ApexGrid table saved: ${localPath}`);

    return {
      gridId: config.filename,
      localPath,
      filename,
      url: `/viz/${filename}`,
      title: config.title || 'Data Table'
    };
  }

  /**
   * Generate ApexGrid HTML
   */
  generateGridHTML(data, config) {
    const columns = config.columns || Object.keys(data[0] || {}).map(key => ({
      field: key,
      headerName: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      sortable: true,
      filter: true
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title || 'Data Table'}</title>
    <!-- AG-Grid CSS - Using legacy theme for v34 compatibility -->
    <link rel="stylesheet" href="https://unpkg.com/ag-grid-community/styles/ag-theme-alpine-dark.css">
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #0a0a0a;
            color: #e5e5e5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        h1 {
            margin: 0 0 20px 0;
            font-size: 24px;
            font-weight: 600;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .grid-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .grid-controls {
            display: flex;
            gap: 10px;
        }

        .control-btn {
            padding: 8px 16px;
            background: #1a1a1a;
            border: 1px solid #333;
            color: #999;
            border-radius: 0;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
        }

        .control-btn:hover {
            background: #2a2a2a;
            color: #fff;
            border-color: #667eea;
        }

        #myGrid {
            flex: 1;
            width: 100%;
        }

        /* Custom theme overrides for AG-Grid */
        .ag-theme-alpine-dark {
            --ag-background-color: #0a0a0a;
            --ag-header-background-color: #1a1a1a;
            --ag-odd-row-background-color: #0f0f0f;
            --ag-row-hover-color: #1a1a1a;
            --ag-border-color: #333;
            --ag-header-foreground-color: #e5e5e5;
            --ag-foreground-color: #e5e5e5;
            --ag-selected-row-background-color: #2a2a2a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .ag-header-cell-text {
            font-weight: 600;
            font-size: 13px;
        }

        .ag-cell {
            font-size: 13px;
            line-height: 1.5;
        }

        /* Status and value highlighting */
        .cell-status-active { color: #10b981; }
        .cell-status-inactive { color: #666; }
        .cell-value-high {
            color: #667eea;
            font-weight: 600;
        }
        .cell-value-currency {
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }

        .export-info {
            margin-top: 20px;
            padding: 15px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 0;
            font-size: 12px;
            color: #999;
        }

        .stats-row {
            display: flex;
            gap: 30px;
            margin-top: 15px;
            padding: 15px;
            background: #1a1a1a;
            border: 1px solid #333;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .stat-label {
            font-size: 11px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .stat-value {
            font-size: 18px;
            font-weight: 600;
            color: #667eea;
        }
    </style>
</head>
<body>
    <div class="grid-header">
        <h1>${config.title || 'Data Table'}</h1>
        <div class="grid-controls">
            <button class="control-btn" onclick="exportToCSV()">📥 Export CSV</button>
            <button class="control-btn" onclick="resetFilters()">🔄 Reset Filters</button>
            <button class="control-btn" onclick="autoSizeAll()">↔️ Auto Size</button>
        </div>
    </div>

    <div id="myGrid" class="ag-theme-alpine-dark"></div>

    ${config.showStats ? '<div class="stats-row" id="statsRow"></div>' : ''}

    ${config.showExportInfo ? '<div class="export-info">💡 Click column headers to sort • Use filters for searching • Cmd/Ctrl+C to copy selected data</div>' : ''}

    <!-- AG-Grid JavaScript -->
    <script src="https://unpkg.com/ag-grid-community/dist/ag-grid-community.min.js"></script>
    <script>
        // Column definitions
        const columnDefs = ${JSON.stringify(columns)};

        // Row data
        const rowData = ${JSON.stringify(data)};

        // Grid options - v34 compatible
        const gridOptions = {
            theme: 'legacy', // Use legacy theming to avoid v33+ theming conflicts
            columnDefs: columnDefs,
            rowData: rowData,
            defaultColDef: {
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 100,
                flex: 1
            },
            animateRows: true,
            rowSelection: {
                mode: 'multiRow',
                enableClickSelection: true
            },
            enableCellTextSelection: true,
            ensureDomOrder: true,
            pagination: ${config.pagination !== false},
            paginationPageSize: ${config.pageSize || 50},
            paginationPageSizeSelector: ${JSON.stringify([...new Set([20, 50, 100, config.pageSize || 50]).values()].sort((a, b) => a - b))},
            onGridReady: (params) => {
                // Auto size columns initially if requested
                ${config.autoSize ? 'autoSizeAll();' : ''}

                // Update stats if enabled
                ${config.showStats ? 'updateStats();' : ''}
            },
            onRowDataUpdated: () => {
                // Update row count display if needed
                updateRowCount();
                ${config.showStats ? 'updateStats();' : ''}
            },
            onFilterChanged: () => {
                ${config.showStats ? 'updateStats();' : ''}
            }
        };

        // Initialize grid
        document.addEventListener('DOMContentLoaded', () => {
            const gridDiv = document.querySelector('#myGrid');
            const gridApi = agGrid.createGrid(gridDiv, gridOptions);

            // Store grid API globally for export functions
            window.gridApi = gridApi;
            window.columnApi = gridApi; // In v31+ columnApi is merged with gridApi
        });

        // Export to CSV
        function exportToCSV() {
            if (window.gridApi) {
                window.gridApi.exportDataAsCsv({
                    fileName: '${config.filename || 'export'}_' + new Date().toISOString().split('T')[0] + '.csv'
                });
            }
        }

        // Reset all filters
        function resetFilters() {
            if (window.gridApi) {
                window.gridApi.setFilterModel(null);
                window.gridApi.onFilterChanged();
            }
        }

        // Auto size all columns
        function autoSizeAll() {
            if (window.gridApi) {
                window.gridApi.autoSizeAllColumns();
            }
        }

        // Update row count
        function updateRowCount() {
            if (window.gridApi) {
                const rowCount = window.gridApi.getDisplayedRowCount();
                const totalCount = rowData.length;
                console.log(\`Showing \${rowCount} of \${totalCount} rows\`);
            }
        }

        ${config.showStats ? `
        // Update statistics
        function updateStats() {
            if (!window.gridApi) return;

            const statsRow = document.getElementById('statsRow');
            if (!statsRow) return;

            let filteredData = [];
            window.gridApi.forEachNodeAfterFilterAndSort((node) => {
                filteredData.push(node.data);
            });

            const stats = calculateStats(filteredData);

            statsRow.innerHTML = \`
                <div class="stat-item">
                    <div class="stat-label">Total Rows</div>
                    <div class="stat-value">\${stats.totalRows.toLocaleString()}</div>
                </div>
                \${stats.additionalStats.map(stat => \`
                    <div class="stat-item">
                        <div class="stat-label">\${stat.label}</div>
                        <div class="stat-value">\${stat.value}</div>
                    </div>
                \`).join('')}
            \`;
        }

        // Calculate statistics based on data
        function calculateStats(data) {
            const stats = {
                totalRows: data.length,
                additionalStats: []
            };

            // Add custom stats based on config
            ${config.customStats ? JSON.stringify(config.customStats) : '[]'}.forEach(statConfig => {
                if (statConfig.type === 'sum') {
                    const sum = data.reduce((acc, row) => acc + (row[statConfig.field] || 0), 0);
                    stats.additionalStats.push({
                        label: statConfig.label,
                        value: statConfig.format === 'currency' ?
                            '$' + sum.toLocaleString() : sum.toLocaleString()
                    });
                } else if (statConfig.type === 'unique') {
                    const unique = new Set(data.map(row => row[statConfig.field])).size;
                    stats.additionalStats.push({
                        label: statConfig.label,
                        value: unique.toLocaleString()
                    });
                } else if (statConfig.type === 'average') {
                    const sum = data.reduce((acc, row) => acc + (row[statConfig.field] || 0), 0);
                    const avg = data.length > 0 ? sum / data.length : 0;
                    stats.additionalStats.push({
                        label: statConfig.label,
                        value: statConfig.format === 'currency' ?
                            '$' + avg.toFixed(2).toLocaleString() : avg.toFixed(2)
                    });
                }
            });

            return stats;
        }
        ` : ''}

        // Global data accessor for other visualizations
        window.getGridData = () => {
            const data = [];
            if (window.gridApi) {
                window.gridApi.forEachNodeAfterFilterAndSort((node) => {
                    data.push(node.data);
                });
            }
            return data;
        };

        // Make raw data accessible
        window.rawGridData = rowData;
        window.gridColumns = columnDefs;

        // Expose grid instance globally
        window.gridInstance = {
            getData: () => window.getGridData(),
            getRawData: () => window.rawGridData,
            getColumns: () => window.gridColumns,
            exportCSV: () => exportToCSV(),
            resetFilters: () => resetFilters()
        };
    </script>
</body>
</html>`;
  }
}