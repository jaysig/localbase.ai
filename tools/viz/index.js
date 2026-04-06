/**
 * Unified Visualization Factory - Standardizes all visualization creation
 * Supports ApexCharts and Chart.js with consistent interface
 */

import { ApexChartsService } from './apexcharts.js';
import { ApexGridService } from './apexgrid.js';
import { ChartJSVennService } from './chartjs-venn.js';
import { HighchartsService } from './highcharts.js';
import { VizRegistry } from './registry.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class VizFactory {
  constructor(options = {}) {
    this.baseDir = options.baseDir || 'web-app';
    this.vizDir = join(this.baseDir, 'viz');
    this.registry = new VizRegistry(this.baseDir);

    // Initialize viz services - point to viz subdirectory
    this.apexcharts = new ApexChartsService({ outputDir: this.vizDir });
    this.apexgrid = new ApexGridService({ outputDir: this.vizDir });
    this.chartjsVenn = new ChartJSVennService({ outputDir: this.vizDir });
    this.highcharts = new HighchartsService({ outputDir: this.vizDir });

    // Ensure directories exist
    mkdirSync(this.vizDir, { recursive: true });
  }

  /**
   * Create visualization with unified interface
   */
  async create(type, config) {
    // Start TTV timer
    const startTime = Date.now();

    // Standardize config
    const standardConfig = this.standardizeConfig(config);

    let result;

    switch (type.toLowerCase()) {
      case 'apexcharts':
      case 'apex':
      case 'line':
      case 'multiline':
        result = await this.createApexChart(standardConfig);
        break;

      case 'dashboard':
      case 'modern-dashboard':
        result = await this.createModernDashboard(standardConfig);
        break;

      case 'chart':
      case 'industry':
      case 'bubble':
        // Use ApexCharts instead of D3
        result = await this.createApexChart(standardConfig);
        break;

      case 'table':
        result = await this.createTable(standardConfig);
        break;

      case 'grid':
      case 'apexgrid':
      case 'datagrid':
        result = await this.createApexGrid(standardConfig);
        break;

      case 'treemap':
        result = await this.createTreemap(standardConfig);
        break;

      case 'venn':
      case 'venndiagram':
        result = await this.createVennDiagram(standardConfig);
        break;

      case 'sunburst':
      case 'highcharts':
        result = await this.createHighcharts(standardConfig);
        break;

      default:
        throw new Error(`Unknown visualization type: ${type}`);
    }

    // Calculate TTV (Time to Viz)
    const endTime = Date.now();
    const ttv = endTime - startTime;
    result.ttv = ttv;

    // Log TTV for performance tracking
    console.log(`⚡ TTV: ${ttv}ms - ${result.title || result.filename}`);

    // Register visualization automatically
    await this.registry.register(result);

    return result;
  }

  /**
   * Generate random ID for visualization
   */
  generateRandomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate consistent ID based on filename
   */
  generateConsistentId(filename) {
    // Create a simple hash of the filename for consistency
    let hash = 0;
    const cleanFilename = filename.replace(/\.(html|js)$/, ''); // Remove extensions

    for (let i = 0; i < cleanFilename.length; i++) {
      const char = cleanFilename.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to base36 and take first 6 characters
    const id = Math.abs(hash).toString(36).substring(0, 6);
    return id.padEnd(6, '0'); // Ensure 6 characters
  }

  /**
   * Standardize configuration across all visualization types
   */
  standardizeConfig(config) {
    const timestamp = Date.now();
    const type = config.type || 'visualization';
    const description = config.description || config.title || 'untitled';
    const slug = description.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);

    // Use consistent ID based on filename if provided, otherwise generate random
    const consistentId = config.filename ?
      this.generateConsistentId(config.filename) :
      (config.id || this.generateRandomId());

    return {
      ...config,
      id: consistentId,
      filename: config.filename || `${type}-${slug}-${timestamp}`,
      title: config.title || description,
      type: config.type || 'visualization',
      timestamp,
      date: new Date().toISOString()
    };
  }

  /**
   * Create Modern Dashboard with multiple charts and KPIs
   */
  async createModernDashboard(config) {
    const result = await this.apexcharts.createModernDashboard(config.data, config);

    return {
      id: config.id,
      chartId: result.chartId,
      filename: result.filename,
      title: config.title,
      type: 'dashboard',
      library: 'apexcharts',
      localPath: result.localPath,
      url: `/viz/${result.filename}`,
      size: this.getFileSize(result.localPath),
      date: config.date,
      createdAt: config.date
    };
  }

  /**
   * Create ApexCharts visualization
   */
  async createApexChart(config) {
    // Route to appropriate chart type
    let result;

    if (config.type === 'scatter' || config.type === 'correlation') {
      result = await this.apexcharts.createScatterChart(config.data, config);
    } else if (config.type === 'chart' || config.chart?.type === 'line' || config.chart?.type === 'multiline' || config.type === 'line' || config.type === 'multiline') {
      result = await this.apexcharts.createMultiLineChart(config.data, config);
    } else {
      // Default to multi-line chart for all other types
      result = await this.apexcharts.createMultiLineChart(config.data, config);
    }

    return {
      id: config.id,
      chartId: result.chartId,
      filename: result.filename,
      title: config.title,
      type: config.type || 'dashboard',
      library: 'apexcharts',
      localPath: result.localPath,
      url: `/viz/${result.filename}`,
      size: this.getFileSize(result.localPath),
      date: config.date,
      createdAt: config.date
    };
  }

  /**
   * Simple multiline chart generator using template
   * This is a lightweight alternative to the full ApexCharts service
   */
  async generateMultilineChart(config) {
    const fs = require('fs');
    const path = require('path');

    const {
      title,
      series,
      categories,
      colors = ['#FFEB3B', '#2196F3', '#FF9800', '#E91E63', '#4CAF50'],
      yAxisConfig = null,
      outputPath = null
    } = config;

    // Read template
    const templatePath = './tools/templates/multiline-chart-template.html';
    let template = fs.readFileSync(templatePath, 'utf8');

    // Generate unique ID
    const chartId = this.generateRandomId();

    // Generate series data with colors
    const seriesData = series.map((serie, index) => ({
      name: serie.name,
      data: serie.data,
      color: colors[index % colors.length],
      yAxisIndex: serie.yAxisIndex || 0
    }));

    // Generate legend items
    const legendItems = seriesData.map(serie =>
      `<div class="legend-item" data-series="${serie.name}" style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="toggleSeries('${serie.name}')">
          <div class="legend-marker" style="width: 12px; height: 12px; border-radius: 50%; background-color: ${serie.color};"></div>
          <span style="color: #e5e5e5; font-size: 14px; font-family: -apple-system, system-ui, sans-serif;">${serie.label || serie.name}</span>
      </div>`
    ).join('\n            ');

    // Generate series visibility object
    const seriesVisibility = {};
    seriesData.forEach(serie => {
      seriesVisibility[serie.name] = true;
    });

    // Default Y-axis config
    const defaultYAxis = [
      {
        seriesName: seriesData.filter(s => s.yAxisIndex === 0).map(s => s.name),
        title: { text: "Count", style: { color: "#e5e5e5" } },
        labels: { style: { colors: "#999" } }
      }
    ];

    // Check if there are secondary axis series
    const hasSecondaryAxis = seriesData.some(s => s.yAxisIndex === 1);
    if (hasSecondaryAxis) {
      defaultYAxis.push({
        seriesName: seriesData.filter(s => s.yAxisIndex === 1).map(s => s.name),
        opposite: true,
        title: { text: "Value ($)", style: { color: "#e5e5e5" } },
        labels: { style: { colors: "#999" } }
      });
    }

    // Replace template variables
    template = template
      .replace(/{{CHART_TITLE}}/g, title)
      .replace(/{{SERIES_DATA}}/g, JSON.stringify(seriesData))
      .replace(/{{CATEGORIES}}/g, JSON.stringify(categories))
      .replace(/{{LEGEND_ITEMS}}/g, legendItems)
      .replace(/{{SERIES_VISIBILITY}}/g, JSON.stringify(seriesVisibility))
      .replace(/{{ORIGINAL_SERIES}}/g, JSON.stringify(seriesData.map(s => ({ name: s.name, data: s.data, color: s.color }))))
      .replace(/{{Y_AXIS_CONFIG}}/g, JSON.stringify(yAxisConfig || defaultYAxis));

    // Generate output path
    const filename = outputPath || `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${chartId}.html`;
    const fullPath = path.join(this.vizDir, filename);

    // Write file
    fs.writeFileSync(fullPath, template);

    // Register in visualizations.json
    const vizPath = path.join(this.vizDir, 'visualizations.json');
    let vizData = { visualizations: [], lastUpdated: new Date().toISOString(), totalVisualizations: 0, totalViews: 0 };

    if (fs.existsSync(vizPath)) {
      vizData = JSON.parse(fs.readFileSync(vizPath, 'utf8'));
    }

    const vizEntry = {
      id: chartId,
      filename: filename,
      title: title,
      type: "line",
      library: "apexcharts",
      url: `/api/viz/${chartId}`,
      size: 0,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      views: 0,
      lastViewed: null
    };

    vizData.visualizations.unshift(vizEntry);
    vizData.lastUpdated = new Date().toISOString();
    vizData.totalVisualizations = vizData.visualizations.length;

    fs.writeFileSync(vizPath, JSON.stringify(vizData, null, 2));

    console.log(`✅ Generated multiline chart: ${title}`);
    console.log(`📂 File: ${fullPath}`);
    console.log(`🔗 URL: http://localhost:3000/viz/${chartId}`);

    return { chartId, filename, fullPath, url: `/viz/${chartId}` };
  }


  /**
   * Create ApexGrid data table
   */
  async createApexGrid(config) {
    const result = await this.apexgrid.createGrid(config.data, config);

    return {
      id: config.id,
      chartId: result.gridId,
      filename: result.filename,
      title: config.title,
      type: 'grid',
      library: 'apexgrid',
      localPath: result.localPath,
      url: `/viz/${result.filename}`,
      size: this.getFileSize(result.localPath),
      date: config.date,
      createdAt: config.date
    };
  }

  /**
   * Create Treemap visualization
   */
  async createTreemap(config) {
    const result = await this.apexcharts.createTreemap(config.data, config);

    return {
      id: config.id,
      chartId: result.chartId,
      filename: result.filename,
      title: config.title,
      type: 'treemap',
      library: 'apexcharts',
      localPath: result.localPath,
      url: `/viz/${result.filename}`,
      size: this.getFileSize(result.localPath),
      date: config.date,
      createdAt: config.date
    };
  }

  /**
   * Create Venn diagram visualization
   */
  async createVennDiagram(config) {
    const result = await this.chartjsVenn.generate(config, {
      id: config.id,
      title: config.title,
      description: config.description
    });

    return {
      id: config.id,
      chartId: result.id,
      filename: result.filename,
      title: config.title,
      type: 'venn',
      library: 'chartjs-venn',
      localPath: join(this.vizDir, result.filename),
      url: `/viz/${result.filename}`,
      size: this.getFileSize(join(this.vizDir, result.filename)),
      date: config.date,
      createdAt: config.date
    };
  }

  /**
   * Create simple HTML table visualization
   */
  /**
   * Create Highcharts visualization
   */
  async createHighcharts(config) {
    // Ensure chart type is passed to Highcharts service
    const highchartsConfig = { ...config, chartType: 'sunburst' };
    return await this.highcharts.create(highchartsConfig);
  }

  async createTable(config) {
    const filename = `${config.name || 'table'}.html`;
    const filePath = join(this.vizDir, filename);

    // Create complete HTML document for the table
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title || 'Table Visualization'}</title>
    ${config.html.includes('<style>') ? '' : `<style>
        body {
            background: #1a1a1a;
            color: #e5e5e5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 20px;
            margin: 0;
        }
    </style>`}
