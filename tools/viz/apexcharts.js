/**
 * ApexCharts Service for Professional Dashboard Visualizations
 * Based on the working Q3 dashboard that was previously deleted
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MultiLineChartTemplate } from '../templates/multiline-chart.js';
import { ModernDashboardTemplate } from '../templates/modern-dashboard.js';

export class ApexChartsService {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'web-app';
    this.width = options.width || 1400;
    this.height = options.height || 600;
  }

  /**
   * Create Multi-Line Chart with ApexCharts using new template (supports API, date filtering, aggregation)
   */
  async createMultiLineChart(data, config) {
    const filename = `${config.filename}.html`;
    const localPath = join(this.outputDir, filename);

    // Use the new multi-line chart template
    const html = MultiLineChartTemplate.generate({
      title: config.title || 'Multi-Line Chart',
      apiEndpoint: config.apiEndpoint || null,
      series: config.series || this.detectSeriesFromData(data),
      colors: config.colors || ["#ffc107", "#f25022", "#1877f2", "#9c27b0", "#34a853"],
      yAxis: config.yAxis || {
        left: { title: "Count", series: [] },
        right: { title: "Value", series: [] }
      },
      filename
    });

    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });

    // Save HTML file
    writeFileSync(localPath, html);
    console.log(`✅ Multi-line chart saved: ${localPath}`);

    return {
      chartId: config.filename,
      localPath,
      filename,
      url: `/viz/${filename}`,
      title: config.title || 'Multi-Line Chart'
    };
  }

  /**
   * Create Modern Dashboard with multiple charts and KPIs
   */
  async createModernDashboard(data, config) {
    const filename = `${config.filename}.html`;
    const localPath = join(this.outputDir, filename);

    // Use the modern dashboard template
    const html = ModernDashboardTemplate.generate({
      title: config.title || 'Modern Dashboard',
      charts: config.charts || this.getDefaultCharts(),
      kpis: config.kpis || this.getDefaultKPIs(),
      layout: config.layout || { columns: 'auto', gap: '20px' },
      theme: config.theme || 'dark',
      apiEndpoint: config.apiEndpoint || null
    });

    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });

    // Save HTML file
    writeFileSync(localPath, html);
    console.log(`✅ Modern dashboard saved: ${localPath}`);

    return {
      chartId: config.filename,
      localPath,
      filename,
      url: `/viz/${filename}`,
      title: config.title || 'Modern Dashboard'
    };
  }

  /**
   * Get default charts for dashboard
   */
  getDefaultCharts() {
    return [
      {
        title: 'Revenue Trend',
        subtitle: 'Monthly revenue over time',
        type: 'line',
        config: {
          colors: ['#3b82f6', '#10b981'],
          series: [],
          categories: []
        }
      },
      {
        title: 'Sales by Category',
        subtitle: 'Product category performance',
        type: 'bar',
        config: {
          colors: ['#8b5cf6'],
          series: [],
          categories: []
        }
      },
      {
        title: 'Traffic Sources',
        subtitle: 'Website traffic breakdown',
        type: 'donut',
        config: {
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
          series: [],
          labels: []
        }
      },
      {
        title: 'Growth Metrics',
        subtitle: 'User acquisition trends',
        type: 'area',
        config: {
          colors: ['#06b6d4', '#8b5cf6'],
          series: [],
          categories: []
        }
      }
    ];
  }

  /**
   * Get default KPIs for dashboard
   */
  getDefaultKPIs() {
    return [
      {
        label: 'Total Revenue',
        value: '$125,430',
        change: '+12.5%',
        changeType: 'positive'
      },
      {
        label: 'Active Users',
        value: '8,549',
        change: '+8.2%',
        changeType: 'positive'
      },
      {
        label: 'Conversion Rate',
        value: '3.24%',
        change: '-2.1%',
        changeType: 'negative'
      },
      {
        label: 'Avg Order Value',
        value: '$89.32',
        change: '+5.7%',
        changeType: 'positive'
      }
    ];
  }

  /**
   * Helper method to detect series from data if not provided
   */
  detectSeriesFromData(data) {
    if (!data || data.length === 0) return [];

    const sampleItem = data[0];
    const excludeFields = ['date', 'timestamp', 'id'];

    return Object.keys(sampleItem)
      .filter(key => !excludeFields.includes(key))
      .map((key, index) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        field: key,
        yAxis: 0 // Default to left axis
      }));
  }

  /**
   * Generate Multi-Line Chart HTML with ApexCharts (null values support)
   */
  generateMultiLineChartHTML(data, config) {
    // Use series from config if provided, otherwise detect from data
    let series;
    let categories;

    if (config.series) {
      // Use pre-configured series
      series = config.series;
      categories = config.xaxis?.categories || data.map(d => d.month || d.x);
    } else {
      // Auto-detect series from data structure
      categories = data.map(d => d.month || d.x);

      // Get all numeric keys except 'month' and 'x'
      const sampleRow = data[0] || {};
      const numericKeys = Object.keys(sampleRow).filter(key =>
        key !== 'month' && key !== 'x' && typeof sampleRow[key] === 'number'
      );

      // Create series for each numeric key
      const colors = config.colors || ['#00E396', '#008FFB', '#ffc107', '#f25022', '#1877f2', '#34a853'];
      series = numericKeys.map((key, index) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        data: data.map(d => d[key] || null),
        color: colors[index % colors.length]
      }));
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <style>
        body {
            background: #1a1a1a;
            color: #e5e5e5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
        }
        .chart-container {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        h1 {
            color: #fff;
            margin-bottom: 30px;
        }
        .range-btn {
            background: #444;
            color: #e5e5e5;
            border: 1px solid #666;
            padding: 8px 16px;
            margin: 0 5px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .range-btn:hover {
            background: #555;
            border-color: #777;
        }
        .range-btn:focus {
            outline: 2px solid #4285f4;
            outline-offset: 2px;
        }
        .range-btn.active {
            background: #4285f4;
            border-color: #4285f4;
            color: white;
        }
        /* Force horizontal legend layout */
        .apexcharts-legend {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
        }
        .apexcharts-legend .apexcharts-legend-series {
            display: inline-flex !important;
            align-items: center !important;
            margin: 0 !important;
            flex-direction: row !important;
        }
        .apexcharts-legend .apexcharts-legend-marker {
            margin-right: 8px !important;
            margin-bottom: 0 !important;
        }
        .apexcharts-legend .apexcharts-legend-text {
            color: #e5e5e5 !important;
            margin: 0 !important;
        }
        /* Override any default stacking */
        .apexcharts-legend-series + .apexcharts-legend-series {
            margin-top: 0 !important;
        }
    </style>
</head>
<body>
    <script>
        // Handle preview mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('preview') === 'true') {
            const h1 = document.querySelector('h1');
            if (h1) h1.style.display = 'none';
            document.body.style.padding = '10px';
            document.body.style.margin = '0';
        }
    </script>

    <h1>${config.title}</h1>
    <div class="chart-container">
        <div style="margin-bottom: 20px; text-align: center;">
            <div style="margin-bottom: 15px;">
                <label style="color: #e5e5e5; margin-right: 10px; font-size: 14px;">Date Range:</label>
                <input type="date" id="startDate" style="background: #444; color: #e5e5e5; border: 1px solid #666; padding: 6px; border-radius: 4px; margin-right: 5px;">
                <span style="color: #e5e5e5; margin: 0 5px;">to</span>
                <input type="date" id="endDate" style="background: #444; color: #e5e5e5; border: 1px solid #666; padding: 6px; border-radius: 4px; margin-right: 10px;">
                <button class="range-btn" onclick="resetDateRange()" tabindex="1">All Time</button>
            </div>
            <div>
                <label style="color: #e5e5e5; margin-right: 10px; font-size: 14px;">Aggregation:</label>
                <button class="range-btn agg-btn active" data-aggregation="day" tabindex="2">By Day</button>
                <button class="range-btn agg-btn" data-aggregation="week" tabindex="3">By Week</button>
                <button class="range-btn agg-btn" data-aggregation="month" tabindex="4">By Month</button>
            </div>
        </div>
        <div id="chart"></div>
        ${config.customLegend && config.customLegend.show ? `
        <div id="customLegend" style="display: flex; justify-content: center; align-items: center; margin-top: 20px; gap: 30px; flex-wrap: wrap;">
            ${config.customLegend.series.map(item => `
                <div class="legend-item" style="display: flex; align-items: center; cursor: pointer; opacity: 1;" onclick="toggleSeries('${item.name}')">
                    <div style="width: 12px; height: 12px; background-color: ${item.color}; margin-right: 8px; border-radius: 2px;"></div>
                    <span style="color: #e5e5e5; font-size: 12px; font-family: Helvetica, Arial;">${item.name}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>

    <script>
        var options = {
            series: ${this.assignYAxisToSeries(series)},
            chart: {
                height: 400,
                type: 'line',
                background: 'transparent',
                toolbar: {
                    show: true
                }
            },
            colors: ${JSON.stringify(config.colors || ['#ffc107', '#f25022', '#1877f2', '#34a853'])},
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: [2, 2, 2, 3]
            },
            title: {
                text: '${config.description || ''}',
                align: 'left',
                style: {
                    color: '#e5e5e5'
                }
            },
            grid: {
                borderColor: '#555',
                row: {
                    colors: ['transparent'],
                    opacity: 0.5
                }
            },
            markers: {
                size: 1
            },
            xaxis: {
                categories: ${JSON.stringify(categories)},
                title: {
                    text: 'Month',
                    style: {
                        color: '#e5e5e5'
                    }
                },
                labels: {
                    style: {
                        colors: '#999'
                    }
                }
            },
            yaxis: ${this.generateYAxisConfig(config, series)},
            legend: ${JSON.stringify(config.legend || {
                labels: {
                    colors: '#e5e5e5'
                }
            })},
            theme: {
                mode: 'dark'
            }
        };

        var chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render();

        // Custom legend toggle functionality
        ${config.customLegend && config.customLegend.show ? `
        window.toggleSeries = function(seriesName) {
            const seriesIndex = originalSeries.findIndex(s => s.name === seriesName);
            if (seriesIndex !== -1) {
                chart.toggleSeries(seriesName);
                const legendItem = document.querySelector(\`[onclick="toggleSeries('\${seriesName}')"]\`);
                if (legendItem) {
                    const isVisible = legendItem.style.opacity !== '0.3';
                    legendItem.style.opacity = isVisible ? '0.3' : '1';
                }
            }
        };
        ` : ''}

        // Date range and aggregation functionality
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const aggregationButtons = document.querySelectorAll('[data-aggregation]');
        const originalCategories = ${JSON.stringify(categories)};
        const originalSeries = ${JSON.stringify(series)};

        // Store original data
        const originalData = originalCategories.map((category, index) => {
            const dataPoint = { date: category };
            originalSeries.forEach(serie => {
                dataPoint[serie.name] = serie.data[index] || 0;
            });
            return dataPoint;
        });

        let currentAggregation = 'day';

        // Initialize date pickers with data range
        const allDates = originalCategories.map(cat => new Date(cat)).sort((a, b) => a - b);
        const minDate = allDates[0];
        const maxDate = allDates[allDates.length - 1];

        startDateInput.value = minDate.toISOString().split('T')[0];
        endDateInput.value = maxDate.toISOString().split('T')[0];
        startDateInput.min = minDate.toISOString().split('T')[0];
        startDateInput.max = maxDate.toISOString().split('T')[0];
        endDateInput.min = minDate.toISOString().split('T')[0];
        endDateInput.max = maxDate.toISOString().split('T')[0];

        function filterDataByDateRange(data) {
            const startDate = new Date(startDateInput.value);
            const endDate = new Date(endDateInput.value);

            return data.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= startDate && itemDate <= endDate;
            });
        }

        function resetDateRange() {
            startDateInput.value = minDate.toISOString().split('T')[0];
            endDateInput.value = maxDate.toISOString().split('T')[0];
            updateChart();
        }

        function aggregateData(data, level) {
            const aggregated = {};

            data.forEach(item => {
                let key;
                const date = new Date(item.date);

                if (level === 'day') {
                    key = item.date;
                } else if (level === 'week') {
                    const startOfWeek = new Date(date);
                    startOfWeek.setDate(date.getDate() - date.getDay());
                    key = startOfWeek.toISOString().split('T')[0];
                } else if (level === 'month') {
                    key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
                }

                if (!aggregated[key]) {
                    aggregated[key] = {};
                    originalSeries.forEach(serie => {
                        aggregated[key][serie.name] = 0;
                    });
                }

                originalSeries.forEach(serie => {
                    aggregated[key][serie.name] += item[serie.name] || 0;
                });
            });

            const sortedKeys = Object.keys(aggregated).sort();
            const categories = sortedKeys.map(key => {
                if (level === 'week') {
                    return 'Week of ' + new Date(key).toLocaleDateString();
                } else if (level === 'month') {
                    const [year, month] = key.split('-');
                    return new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                } else {
                    const d = new Date(key);
                    return \`\${d.getMonth() + 1}/\${d.getDate()}/\${d.getFullYear().toString().substr(-2)}\`;
                }
            });

            const series = originalSeries.map(serie => ({
                ...serie,
                data: sortedKeys.map(key => aggregated[key][serie.name])
            }));

            return { categories, series };
        }

        function updateChart() {
            const filteredData = filterDataByDateRange(originalData);
            const aggregatedData = aggregateData(filteredData, currentAggregation);

            chart.updateOptions({
                xaxis: {
                    categories: aggregatedData.categories
                },
                series: aggregatedData.series
            }, true);
        }

        // Date picker event handlers
        startDateInput.addEventListener('change', updateChart);
        endDateInput.addEventListener('change', updateChart);

        // Aggregation button handlers
        aggregationButtons.forEach(button => {
            button.addEventListener('click', function() {
                aggregationButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentAggregation = this.dataset.aggregation;
                updateChart();
            });
        });
    </script>
</body>
</html>`;
  }

  /**
   * Create Scatter Chart with ApexCharts (datetime support)
   */
  async createScatterChart(data, config) {
    const filename = `${config.filename}.html`;
    const localPath = join(this.outputDir, filename);

    // Generate HTML with ApexCharts scatter chart
    const html = this.generateScatterChartHTML(data, config);

    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });

    // Save HTML file
    writeFileSync(localPath, html);
    console.log(`✅ Scatter chart saved: ${localPath}`);

    return {
      chartId: config.filename,
      localPath,
      filename,
      url: `/viz/${filename}`,
      title: config.title || 'Scatter Chart'
    };
  }

  /**
   * Generate Scatter Chart HTML with ApexCharts (datetime support)
   */
  generateScatterChartHTML(seriesData, config) {
    // Prepare colors for each series
    const colors = ['#3498db', '#e74c3c', '#f39c12', '#9b59b6', '#27ae60', '#e67e22'];

    // Transform series data for ApexCharts scatter format
    const series = seriesData.map((serie, index) => ({
      name: serie.name,
      data: serie.data.map(point => [
        point.x, // timestamp for datetime x-axis
        point.y  // revenue value
      ]),
      color: colors[index % colors.length]
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <style>
        body {
            background: #1a1a1a;
            color: #e5e5e5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
        }
        .chart-container {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        h1 {
            color: #fff;
            margin-bottom: 30px;
        }
        .correlation-summary {
            background: #333;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: left;
        }
        .correlation-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 5px 0;
            font-size: 14px;
        }
        .correlation-left {
            display: flex;
            align-items: center;
        }
        .correlation-value {
            font-weight: bold;
        }
        .correlation-value.strong { color: #27ae60; }
        .correlation-value.moderate { color: #f39c12; }
        .correlation-value.weak { color: #e74c3c; }
        .lag-controls {
            margin-bottom: 20px;
        }
        .lag-btn {
            background: #444;
            color: #e5e5e5;
            border: 1px solid #666;
            padding: 8px 16px;
            margin: 0 5px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .lag-btn:hover {
            background: #555;
            border-color: #777;
        }
        .lag-btn.active {
            background: #3498db;
            border-color: #3498db;
            color: white;
        }
        .shape-icon {
            width: 12px;
            height: 12px;
            margin-right: 8px;
            display: inline-block;
            position: relative;
        }
        .shape-icon.circle {
            border-radius: 50%;
            background-color: #3498db;
        }
        .shape-icon.square {
            background-color: #e74c3c;
        }
        .shape-icon.triangle {
            width: 0;
            height: 0;
            background: none;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 10px solid #f39c12;
            margin-right: 8px;
        }
        .shape-icon.diamond {
            width: 10px;
            height: 10px;
            background-color: #9b59b6;
            transform: rotate(45deg);
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <script>
        // Handle preview mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('preview') === 'true') {
            document.addEventListener('DOMContentLoaded', function() {
                const h1 = document.querySelector('h1');
                const summary = document.querySelector('.correlation-summary');
                const shapeLegend = document.querySelector('.shape-legend');
                const controls = document.querySelector('.lag-controls');
                if (h1) h1.style.display = 'none';
                if (summary) summary.style.display = 'none';
                if (shapeLegend) shapeLegend.style.display = 'none';
                if (controls) controls.style.display = 'none';
                document.body.style.padding = '5px';
                document.body.style.margin = '0';
                const chartContainer = document.querySelector('.chart-container');
                if (chartContainer) chartContainer.style.padding = '10px';
            });
        }
    </script>

    <h1>${config.title}</h1>
    <div class="chart-container">
        ${config.correlations ? `
        <div class="correlation-summary">
            <h3>Correlation Summary (${config.lagMonths} Month Lag):</h3>
            ${Object.entries(config.correlations).map(([pipeline, correlation]) => {
                const absCorr = Math.abs(correlation);
                const strength = absCorr > 0.7 ? 'strong' : absCorr > 0.3 ? 'moderate' : 'weak';

                // Determine shape icon based on pipeline type
                let shapeIcon = '';
                if (pipeline.toLowerCase().includes('renewal')) {
                    shapeIcon = '<span class="shape-icon square" style="margin-right: 8px;"></span>';
                } else if (pipeline.toLowerCase().includes('expansion')) {
                    shapeIcon = '<span class="shape-icon triangle" style="margin-right: 8px;"></span>';
                } else if (pipeline.toLowerCase().includes('win-back')) {
                    shapeIcon = '<span class="shape-icon diamond" style="margin-right: 8px;"></span>';
                } else if (pipeline.toLowerCase().includes('new')) {
                    shapeIcon = '<span class="shape-icon circle" style="margin-right: 8px;"></span>';
                } else {
                    shapeIcon = '<span class="shape-icon circle" style="margin-right: 8px;"></span>';
                }

                return `<div class="correlation-item">
                    <div class="correlation-left">
                        ${shapeIcon}
                        <span>${pipeline}:</span>
                    </div>
                    <span class="correlation-value ${strength}">r = ${correlation.toFixed(3)}</span>
                </div>`;
            }).join('')}
            <div style="margin-top: 10px; font-size: 12px; color: #999;">
                Data points: ${config.dataPoints || 'N/A'} months
            </div>
        </div>
        ` : ''}


        <div class="lag-controls">
            <span style="margin-right: 10px;">Lag Analysis:</span>
            <button class="lag-btn ${config.lagMonths === 0 ? 'active' : ''}" onclick="changeLag(0)">0 Month</button>
            <button class="lag-btn ${config.lagMonths === 1 ? 'active' : ''}" onclick="changeLag(1)">1 Month</button>
            <button class="lag-btn ${config.lagMonths === 2 ? 'active' : ''}" onclick="changeLag(2)">2 Month</button>
            <button class="lag-btn ${config.lagMonths === 3 ? 'active' : ''}" onclick="changeLag(3)">3 Month</button>
            <button class="lag-btn ${config.lagMonths === 6 ? 'active' : ''}" onclick="changeLag(6)">6 Month</button>
        </div>

        <div id="chart"></div>
    </div>

    <script>
        var options = {
            series: ${JSON.stringify(series)},
            chart: {
                height: 500,
                type: 'scatter',
                background: 'transparent',
                toolbar: {
                    show: true
                },
                zoom: {
                    enabled: true,
                    type: 'xy'
                }
            },
            colors: ${JSON.stringify(colors.slice(0, series.length))},
            dataLabels: {
                enabled: false
            },
            title: {
                text: '${config.description || 'Correlation Analysis'}',
                align: 'left',
                style: {
                    color: '#e5e5e5',
                    fontSize: '14px'
                }
            },
            grid: {
                borderColor: '#555',
                row: {
                    colors: ['transparent'],
                    opacity: 0.5
                }
            },
            stroke: {
                show: true,
                curve: 'smooth',
                width: 2
            },
            markers: {
                size: 8,
                strokeColors: '#1a1a1a',
                strokeWidth: 2,
                hover: {
                    size: 10
                },
                shape: ['circle', 'square', 'triangle', 'diamond'], // Different shapes per series
                discrete: ${JSON.stringify(seriesData.map((serie, index) => ({
                    seriesIndex: index,
                    dataPointIndex: -1, // Apply to all points in series
                    fillColor: colors[index % colors.length],
                    strokeColor: colors[index % colors.length],
                    size: 8,
                    shape: ['circle', 'square', 'triangle', 'diamond'][index % 4]
                })))}
            },
            xaxis: {
                type: 'datetime',
                title: {
                    text: 'Month',
                    style: {
                        color: '#e5e5e5'
                    }
                },
                labels: {
                    style: {
                        colors: '#999'
                    },
                    datetimeFormatter: {
                        year: 'yyyy',
                        month: 'MMM yy',
                        day: 'dd MMM',
                        hour: 'HH:mm'
                    }
                }
            },
            yaxis: {
                title: {
                    text: 'Deal Revenue ($)',
                    style: {
                        color: '#e5e5e5'
                    }
                },
                labels: {
                    style: {
                        colors: '#999'
                    },
                    formatter: function (val) {
                        return val ? '$' + val.toLocaleString() : '';
                    }
                }
            },
            legend: {
                labels: {
                    colors: '#e5e5e5'
                },
                position: 'top'
            },
            tooltip: {
                theme: 'dark',
                custom: function({series, seriesIndex, dataPointIndex, w}) {
                    // Use embedded chart data instead of seriesData reference
                    const chartData = ${JSON.stringify(seriesData)};
                    const point = chartData[seriesIndex]?.data[dataPointIndex];
                    if (!point) return '';

                    const date = new Date(point.x).toLocaleDateString();
                    const revenue = point.revenue || point.y;
                    const adSpend = point.adSpend || point.z || 0;
                    const dealCount = point.dealCount || 0;
                    const avgDealSize = dealCount > 0 ? revenue / dealCount : 0;

                    return \`<div style="padding: 12px; min-width: 200px;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 8px; font-size: 14px;">
                            \${w.config.series[seriesIndex].name.split(' (r=')[0]}
                        </div>
                        <div style="border-top: 1px solid #444; padding-top: 8px;">
                            <div style="margin: 4px 0;"><strong>Month:</strong> \${point.revenueMonth || date}</div>
                            <div style="margin: 4px 0;"><strong>Revenue:</strong> <span style="color: #27ae60;">$\${revenue.toLocaleString()}</span></div>
                            <div style="margin: 4px 0;"><strong>Deal Count:</strong> <span style="color: #3498db;">\${dealCount}</span></div>
                            \${dealCount > 0 ? \`<div style="margin: 4px 0;"><strong>Avg Deal Size:</strong> <span style="color: #f39c12;">$\${Math.round(avgDealSize).toLocaleString()}</span></div>\` : ''}
                            <div style="margin: 4px 0;"><strong>Ad Spend:</strong> <span style="color: #e74c3c;">$\${adSpend.toLocaleString()}</span></div>
                            \${point.adSpendMonth && point.adSpendMonth !== point.revenueMonth ?
                                \`<div style="margin: 4px 0; font-size: 12px; color: #999;">Ad Spend Month: \${point.adSpendMonth}</div>\` : ''}
                        </div>
                    </div>\`;
                }
            },
            theme: {
                mode: 'dark'
            }
        };

        var chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render();

        // Lag control functionality with real-time data switching
        const allAnalyses = ${config.allAnalyses ? JSON.stringify(config.allAnalyses) : 'null'};

        // Make changeLag function global
        window.changeLag = function(lagMonths) {
            if (!allAnalyses || !allAnalyses[lagMonths]) {
                console.error('No data available for lag:', lagMonths);
                return;
            }

            // Update active button
            document.querySelectorAll('.lag-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector(\`[onclick="changeLag(\${lagMonths})"]\`).classList.add('active');

            // Get new data for this lag period
            const newAnalysis = allAnalyses[lagMonths];
            const newSeries = newAnalysis.series.map((serie, index) => ({
                name: serie.name,
                data: serie.data.map(point => [point.x, point.y]),
                color: ${JSON.stringify(colors.slice(0, series.length))}[index]
            }));

            // Update chart with new data
            chart.updateSeries(newSeries);

            // Update correlation summary
            const summaryElement = document.querySelector('.correlation-summary');
            if (summaryElement) {
                const correlations = newAnalysis.correlations;
                summaryElement.innerHTML = \`
                    <h3>Correlation Summary (\${lagMonths} Month Lag):</h3>
                    \${Object.entries(correlations).map(([pipeline, correlation]) => {
                        const absCorr = Math.abs(correlation);
                        const strength = absCorr > 0.7 ? 'strong' : absCorr > 0.3 ? 'moderate' : 'weak';

                        // Determine shape icon based on pipeline type
                        let shapeIcon = '';
                        if (pipeline.toLowerCase().includes('renewal')) {
                            shapeIcon = '<span class="shape-icon square" style="margin-right: 8px;"></span>';
                        } else if (pipeline.toLowerCase().includes('expansion')) {
                            shapeIcon = '<span class="shape-icon triangle" style="margin-right: 8px;"></span>';
                        } else if (pipeline.toLowerCase().includes('win-back')) {
                            shapeIcon = '<span class="shape-icon diamond" style="margin-right: 8px;"></span>';
                        } else if (pipeline.toLowerCase().includes('new')) {
                            shapeIcon = '<span class="shape-icon circle" style="margin-right: 8px;"></span>';
                        } else {
                            shapeIcon = '<span class="shape-icon circle" style="margin-right: 8px;"></span>';
                        }

                        return \`<div class="correlation-item">
                            <div class="correlation-left">
                                \${shapeIcon}
                                <span>\${pipeline}:</span>
                            </div>
                            <span class="correlation-value \${strength}">r = \${correlation.toFixed(3)}</span>
                        </div>\`;
                    }).join('')}
                    <div style="margin-top: 10px; font-size: 12px; color: #999;">
                        Data points: \${newAnalysis.dataPoints} months
                    </div>
                \`;
            }

            // Update chart title
            chart.updateOptions({
                title: {
                    text: \`Correlation Analysis (\${lagMonths} Month Lag)\`
                }
            });
        };
    </script>
</body>
</html>`;
  }

  /**
   * Create Q3 Dashboard with ApexCharts (Restored from deleted code)
   */
  async createQ3Dashboard(data, config) {
    const filename = `${config.filename}.html`;
    const localPath = join(this.outputDir, filename);
    
    // Generate HTML with ApexCharts
    const html = this.generateQ3DashboardHTML(data, config);
    
    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });
    
    // Save HTML file
    writeFileSync(localPath, html);
    console.log(`✅ Q3 dashboard saved: ${localPath}`);
    
    return {
      chartId: config.filename,
      localPath,
      filename,
      title: config.title || 'Q3 Dashboard'
    };
  }

  /**
   * Generate Q3 Dashboard HTML with ApexCharts (Restored Working Version)
   */
  generateQ3DashboardHTML(data, config) {
    const currentDate = new Date().toLocaleDateString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            min-height: 100vh;
            padding: 20px;
            color: #e5e5e5;
        }
        
        .dashboard {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: #e5e5e5;
            margin-bottom: 30px;
            background: #2d2d2d;
            padding: 20px;
            border: 1px solid #404040;
        }
        
        .header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            color: #e5e5e5;
        }
        
        .header p {
            font-size: 1rem;
            color: #b5b5b5;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        
        .panel {
            background: #2d2d2d;
            padding: 20px;
            border: 1px solid #404040;
        }
        
        .panel[style*="grid-column: 1 / -1"] {
            padding: 20px;
        }
        
        .panel h2 {
            color: #e5e5e5;
            margin-bottom: 20px;
            font-size: 1.1rem;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        
        .metric-large {
            font-size: 2rem;
            font-weight: 900;
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            color: white;
        }
        
        .metric-large.positive {
            background: #27ae60;
        }
        
        .metric-large.negative {
            background: #e91e63;
        }
        
        .metric-large.ahead {
            background: #27ae60;
        }
        
        .metric-large.warning {
            background: #f39c12;
        }
        
        .metric-large.info {
            background: #3498db;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
        }
        
        .pipeline-progress-container {
            padding: 30px 0;
            margin: 20px 0;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            font-weight: 600;
            color: #b5b5b5;
            font-size: 0.85rem;
        }
        
        .metric-value {
            font-weight: 700;
            color: #e5e5e5;
            font-size: 0.85rem;
        }
        
        .note {
            font-size: 0.75rem;
            color: #b5b5b5;
            font-style: italic;
            margin-top: 15px;
            padding: 10px;
            background: #1a1a1a;
            border-left: 3px solid #3498db;
        }
        
        .progress-container {
            margin: 20px 0;
        }
        
        .progress-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-weight: 600;
            color: #b5b5b5;
            font-size: 0.8rem;
        }
        
        .progress-bar {
            width: 100%;
            height: 10px;
            background: #404040;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            transition: width 1s ease-in-out;
            background: #3498db;
        }
        
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>📊 ${config.title}</h1>
            <p>Real-time performance metrics and pipeline analysis • ${currentDate}</p>
        </div>
        
        <div class="grid">
            <!-- Pipeline Progress Chart Panel -->
            <div class="panel" style="grid-column: 1 / -1;">
                <h2>📈 Q3 2025 Pipeline Progress to Goal</h2>
                <div class="pipeline-progress-container">
                    <div id="pipelineProgressChart"></div>
                </div>
                <div class="note">
                    Pipeline performance tracking: Current progress vs Q3 goals across all deal types
                </div>
            </div>
            
            <!-- Closed Won Panel -->
            <div class="panel">
                <h2>🎯 Q3 2025 Closed Won Amount</h2>
                <div class="metric-large positive">
                    $${Math.round(data.closedWon / 1000)}K
                </div>
                <div class="metric">
                    <span class="metric-label">Q3 Goal</span>
                    <span class="metric-value">$${Math.round(data.q3Target / 1000)}K</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Deals Count</span>
                    <span class="metric-value">${data.closedWonDeals} deals</span>
                </div>
                <div class="progress-container">
                    <div class="progress-label">
                        <span>Progress to Goal</span>
                        <span>${data.progressPercent.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, data.progressPercent)}%"></div>
                    </div>
                </div>
                <div class="note">
                    Updated with current Q3 2025 closed won deals from HubSpot data
                </div>
            </div>
            
            <!-- Current Run Rate Panel -->
            <div class="panel">
                <h2>📈 Q3 2025 Daily Run Rate (Current)</h2>
                <div class="metric-large ${data.currentRunRate >= data.targetRunRate ? 'positive' : 'negative'}">
                    $${Math.round(data.currentRunRate)}/day
                </div>
                <div class="metric">
                    <span class="metric-label">Days Elapsed</span>
                    <span class="metric-value">${data.daysElapsed} days</span>
                </div>
                <div class="progress-container">
                    <div class="progress-label">
                        <span>Quarter Progress</span>
                        <span>${((data.daysElapsed / data.totalDays) * 100).toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(data.daysElapsed / data.totalDays) * 100}%"></div>
                    </div>
                </div>
            </div>
            
            <!-- Required Run Rate Panel -->
            <div class="panel">
                <h2>🎯 Q3 2025 Daily Run Rate (Target)</h2>
                <div class="metric-large warning">
                    $${Math.round(data.targetRunRate)}/day
                </div>
                <div class="metric">
                    <span class="metric-label">Q3 Goal</span>
                    <span class="metric-value">$${Math.round(data.q3Target / 1000)}K</span>
                </div>
                <div class="progress-container">
                    <div class="progress-label">
                        <span>Goal Achievement</span>
                        <span>${data.progressPercent.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, data.progressPercent)}%"></div>
                    </div>
                </div>
            </div>
            
            <!-- Run Rate Gap Panel -->
            <div class="panel">
                <h2>⚠️ Q3 2025 Daily Run Rate Gap</h2>
                <div class="metric-large ${data.currentRunRate >= data.targetRunRate ? 'positive' : 'negative'}">
                    ${data.currentRunRate >= data.targetRunRate ? '+' : ''}$${Math.round(data.currentRunRate - data.targetRunRate)}/day
                </div>
                <div class="metric">
                    <span class="metric-label">Status</span>
                    <span class="metric-value">${data.currentRunRate >= data.targetRunRate ? 'Ahead of Target' : 'Behind Target'}</span>
                </div>
                <div class="note">
                    ${data.currentRunRate >= data.targetRunRate 
                        ? 'Currently ahead of target! Great performance.' 
                        : `Currently behind target by $${Math.round(Math.abs(data.currentRunRate - data.targetRunRate))} per day. Need to accelerate to reach Q3 goal.`}
                </div>
            </div>
            
            <!-- Pipeline Chart Panel -->
            <div class="panel">
                <h2>🔄 Q3 2025 Deal Stage Breakdown</h2>
                <div class="chart-container">
                    <div id="pipelineChart"></div>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Pipeline Value</span>
                    <span class="metric-value">$${Math.round(data.totalRevenue / 1000)}K</span>
                </div>
                <div class="note">
                    Pipeline breakdown by deal stage from current Q3 data
                </div>
            </div>
            
            <!-- Progress Chart Panel -->
            <div class="panel">
                <h2>📊 Q3 2025 Progress Overview</h2>
                <div class="chart-container">
                    <div id="progressChart"></div>
                </div>
                <div class="note">
                    Visual representation of current progress vs. targets
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const data = ${JSON.stringify(data)};
        
        // Pipeline Breakdown Chart using ApexCharts
        const pipelineData = data.stageBreakdown || [];
        const pipelineChart = new ApexCharts(document.getElementById('pipelineChart'), {
            series: pipelineData.map(d => d.value),
            chart: {
                type: 'pie',
                height: 300,
                background: 'transparent',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                foreColor: '#e5e5e5',
                toolbar: {
                    show: false
                }
            },
            labels: pipelineData.map(d => d.label),
            colors: ['#27ae60', '#3498db', '#e74c3c', '#f39c12', '#9b59b6'],
            stroke: {
                width: 2,
                colors: ['#2d2d2d']
            },
            dataLabels: {
                enabled: true,
                style: {
                    fontSize: '10px',
                    colors: ['#ffffff']
                },
                formatter: function (val, opts) {
                    return '$' + Math.round(opts.w.config.series[opts.seriesIndex] / 1000) + 'K';
                }
            },
            legend: {
                position: 'bottom',
                fontSize: '12px',
                labels: {
                    colors: '#b5b5b5'
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function (val) {
                        return '$' + val.toLocaleString();
                    }
                }
            }
        });

        pipelineChart.render();
        
        // Progress Overview Chart using ApexCharts
        const progressChart = new ApexCharts(document.getElementById('progressChart'), {
            series: [{
                name: 'Revenue',
                data: [data.closedWon, Math.max(0, data.q3Target - data.closedWon)]
            }],
            chart: {
                type: 'bar',
                height: 300,
                background: 'transparent',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                foreColor: '#e5e5e5',
                toolbar: {
                    show: false
                }
            },
            xaxis: {
                categories: ['Closed Won', 'Remaining to Goal'],
                labels: {
                    style: {
                        colors: '#b5b5b5',
                        fontSize: '11px'
                    }
                }
            },
            yaxis: {
                labels: {
                    formatter: function (val) {
                        return '$' + Math.round(val / 1000) + 'K';
                    },
                    style: {
                        colors: '#b5b5b5',
                        fontSize: '11px'
                    }
                },
                title: {
                    text: 'Revenue ($)',
                    style: {
                        color: '#b5b5b5',
                        fontSize: '12px'
                    }
                }
            },
            colors: ['#27ae60', '#f1c40f'],
            dataLabels: {
                enabled: true,
                style: {
                    fontSize: '10px',
                    colors: ['#ffffff']
                },
                formatter: function (val) {
                    return '$' + Math.round(val / 1000) + 'K';
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function (val) {
                        return '$' + val.toLocaleString();
                    }
                }
            },
            grid: {
                borderColor: '#404040'
            }
        });

        progressChart.render();
        
        // Pipeline Progress Chart using ApexCharts - showing all 4 pipeline types
        const pipelineData = data.pipelineBreakdown || {};
        const pipelineCategories = Object.keys(pipelineData);
        const currentData = pipelineCategories.map(key => pipelineData[key].current);
        const goalData = pipelineCategories.map(key => pipelineData[key].goal);
        
        const pipelineProgressChart = new ApexCharts(document.getElementById('pipelineProgressChart'), {
            series: [
                {
                    name: 'Current Progress',
                    data: currentData
                },
                {
                    name: 'Q3 Goal',
                    data: goalData
                }
            ],
            chart: {
                type: 'bar',
                height: 400,
                background: 'transparent',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                foreColor: '#e5e5e5',
                toolbar: {
                    show: false
                }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: '70%',
                    grouped: true
                }
            },
            xaxis: {
                categories: pipelineCategories,
                labels: {
                    formatter: function (val) {
                        return '$' + Math.round(val / 1000) + 'K';
                    },
                    style: {
                        colors: '#b5b5b5',
                        fontSize: '11px'
                    }
                },
                title: {
                    text: 'Amount ($)',
                    style: {
                        color: '#b5b5b5',
                        fontSize: '12px'
                    }
                }
            },
            yaxis: {
                title: {
                    text: 'Pipeline Type',
                    style: {
                        color: '#b5b5b5',
                        fontSize: '12px'
                    }
                },
                labels: {
                    style: {
                        colors: '#b5b5b5',
                        fontSize: '11px'
                    }
                }
            },
            colors: ['#27ae60', '#404040'],
            dataLabels: {
                enabled: true,
                style: {
                    fontSize: '10px',
                    colors: ['#ffffff']
                },
                formatter: function (val, opts) {
                    if (opts.seriesIndex === 0 && val > 0) {
                        const current = val;
                        const goal = goalData[opts.dataPointIndex];
                        const percentage = goal > 0 ? Math.round((current / goal) * 100) : 100;
                        return percentage + '%';
                    }
                    return '';
                }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: function (val) {
                        return '$' + val.toLocaleString();
                    }
                }
            },
            legend: {
                position: 'top',
                labels: {
                    colors: '#b5b5b5'
                }
            },
            grid: {
                borderColor: '#404040'
            }
        });

        pipelineProgressChart.render();
    </script>
</body>
</html>`;
  }

  /**
   * Format values based on type
   */
  formatValue(value, format) {
    switch (format) {
      case 'currency':
        return '$' + value.toLocaleString();
      case 'currency-per-day':
        return '$' + value.toLocaleString() + '/day';
      case 'percent':
        return value.toFixed(1) + '%';
      case 'number':
        return value.toLocaleString();
      default:
        return value;
    }
  }

  /**
   * Create Treemap Chart
   * @param {Array} data - Treemap data
   * @param {Object} config - Configuration
   */
  async createTreemap(data, config) {
    const filename = `${config.filename}.html`;
    const localPath = join(this.outputDir, filename);

    // Generate HTML with ApexCharts treemap
    const html = this.generateTreemapHTML(data, config);

    // Ensure output directory exists
    mkdirSync(this.outputDir, { recursive: true });

    // Save HTML file
    writeFileSync(localPath, html);
    console.log(`✅ Treemap chart saved: ${localPath}`);

    return {
      chartId: config.filename,
      localPath,
      filename,
      url: `/viz/${filename}`,
      title: config.title || 'Treemap'
    };
  }

  /**
   * Generate Treemap HTML
   */
  generateTreemapHTML(data, config) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title || 'Treemap'}</title>
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #0a0a0a;
            color: #e5e5e5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        h1 {
            margin: 0 0 20px 0;
            font-size: 24px;
            font-weight: 600;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .customer-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }

        .tab-btn {
            padding: 8px 16px;
            background: #1a1a1a;
            border: 1px solid #333;
            color: #999;
            border-radius: 0;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
        }

        .tab-btn:hover {
            background: #2a2a2a;
            color: #fff;
            border-color: #555;
        }

        .tab-btn.active {
            background: #667eea;
            color: #fff;
            border-color: #667eea;
        }

        #chart {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 0;
            padding: 20px;
            min-height: 600px;
        }

        .chart-info {
            margin-top: 20px;
            padding: 15px;
            background: #1a1a1a;
            border: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .info-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .info-label {
            font-size: 12px;
            color: #999;
            margin-bottom: 5px;
        }

        .info-value {
            font-size: 20px;
            font-weight: 600;
            color: #667eea;
        }
    </style>
</head>
<body>
    <h1>${config.title || 'Customer Event Treemap'}</h1>

    ${config.showTabs ? `
    <div class="customer-tabs" id="customerTabs">
        <!-- Tabs will be generated dynamically -->
    </div>
    ` : ''}

    <div id="chart"></div>

    <div class="chart-info" id="chartInfo">
        <!-- Info will be updated dynamically -->
    </div>

    <script>
        // Data structure for all customers
        const customersData = ${JSON.stringify(data)};

        // Current customer index
        let currentCustomerIndex = 0;

        // Chart instance
        let chart = null;

        // Initialize tabs if needed
        ${config.showTabs ? `
        function initializeTabs() {
            const tabsContainer = document.getElementById('customerTabs');
            customersData.forEach((customer, index) => {
                const tab = document.createElement('button');
                tab.className = 'tab-btn' + (index === 0 ? ' active' : '');
                tab.textContent = customer.name;
                tab.onclick = () => selectCustomer(index);
                tabsContainer.appendChild(tab);
            });
        }
        ` : ''}

        // Select customer and update chart
        function selectCustomer(index) {
            currentCustomerIndex = index;

            // Update tab states
            ${config.showTabs ? `
            document.querySelectorAll('.tab-btn').forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            ` : ''}

            // Update chart
            updateChart();
        }

        // Update chart with current customer data
        function updateChart() {
            const customerData = customersData[currentCustomerIndex];

            // Update chart options
            const options = {
                series: [{
                    data: customerData.events || customerData.data || []
                }],
                chart: {
                    type: 'treemap',
                    height: 600,
                    background: '#0a0a0a',
                    foreColor: '#e5e5e5',
                    toolbar: {
                        show: true,
                        tools: {
                            download: true,
                            selection: false,
                            zoom: false,
                            zoomin: false,
                            zoomout: false,
                            pan: false,
                            reset: false
                        }
                    }
                },
                title: {
                    text: customerData.name || 'Event Distribution',
                    align: 'left',
                    style: {
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#e5e5e5'
                    }
                },
                dataLabels: {
                    enabled: true,
                    style: {
                        fontSize: '12px'
                    },
                    formatter: function(text, op) {
                        return [text, op.value.toLocaleString()];
                    },
                    offsetY: -4
                },
                plotOptions: {
                    treemap: {
                        enableShades: true,
                        shadeIntensity: 0.5,
                        reverseNegativeShade: true,
                        colorScale: {
                            ranges: ${JSON.stringify(config.colorRanges || [
                                { from: 0, to: 100, color: '#4B5563' },
                                { from: 101, to: 500, color: '#6366F1' },
                                { from: 501, to: 1000, color: '#8B5CF6' },
                                { from: 1001, to: 5000, color: '#A855F7' },
                                { from: 5001, to: 99999, color: '#C084FC' }
                            ])}
                        }
                    }
                },
                legend: {
                    show: ${config.showLegend !== false},
                    position: 'top',
                    horizontalAlign: 'right',
                    fontSize: '12px',
                    labels: {
                        colors: '#999'
                    }
                },
                tooltip: {
                    theme: 'dark',
                    y: {
                        formatter: function(value) {
                            return value.toLocaleString() + ' events';
                        }
                    }
                },
                theme: {
                    mode: 'dark'
                }
            };

            // Destroy existing chart if it exists
            if (chart) {
                chart.destroy();
            }

            // Create new chart
            chart = new ApexCharts(document.querySelector("#chart"), options);
            chart.render();

            // Update info
            updateInfo(customerData);
        }

        // Update info panel
        function updateInfo(customerData) {
            const infoContainer = document.getElementById('chartInfo');
            const totalEvents = (customerData.events || customerData.data || [])
                .reduce((sum, item) => sum + (item.y || 0), 0);
            const eventTypes = (customerData.events || customerData.data || []).length;

            infoContainer.innerHTML = \`
                <div class="info-item">
                    <div class="info-label">Total Events</div>
                    <div class="info-value">\${totalEvents.toLocaleString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Event Types</div>
                    <div class="info-value">\${eventTypes}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Plan</div>
                    <div class="info-value">\${customerData.plan || 'N/A'}</div>
                </div>
            \`;
        }

        // Initialize on load
        document.addEventListener('DOMContentLoaded', () => {
            ${config.showTabs ? 'initializeTabs();' : ''}
            updateChart();
        });
    </script>
</body>
</html>`;
  }

  assignYAxisToSeries(series) {
    const processedSeries = series.map(s => {
      if (s.name.toLowerCase().includes('revenue') ||
          s.name.toLowerCase().includes('collected') ||
          s.name.toLowerCase().includes('payment')) {
        return { ...s, yAxisIndex: 1 };
      } else {
        return { ...s, yAxisIndex: 0 };
      }
    });
    return JSON.stringify(processedSeries);
  }

  generateYAxisConfig(config, series) {
    const hasRevenueSeries = series.some(s =>
      s.name.toLowerCase().includes('revenue') ||
      s.name.toLowerCase().includes('collected') ||
      s.name.toLowerCase().includes('payment')
    );

    if (hasRevenueSeries) {
      const countSeries = [];
      const revenueSeries = [];

      series.forEach((s, index) => {
        if (s.name.toLowerCase().includes('revenue') ||
            s.name.toLowerCase().includes('collected') ||
            s.name.toLowerCase().includes('payment')) {
          revenueSeries.push({ ...s, yAxisIndex: 1 });
        } else {
          countSeries.push({ ...s, yAxisIndex: 0 });
        }
      });

      // Return dual y-axis configuration
      return JSON.stringify([
        {
          seriesName: countSeries.map(s => s.name),
          title: {
            text: config.yaxisTitle || 'Count',
            style: { color: '#e5e5e5' }
          },
          labels: {
            style: { colors: '#999' },
            formatter: function (val) {
              return val ? val.toLocaleString() : '';
            }
          }
        },
        {
          seriesName: revenueSeries.map(s => s.name),
          opposite: true,
          title: {
            text: 'Revenue ($)',
            style: { color: '#e5e5e5' }
          },
          labels: {
            style: { colors: '#999' },
            formatter: function (val) {
              return val ? '$' + val.toLocaleString() : '';
            }
          }
        }
      ]);
    } else {
      // Return single y-axis configuration
      return JSON.stringify({
        title: {
          text: config.yaxisTitle || 'Value',
          style: { color: '#e5e5e5' }
        },
        labels: {
          style: { colors: '#999' },
          formatter: function (val) {
            return config.formatAsCurrency ?
              (val ? '$' + val.toLocaleString() : '') :
              (val ? val.toLocaleString() : '');
          }
        }
      });
    }
  }
}
