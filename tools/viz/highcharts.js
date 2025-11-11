/**
 * Highcharts Service - Creates Highcharts visualizations with consistent interface
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

export class HighchartsService {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'app/viz';
  }

  /**
   * Create a Highcharts visualization
   */
  async create(config) {
    const {
      title = 'Highcharts Visualization',
      subtitle = '',
      type = 'sunburst',  // The actual Highcharts chart type
      data = [],
      filename = `highcharts-${type}-${Date.now()}.html`,
      width = '100%',
      height = 600,
      colors,
      tooltip = {},
      plotOptions = {},
      ...otherOptions
    } = config;

    // Generate unique ID if not provided
    const vizId = config.id || this.generateId();
    const filepath = join(this.outputDir, filename);

    // Create HTML content based on chart type
    let htmlContent;

    switch(config.chartType || type) {
      case 'sunburst':
        htmlContent = this.createSunburstHTML({
          vizId,
          title,
          subtitle,
          data,
          width,
          height,
          colors,
          tooltip,
          plotOptions,
          ...otherOptions
        });
        break;
      default:
        htmlContent = this.createGenericHTML({
          vizId,
          title,
          subtitle,
          type,
          data,
          width,
          height,
          colors,
          tooltip,
          plotOptions,
          ...otherOptions
        });
    }

    // Write file
    writeFileSync(filepath, htmlContent);

    return {
      id: vizId,
      type: 'chart',  // Always 'chart' for registry
      library: 'highcharts',
      chartType: type,  // Specific chart type (sunburst, etc.)
      filename,
      filepath,
      url: `/viz/${filename}`,
      title,
      subtitle,
      createdAt: new Date().toISOString(),
      size: Buffer.byteLength(htmlContent),
      dataPoints: this.countDataPoints(data)
    };
  }

  /**
   * Create HTML for sunburst chart
   */
  createSunburstHTML(config) {
    const {
      vizId,
      title,
      subtitle,
      data,
      width,
      height,
      colors,
      tooltip = {},
      plotOptions = {},
      levels = []
    } = config;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://code.highcharts.com/highcharts.js"></script>
    <script src="https://code.highcharts.com/modules/sunburst.js"></script>
    <script src="https://code.highcharts.com/modules/accessibility.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #333;
        }
        .title {
            font-size: 24px;
            font-weight: 300;
            margin-bottom: 5px;
        }
        .subtitle {
            font-size: 14px;
            color: #999;
        }
        #chart-${vizId} {
            width: ${typeof width === 'number' ? width + 'px' : width};
            height: ${typeof height === 'number' ? height + 'px' : height};
            margin: 0 auto;
        }
        .stats {
            margin-top: 20px;
            padding: 15px;
            background: #2a2a2a;
            border-radius: 4px;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 10px;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #333;
        }
        .stat-label {
            color: #999;
        }
        .stat-value {
            font-weight: 500;
            color: #fff;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">${title}</div>
            ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        </div>
        <div id="chart-${vizId}"></div>
        <div id="stats-${vizId}" class="stats"></div>
    </div>

    <script>
        (function(ApexCharts, Chart, ChartVenn, Highcharts, document, window) {
            // Debug parameter availability
            console.log('🔧 Highcharts parameter check:', typeof Highcharts, Highcharts);
            console.log('🔧 Document parameter check:', typeof document, document);

            if (typeof Highcharts === 'undefined') {
                console.error('❌ Highcharts is undefined in embedded script!');
                return;
            }

            // Dark theme for Highcharts with expanded color palette for sunburst
            Highcharts.theme = {
                colors: ${colors ? JSON.stringify(colors) : "['#7cb5ec', '#434348', '#90ee7e', '#f7a35c', '#8085e9', '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9']"},
                chart: {
                    backgroundColor: '#2a2a2a',
                    style: {
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    plotBorderColor: '#606063'
                },
                title: {
                    style: {
                        color: '#E0E0E3',
                        fontSize: '20px'
                    }
                },
                subtitle: {
                    style: {
                        color: '#999999'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    style: {
                        color: '#F0F0F0'
                    }
                },
                plotOptions: {
                    series: {
                        dataLabels: {
                            color: '#F0F0F3',
                            style: {
                                fontSize: '11px'
                            }
                        },
                        marker: {
                            lineColor: '#333'
                        }
                    }
                },
                legend: {
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    itemStyle: {
                        color: '#E0E0E3'
                    },
                    itemHoverStyle: {
                        color: '#FFF'
                    },
                    itemHiddenStyle: {
                        color: '#606063'
                    },
                    title: {
                        style: {
                            color: '#C0C0C0'
                        }
                    }
                },
                labels: {
                    style: {
                        color: '#707073'
                    }
                }
            };

            // Apply the theme
            Highcharts.setOptions(Highcharts.theme);

            // Calculate statistics for hierarchical sunburst data
            const data = ${JSON.stringify(data)};
            let totalValue = 0;
            let leafCount = 0;
            const levelCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

            // Build parent-child relationships
            const nodeMap = new Map();
            const childrenMap = new Map();

            data.forEach(item => {
                nodeMap.set(item.id, item);
                if (!childrenMap.has(item.parent)) {
                    childrenMap.set(item.parent, []);
                }
                if (item.parent) {
                    childrenMap.get(item.parent).push(item.id);
                }
            });

            // Calculate levels based on tree structure
            function getNodeLevel(nodeId, visited = new Set()) {
                if (visited.has(nodeId)) return 0; // Prevent cycles
                visited.add(nodeId);

                const node = nodeMap.get(nodeId);
                if (!node || !node.parent || node.parent === 'root') {
                    return node && node.id === 'root' ? 0 : 1;
                }
                return getNodeLevel(node.parent, visited) + 1;
            }

            // Count nodes by actual hierarchy level
            data.forEach(item => {
                const level = getNodeLevel(item.id);
                if (level <= 4) {
                    levelCounts[level]++;
                }

                if (item.value !== undefined) {
                    totalValue += item.value;
                }

                // Leaf nodes are those with values (level 4 sub-industries)
                if (item.value !== undefined) {
                    leafCount++;
                }
            });

            // Create the chart
            const chart = Highcharts.chart('chart-${vizId}', {
                chart: {
                    type: 'sunburst',
                    height: ${height}
                },
                title: {
                    text: ''  // Title is in HTML
                },
                subtitle: {
                    text: ''  // Subtitle is in HTML
                },
                accessibility: {
                    point: {
                        valueDescriptionFormat: '{point.value}'
                    }
                },
                tooltip: ${JSON.stringify({
                    pointFormat: '<b>{point.name}</b>: {point.value:,.0f} visits',
                    ...tooltip
                })},
                plotOptions: {
                    sunburst: {
                        allowDrillToNode: true,
                        dataLabels: {
                            format: '{point.name}',
                            filter: {
                                property: 'innerArcLength',
                                operator: '>',
                                value: 16
                            },
                            rotationMode: 'circular'
                        },
                        levelIsConstant: false,
                        levels: [
                            {
                                level: 0,
                                color: '#000000',
                                dataLabels: {
                                    enabled: false
                                }
                            },
                            {
                                level: 1,
                                dataLabels: {
                                    filter: {
                                        property: 'outerArcLength',
                                        operator: '>',
                                        value: 64
                                    }
                                }
                            },
                            {
                                level: 2,
                                colorVariation: {
                                    key: 'brightness',
                                    to: 0.2
                                }
                            },
                            {
                                level: 3,
                                colorVariation: {
                                    key: 'brightness',
                                    to: -0.1
                                }
                            },
                            {
                                level: 4,
                                colorVariation: {
                                    key: 'brightness',
                                    to: -0.3
                                },
                                dataLabels: {
                                    enabled: false
                                }
                            }
                        ]
                    }
                },
                series: [{
                    type: 'sunburst',
                    data: data,
                    name: 'Visits',
                    turboThreshold: 10000  // Allow large datasets
                }]
            });

            // Display statistics with proper hierarchy labels
            const levelLabels = {
                0: 'Root',
                1: 'Sectors',
                2: 'Industry Groups',
                3: 'Industries',
                4: 'Sub-Industries'
            };

            const statsHtml = \`
                <div style="margin-bottom: 10px; font-size: 16px; color: #fff;">Hierarchy Statistics</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total Visits:</span>
                        <span class="stat-value">\${totalValue.toLocaleString()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Data Points (Leaf Nodes):</span>
                        <span class="stat-value">\${leafCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Hierarchy Nodes:</span>
                        <span class="stat-value">\${data.length}</span>
                    </div>
                    \${Object.entries(levelCounts).filter(([level, count]) => count > 0).map(([level, count]) => \`
                        <div class="stat-item">
                            <span class="stat-label">\${levelLabels[level]}:</span>
                            <span class="stat-value">\${count}</span>
                        </div>
                    \`).join('')}
                </div>
            \`;

            document.getElementById('stats-${vizId}').innerHTML = statsHtml;
        })(window.ApexCharts, window.Chart, window.ChartVenn, window.Highcharts, document, window);
    </script>
</body>
</html>`;
  }

  /**
   * Create generic Highcharts HTML
   */
  createGenericHTML(config) {
    // Simplified generic template for other chart types
    const { vizId, title, type, data, width, height } = config;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script src="https://code.highcharts.com/highcharts.js"></script>
</head>
<body>
    <div id="chart-${vizId}" style="width: ${width}; height: ${height}px;"></div>
    <script>
        Highcharts.chart('chart-${vizId}', {
            chart: { type: '${type}' },
            title: { text: '${title}' },
            series: [{
                data: ${JSON.stringify(data)}
            }]
        });
    </script>
</body>
</html>`;
  }

  /**
   * Count data points in hierarchical data
   */
  countDataPoints(data) {
    let count = 0;

    function traverse(items) {
      if (Array.isArray(items)) {
        items.forEach(item => {
          count++;
          if (item.children) {
            traverse(item.children);
          }
        });
      }
    }

    traverse(data);
    return count;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 8);
  }
}

export default HighchartsService;