</head>
<body>
    ${config.html}
</body>
</html>`;

    // Write the HTML file
    writeFileSync(filePath, fullHtml);

    return {
      id: config.id,
      chartId: `table-${config.name}`,
      filename: filename,
      title: config.title,
      type: 'table',
      library: 'html',
      localPath: filePath,
      url: `/viz/${filename}`,
      size: this.getFileSize(filePath),
      date: config.date,
      createdAt: config.date,
      tags: config.tags || ['table'],
      description: config.description || 'Table visualization'
    };
  }


  /**
   * Generate basic HTML for visualizations if not provided
   */
  generateBasicHTML(config) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>${config.title}</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, sans-serif;
            padding: 20px;
            background: #fafafa;
        }
        .visualization {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .meta {
            color: #666;
            font-size: 14px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="visualization">
        <h1>${config.title}</h1>
        <p>Chart ready for data visualization using ${config.type} format.</p>
        <div class="meta">
            <p><strong>Library:</strong> Chart Factory</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Visualization ID:</strong> ${config.filename}</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get file size helper
   */
  getFileSize(filePath) {
    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * List all visualizations
   */
  async listVisualizations() {
    return await this.registry.getAll();
  }

  /**
   * Get visualization by ID
   */
  async getVisualization(vizId) {
    return await this.registry.get(vizId);
  }

  /**
   * Delete visualization
   */
  async deleteVisualization(vizId) {
    await this.registry.unregister(vizId);
  }

  /**
   * Clean up old visualizations (keep last N)
   */
  async cleanup(keepCount = 10) {
    await this.registry.cleanup(keepCount);
  }
}
