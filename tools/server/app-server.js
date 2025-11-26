#!/usr/bin/env node

/**
 * LocalBase Insights Unified Server
 * Serves static files + handles visualization management API
 */

import express from 'express';
import { join, dirname, basename, normalize } from 'path';
import { fileURLToPath } from 'url';
import { VizRegistry } from '../viz/registry.js';
import { unlinkSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import cors from 'cors';
import { execSync } from 'child_process';
import {
  detectWorkspaces,
  getCurrentWorkspace,
  setCurrentWorkspace,
  getConfigPath
} from './workspace-config.js';
// import { CompanyCamConnector } from '../../connectors/companycam/index.js'; // REMOVED
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Get current workspace from persistent config
let currentWorkspace = getCurrentWorkspace();

// Detect if running from framework (localbase.ai) vs instance
// Check if process.cwd() matches the directory containing this script
const cwd = process.cwd();
const scriptDir = dirname(__dirname); // tools/server -> up 2 levels from __dirname
const isFrameworkMode = cwd === scriptDir;

// Detect app directory (web-app/ for newer instances, app/ for older ones)
function getAppDir(workspace) {
  const webAppDir = join(workspace, 'web-app');
  const appDir = join(workspace, 'app');
  return existsSync(join(webAppDir, 'index.html')) ? webAppDir : appDir;
}

// In framework mode, always serve from framework's web-app directory
let appDir = isFrameworkMode ? join(cwd, 'web-app') : getAppDir(currentWorkspace);

// Middleware - Allow CORS for Electron (null origin) and regular browsers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(cors());
app.use(express.json());

// Initialize registry (will be re-initialized on workspace change)
let registry = new VizRegistry(appDir);

console.log(`📁 Current workspace: ${currentWorkspace}`);
console.log(`📁 Config file: ${getConfigPath()}`);
console.log(`📁 Registry path: ${registry.registryPath}`);
if (isFrameworkMode) {
  console.log(`⚠️  Framework mode detected - serving onboarding page`);
}

/**
 * Switch to a different workspace
 */
function switchWorkspace(workspacePath) {
  currentWorkspace = workspacePath;
  appDir = getAppDir(currentWorkspace);

  // Re-initialize registry
  registry = new VizRegistry(appDir);

  // Persist workspace selection
  setCurrentWorkspace(workspacePath);

  console.log(`🔄 Switched to workspace: ${currentWorkspace}`);
  console.log(`📁 New registry path: ${registry.registryPath}`);
}

/**
 * GET /api/marketing-spend
 * Get marketing spend data from Google Ads, Facebook Ads, and Invoices
 * ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/marketing-spend', (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'startDate and endDate are required'
    });
  }

  console.log(`📊 Marketing spend request: ${startDate} to ${endDate}`);

  try {
    const result = businessFunnelAPI.getMarketingSpendByDates(startDate, endDate);

    console.log(`✅ Returned ${result.total} data points`);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error(`❌ Marketing spend API error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/media-correlation/roas
 * Run ROAS analysis for a specific date range
 * ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&useLag=true|false
 */
app.get('/api/media-correlation/roas', async (req, res) => {
  const { startDate, endDate, useLag } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'startDate and endDate query parameters required'
    });
  }

  const useLagBool = useLag !== 'false'; // Default to true

  console.log(`📊 ROAS analysis request: ${startDate} to ${endDate} (lag: ${useLagBool})`);

  try {
    // Import and run the analysis from current workspace
    const analysisPath = join(currentWorkspace, 'projects/lead-lag-indicator/analysis/run-roas-by-date-range.js');
    const { runROASByDateRange } = await import(analysisPath);
    const results = runROASByDateRange(startDate, endDate, useLagBool);

    // Calculate totals
    // Note: totalSpend sums across channels (each channel has different spend)
    // But each pipeline within a channel has the SAME spend (spend is channel-level, not pipeline-level)
    // So we only sum the first pipeline's spend for each channel
    // totalRevenue and totalDeals should NOT be summed across channels (same deals attributed to all channels)
    let totalSpend = 0;

    Object.values(results).forEach(channelData => {
      // Only take spend from first pipeline (all pipelines in a channel have same spend)
      const firstPipeline = Object.values(channelData)[0];
      if (firstPipeline) {
        totalSpend += firstPipeline.spend;
      }
    });

    // Get actual revenue and deal count from first channel (they're all the same)
    const firstChannel = Object.values(results)[0];
    let actualRevenue = 0;
    let actualDeals = 0;

    Object.values(firstChannel).forEach(metrics => {
      actualRevenue += metrics.revenue;
      actualDeals += metrics.deals;
    });

    console.log(`✅ ROAS analysis complete: $${actualRevenue.toFixed(0)} revenue, ${actualDeals} deals, $${totalSpend.toFixed(0)} spend`);

    res.json({
      success: true,
      data: results,
      summary: {
        totalSpend,
        totalRevenue: actualRevenue,
        totalDeals: actualDeals,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error(`❌ ROAS analysis error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/call-metrics
 * Get call metrics from RingCentral data
 * ?range=today|yesterday|last7days|last30days|mtd|ytd|all
 */
app.get('/api/call-metrics', (req, res) => {
  const { range, startDate: customStart, endDate: customEnd } = req.query;

  console.log(`📞 Call metrics request: range=${range}, customStart=${customStart}, customEnd=${customEnd}`);

  try {
    const db = new Database(join(currentWorkspace, 'data/ringcentral/ringcentral.db'));

    let startDate, endDate, previousStartDate, previousEndDate;
    const today = new Date();

    // Handle custom date range
    if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;

      // Calculate previous period (same length)
      const start = new Date(customStart);
      const end = new Date(customEnd);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - diffDays);

      previousStartDate = prevStart.toISOString().split('T')[0];
      previousEndDate = prevEnd.toISOString().split('T')[0];
    } else {

    switch(range) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
        previousStartDate = new Date(today);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousEndDate = previousStartDate.toISOString().split('T')[0];
        previousStartDate = previousEndDate;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = startDate;
        const dayBefore = new Date(yesterday);
        dayBefore.setDate(dayBefore.getDate() - 1);
        previousStartDate = dayBefore.toISOString().split('T')[0];
        previousEndDate = previousStartDate;
        break;
      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        startDate = sevenDaysAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        previousStartDate = fourteenDaysAgo.toISOString().split('T')[0];
        previousEndDate = sevenDaysAgo.toISOString().split('T')[0];
        break;
      case 'last30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        previousStartDate = sixtyDaysAgo.toISOString().split('T')[0];
        previousEndDate = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      case 'lastmonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        startDate = lastMonthStart.toISOString().split('T')[0];
        endDate = lastMonthEnd.toISOString().split('T')[0];
        const twoMonthsAgoStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const twoMonthsAgoEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
        previousStartDate = twoMonthsAgoStart.toISOString().split('T')[0];
        previousEndDate = twoMonthsAgoEnd.toISOString().split('T')[0];
        break;
      case 'mtd':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        previousStartDate = prevMonthStart.toISOString().split('T')[0];
        previousEndDate = prevMonthEnd.toISOString().split('T')[0];
        break;
      case 'ytd':
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        previousStartDate = lastYearStart.toISOString().split('T')[0];
        previousEndDate = lastYearEnd.toISOString().split('T')[0];
        break;
      case 'all':
        startDate = '2020-01-01';
        endDate = today.toISOString().split('T')[0];
        previousStartDate = null;
        previousEndDate = null;
        break;
      default:
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        startDate = startDate.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        previousStartDate = null;
        previousEndDate = null;
    }
    } // Close the else block for custom date handling

    // Get current period metrics
    const current = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as conversations,
        SUM(CASE WHEN call_length >= 120 THEN 1 ELSE 0 END) as twoMinCalls,
        SUM(CASE WHEN call_length >= 300 THEN 1 ELSE 0 END) as fiveMinCalls,
        AVG(call_length) as avgDuration
      FROM calls
      WHERE result = 'Connected'
        AND DATE(call_start_time) >= ?
        AND DATE(call_start_time) <= ?
    `).get(startDate, endDate);

    current.conversationRate = current.totalCalls > 0 ? (current.conversations / current.totalCalls * 100) : 0;

    // Get warm (known leads) vs cold call connect rates
    const warmStats = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as connects
      FROM calls
      WHERE result = 'Connected'
        AND is_customer_call = 1
        AND DATE(call_start_time) >= ?
        AND DATE(call_start_time) <= ?
    `).get(startDate, endDate);

    const coldStats = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as connects
      FROM calls
      WHERE result = 'Connected'
        AND is_customer_call = 0
        AND DATE(call_start_time) >= ?
        AND DATE(call_start_time) <= ?
    `).get(startDate, endDate);

    current.warmCalls = warmStats.totalCalls || 0;
    current.warmConnects = warmStats.connects || 0;
    current.warmConnectRate = warmStats.totalCalls > 0 ? (warmStats.connects / warmStats.totalCalls * 100) : 0;
    current.coldCalls = coldStats.totalCalls || 0;
    current.coldConnects = coldStats.connects || 0;
    current.coldConnectRate = coldStats.totalCalls > 0 ? (coldStats.connects / coldStats.totalCalls * 100) : 0;

    // Get top caller for current period
    const topCaller = db.prepare(`
      SELECT from_user, COUNT(*) as call_count
      FROM calls
      WHERE result = 'Connected'
        AND DATE(call_start_time) >= ?
        AND DATE(call_start_time) <= ?
        AND from_user IS NOT NULL
      GROUP BY from_user
      ORDER BY call_count DESC
      LIMIT 1
    `).get(startDate, endDate);

    current.topCaller = topCaller?.from_user || '-';
    current.topCallerCalls = topCaller?.call_count || 0;

    // Get daily breakdown for sparkline
    const daily = db.prepare(`
      SELECT
        DATE(call_start_time) as date,
        COUNT(*) as total_calls
      FROM calls
      WHERE result = 'Connected'
        AND DATE(call_start_time) >= ?
        AND DATE(call_start_time) <= ?
      GROUP BY DATE(call_start_time)
      ORDER BY date ASC
    `).all(startDate, endDate);

    // Get previous period metrics if applicable
    let previous = null;
    if (previousStartDate && previousEndDate) {
      previous = db.prepare(`
        SELECT
          COUNT(*) as totalCalls,
          SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as conversations,
          SUM(CASE WHEN call_length >= 120 THEN 1 ELSE 0 END) as twoMinCalls,
          SUM(CASE WHEN call_length >= 300 THEN 1 ELSE 0 END) as fiveMinCalls,
          AVG(call_length) as avgDuration
        FROM calls
        WHERE result = 'Connected'
          AND DATE(call_start_time) >= ?
          AND DATE(call_start_time) <= ?
      `).get(previousStartDate, previousEndDate);

      previous.conversationRate = previous.totalCalls > 0 ? (previous.conversations / previous.totalCalls * 100) : 0;

      // Get warm vs cold for previous period
      const prevWarmStats = db.prepare(`
        SELECT
          COUNT(*) as totalCalls,
          SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as connects
        FROM calls
        WHERE result = 'Connected'
          AND is_customer_call = 1
          AND DATE(call_start_time) >= ?
          AND DATE(call_start_time) <= ?
      `).get(previousStartDate, previousEndDate);

      const prevColdStats = db.prepare(`
        SELECT
          COUNT(*) as totalCalls,
          SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as connects
        FROM calls
        WHERE result = 'Connected'
          AND is_customer_call = 0
          AND DATE(call_start_time) >= ?
          AND DATE(call_start_time) <= ?
      `).get(previousStartDate, previousEndDate);

      previous.warmCalls = prevWarmStats.totalCalls || 0;
      previous.warmConnects = prevWarmStats.connects || 0;
      previous.warmConnectRate = prevWarmStats.totalCalls > 0 ? (prevWarmStats.connects / prevWarmStats.totalCalls * 100) : 0;
      previous.coldCalls = prevColdStats.totalCalls || 0;
      previous.coldConnects = prevColdStats.connects || 0;
      previous.coldConnectRate = prevColdStats.totalCalls > 0 ? (prevColdStats.connects / prevColdStats.totalCalls * 100) : 0;
    }

    db.close();

    console.log(`✅ Returned call metrics: ${current.totalCalls} calls, ${current.conversations} conversations`);

    res.json({
      success: true,
      current,
      previous,
      daily,
      dateRange: { start: startDate, end: endDate }
    });

  } catch (error) {
    console.error(`❌ Call metrics API error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/:metricId
 * Generic metrics API endpoint (FRAMEWORK CODE)
 * Reads metrics configuration from instance's metrics-config.js
 */
app.get('/api/metrics/:metricId', async (req, res) => {
  try {
    const { metricId } = req.params;
    const { startDate, endDate } = req.query;

    // Load metrics config from current workspace
    const metricsConfigPath = join(currentWorkspace, 'metrics-config.js');
    if (!existsSync(metricsConfigPath)) {
      return res.status(500).json({ error: 'Metrics configuration not found in workspace' });
    }

    const { default: metricsConfig } = await import(`file://${metricsConfigPath}`);
    const metric = metricsConfig.metrics[metricId];

    if (!metric) {
      return res.status(404).json({ error: `Metric '${metricId}' not found` });
    }

    // Open database connection (resolve path relative to workspace)
    const dbPath = join(currentWorkspace, metric.database);
    const db = new Database(dbPath, { readonly: true });

    try {
      // Execute query with date parameters if provided
      const params = {};
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const stmt = db.prepare(metric.query);
      const result = stmt.get(params);

      db.close();

      res.json({
        metricId,
        value: result ? result.value : 0,
        label: metric.label,
        startDate: startDate || null,
        endDate: endDate || null,
        timestamp: new Date().toISOString()
      });

    } catch (dbError) {
      db.close();
      throw dbError;
    }

  } catch (error) {
    console.error(`❌ Metrics API error:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/viz/:id
 * Delete a visualization by ID
 */
app.delete('/api/viz/:id', async (req, res) => {
  const { id } = req.params;

  console.log(`🗑️ Delete request for viz ID: ${id}`);

  try {
    // Get visualization info
    console.log(`🔍 Looking up viz ID: ${id}`);
    const allViz = await registry.getAll();
    console.log(`🔍 Registry contains ${allViz.length} visualizations:`, allViz.map(v => `${v.id}:${v.title}`));
    const viz = await registry.get(id);
    console.log(`🔍 Registry lookup result:`, viz ? `Found: ${viz.title}` : 'Not found');

    if (!viz) {
      console.log(`❌ Visualization not found in registry: ${id}`);
      return res.status(404).json({
        success: false,
        error: `Visualization not found: ${id}`
      });
    }

    console.log(`📋 Found viz: ${viz.title} (${viz.filename})`);

    // Delete the HTML file from viz folder
    // Prevent path traversal attacks - sanitize filename
    const safeFilename = basename(viz.filename);
    const vizPath = join(appDir, 'viz', safeFilename);

    // Verify the resolved path is still within viz directory
    const normalizedPath = normalize(vizPath);
    const normalizedVizDir = normalize(join(appDir, 'viz'));
    if (!normalizedPath.startsWith(normalizedVizDir)) {
      console.error(`❌ Path traversal detected: ${viz.filename}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid file path'
      });
    }

    if (existsSync(vizPath)) {
      unlinkSync(vizPath);
      console.log(`🗂️ Deleted file: ${vizPath}`);
    } else {
      console.warn(`⚠️ File not found: ${vizPath}`);
    }

    // Remove from registry (this also saves the updated registry)
    await registry.unregister(id);

    console.log(`✅ Successfully deleted viz: ${viz.title}`);

    res.json({
      success: true,
      message: `Visualization "${viz.title}" deleted successfully`,
      deletedViz: {
        id: viz.id,
        title: viz.title,
        filename: viz.filename
      }
    });

  } catch (error) {
    console.error(`❌ Delete failed for ${id}:`, error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/viz
 * List all visualizations (for debugging)
 */
app.get('/api/viz', async (req, res) => {
  try {
    const allViz = await registry.getAll();
    res.json({
      success: true,
      visualizations: allViz,
      total: allViz.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/viz/:id
 * Serve visualization by ID (moved to API namespace to avoid static file conflicts)
 */
app.get('/api/viz/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const viz = await registry.get(id);

    if (!viz) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Visualization Not Found</title></head>
        <body>
          <h1>Visualization Not Found</h1>
          <p>Visualization with ID "${id}" was not found.</p>
          <a href="/">← Back to Dashboard</a>
        </body>
        </html>
      `);
    }

    // Serve the actual HTML file
    const vizPath = join(appDir, 'viz', viz.filename);
    res.sendFile(vizPath);

    // Record view
    await registry.recordView(id);

  } catch (error) {
    console.error(`Error serving viz ${id}:`, error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Server Error</title></head>
      <body>
        <h1>Server Error</h1>
        <p>Error serving visualization: ${error.message}</p>
        <a href="/">← Back to Dashboard</a>
      </body>
      </html>
    `);
  }
});

/**
 * POST /api/viz/:id/pin
 * Toggle pin status for a visualization
 */
app.post('/api/viz/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { pinned } = req.body;

  try {
    // Check both web-app and app directories for registry
    const webAppRegistry = join(currentWorkspace, 'web-app', 'assets', 'visualizations.json');
    const appRegistry = join(currentWorkspace, 'app', 'assets', 'visualizations.json');

    let vizRegistryPath;
    if (existsSync(webAppRegistry)) {
      vizRegistryPath = webAppRegistry;
    } else if (existsSync(appRegistry)) {
      vizRegistryPath = appRegistry;
    } else {
      return res.json({ success: false, error: 'Visualization registry not found' });
    }

    const data = readFileSync(vizRegistryPath, 'utf-8');
    const registry = JSON.parse(data);

    // Find and update the visualization
    const vizIndex = registry.visualizations?.findIndex(v => v.id === id);
    if (vizIndex === -1 || vizIndex === undefined) {
      return res.json({ success: false, error: `Visualization not found: ${id}` });
    }

    registry.visualizations[vizIndex].pinned = pinned;
    writeFileSync(vizRegistryPath, JSON.stringify(registry, null, 2));

    res.json({
      success: true,
      message: `Visualization ${pinned ? 'pinned' : 'unpinned'} successfully`,
      viz: registry.visualizations[vizIndex]
    });
  } catch (error) {
    console.error('Error toggling pin:', error);
    res.json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workspaces
 * List all available LocalBase workspaces
 */
app.get('/api/workspaces', (req, res) => {
  try {
    const workspaces = detectWorkspaces().map(ws => ({
      ...ws,
      active: ws.path === currentWorkspace
    }));
    res.json({
      success: true,
      workspaces,
      current: currentWorkspace
    });
  } catch (error) {
    console.error('Error listing workspaces:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workspace/switch
 * Switch to a different workspace
 */
app.post('/api/workspace/switch', (req, res) => {
  try {
    const { path: workspacePath } = req.body;

    if (!workspacePath) {
      return res.status(400).json({
        success: false,
        error: 'Workspace path is required'
      });
    }

    // Validate workspace exists (check both web-app/ and app/ directories)
    const webAppVizPath = join(workspacePath, 'web-app', 'assets', 'visualizations.json');
    const appVizPath = join(workspacePath, 'app', 'assets', 'visualizations.json');

    if (!existsSync(webAppVizPath) && !existsSync(appVizPath)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid workspace: visualizations.json not found in web-app/ or app/ directory'
      });
    }

    // Switch workspace
    switchWorkspace(workspacePath);

    res.json({
      success: true,
      workspace: currentWorkspace,
      message: `Switched to ${workspacePath.split('/').pop()}`
    });
  } catch (error) {
    console.error('Error switching workspace:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workspace
 * Get current workspace information
 */
app.get('/api/workspace', (req, res) => {
  try {
    // Try to read package.json for workspace name
    const packagePath = join(currentWorkspace, 'package.json');
    let workspaceName = 'LocalBase';

    try {
      const packageData = JSON.parse(require('fs').readFileSync(packagePath, 'utf8'));
      workspaceName = packageData.name || workspaceName;
    } catch (e) {
      // Fallback to directory name if package.json doesn't exist or can't be read
      workspaceName = currentWorkspace.split('/').pop();
    }

    res.json({
      success: true,
      workspace: workspaceName,
      path: currentWorkspace
    });
  } catch (error) {
    console.error('Error getting workspace info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workspace/stats
 * Returns detailed workspace statistics including file counts, sizes, etc.
 */
app.get('/api/workspace/stats', (req, res) => {
  try {
    const workspaceName = currentWorkspace.split('/').pop();
    const stats = {
      workspace: workspaceName,
      path: currentWorkspace
    };

    // Get git repo size
    try {
      const gitDir = join(currentWorkspace, '.git');
      if (existsSync(gitDir)) {
        const gitSize = execSync(`du -sh "${gitDir}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
        stats.gitRepoSize = gitSize;
      }
    } catch (e) {
      stats.gitRepoSize = 'N/A';
    }

    // Get tracked files count
    try {
      const trackedFiles = execSync(`cd "${currentWorkspace}" && git ls-files 2>/dev/null | wc -l`, { encoding: 'utf8' }).trim();
      stats.trackedFiles = parseInt(trackedFiles) || 0;
    } catch (e) {
      stats.trackedFiles = 0;
    }

    // Get code + assets size (excluding node_modules and .git)
    try {
      // macOS du doesn't support --exclude, so we calculate manually
      const totalSize = execSync(`du -sk "${currentWorkspace}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
      const gitSize = execSync(`du -sk "${currentWorkspace}/.git" 2>/dev/null | cut -f1 || echo 0`, { encoding: 'utf8' }).trim();
      const nodeSize = execSync(`du -sk "${currentWorkspace}/node_modules" "${currentWorkspace}/electron-app/node_modules" 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo 0`, { encoding: 'utf8' }).trim();

      const codeSizeKB = parseInt(totalSize) - parseInt(gitSize || 0) - parseInt(nodeSize || 0);

      if (codeSizeKB < 1024) {
        stats.codeSize = codeSizeKB + 'K';
      } else if (codeSizeKB < 1024 * 1024) {
        stats.codeSize = Math.round(codeSizeKB / 1024) + 'M';
      } else {
        stats.codeSize = (codeSizeKB / 1024 / 1024).toFixed(1) + 'G';
      }
    } catch (e) {
      stats.codeSize = 'N/A';
    }

    // Get node_modules size
    try {
      const nodeModulesDir = join(currentWorkspace, 'node_modules');
      const electronNodeModulesDir = join(currentWorkspace, 'electron-app/node_modules');
      let nodeSize = '0B';

      if (existsSync(nodeModulesDir) || existsSync(electronNodeModulesDir)) {
        const dirs = [nodeModulesDir, electronNodeModulesDir].filter(d => existsSync(d));
        nodeSize = execSync(`du -sh ${dirs.map(d => `"${d}"`).join(' ')} 2>/dev/null | awk '{sum+=$1} END {print sum "M"}'`, { encoding: 'utf8' }).trim();
      }
      stats.nodeModulesSize = nodeSize;
    } catch (e) {
      stats.nodeModulesSize = 'N/A';
    }

    // Get visualizations count
    try {
      const vizRegistryPath = join(currentWorkspace, 'web-app/assets/visualizations.json');
      if (existsSync(vizRegistryPath)) {
        const vizRegistry = JSON.parse(readFileSync(vizRegistryPath, 'utf8'));
        stats.visualizationCount = vizRegistry.visualizations?.length || 0;
      } else {
        stats.visualizationCount = 0;
      }
    } catch (e) {
      stats.visualizationCount = 0;
    }

    // Get connectors count
    try {
      const connectorsDir = join(currentWorkspace, 'connectors');
      if (existsSync(connectorsDir)) {
        const connectors = readdirSync(connectorsDir).filter(item => {
          const itemPath = join(connectorsDir, item);
          return statSync(itemPath).isDirectory() && !item.startsWith('.');
        });
        stats.connectorCount = connectors.length;
      } else {
        stats.connectorCount = 0;
      }
    } catch (e) {
      stats.connectorCount = 0;
    }

    // Get database files count and size
    try {
      const dataDir = join(currentWorkspace, 'data');
      if (existsSync(dataDir)) {
        const dbCount = execSync(`find "${dataDir}" -name "*.db" 2>/dev/null | wc -l`, { encoding: 'utf8' }).trim();
        const dbSize = execSync(`du -sh "${dataDir}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
        stats.databaseCount = parseInt(dbCount) || 0;
        stats.databaseSize = dbSize;
      } else {
        stats.databaseCount = 0;
        stats.databaseSize = '0B';
      }
    } catch (e) {
      stats.databaseCount = 0;
      stats.databaseSize = '0B';
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting workspace stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workspace/framework-stats
 * Returns framework-specific statistics (tools/, web-app/, electron-app/)
 */
app.get('/api/workspace/framework-stats', (req, res) => {
  try {
    const frameworkDirs = ['tools', 'web-app', 'electron-app', 'scripts'];

    // Check if current workspace is a subdirectory (like my-workspace)
    // If so, use parent directory for framework stats
    let frameworkRoot = currentWorkspace;
    const workspaceName = basename(currentWorkspace);
    if (workspaceName === 'my-workspace' || workspaceName.endsWith('-workspace')) {
      frameworkRoot = dirname(currentWorkspace);
    }

    // Calculate framework stats
    let instanceFiles = 0;
    let instanceSize = 0;
    let lastModified = null;

    frameworkDirs.forEach(dir => {
      const dirPath = join(frameworkRoot, dir);
      if (existsSync(dirPath)) {
        try {
          const fileCount = execSync(`find "${dirPath}" -type f 2>/dev/null | wc -l`, { encoding: 'utf8' }).trim();
          instanceFiles += parseInt(fileCount) || 0;

          const dirSize = execSync(`du -sk "${dirPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
          instanceSize += parseInt(dirSize) || 0;

          const modTime = statSync(dirPath).mtime;
          if (!lastModified || modTime > lastModified) {
            lastModified = modTime;
          }
        } catch (e) {}
      }
    });

    // Format sizes
    const formatSize = (sizeKB) => {
      if (sizeKB < 1024) {
        return sizeKB + 'K';
      } else if (sizeKB < 1024 * 1024) {
        return Math.round(sizeKB / 1024) + 'M';
      } else {
        return (sizeKB / 1024 / 1024).toFixed(1) + 'G';
      }
    };

    // Format last modified
    const now = new Date();
    const diffMs = now - lastModified;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let lastSyncFormatted = '—';
    if (lastModified) {
      if (diffDays === 0) {
        lastSyncFormatted = 'Today';
      } else if (diffDays === 1) {
        lastSyncFormatted = 'Yesterday';
      } else if (diffDays < 7) {
        lastSyncFormatted = diffDays + ' days ago';
      } else {
        lastSyncFormatted = lastModified.toLocaleDateString();
      }
    }

    res.json({
      success: true,
      framework: {
        files: instanceFiles,
        size: formatSize(instanceSize),
        lastModified: lastSyncFormatted
      }
    });
  } catch (error) {
    console.error('Error getting framework stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workspace/node-modules-breakdown
 * Returns detailed breakdown of entire framework repo by directory/file
 */
app.get('/api/workspace/node-modules-breakdown', (req, res) => {
  try {
    // Check if current workspace is a subdirectory (like my-workspace)
    let frameworkRoot = currentWorkspace;
    const workspaceName = basename(currentWorkspace);
    if (workspaceName === 'my-workspace' || workspaceName.endsWith('-workspace')) {
      frameworkRoot = dirname(currentWorkspace);
    }

    const items = [];

    // Get node_modules breakdown (top packages)
    const nodeModulesDir = join(frameworkRoot, 'node_modules');
    if (existsSync(nodeModulesDir)) {
      const packages = readdirSync(nodeModulesDir)
        .filter(item => {
          const itemPath = join(nodeModulesDir, item);
          return statSync(itemPath).isDirectory();
        })
        .map(packageName => {
          const packagePath = join(nodeModulesDir, packageName);
          try {
            const sizeKB = execSync(`du -sk "${packagePath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
            const sizeMB = parseInt(sizeKB) / 1024;

            return {
              name: packageName,
              sizeMB: Math.round(sizeMB * 100) / 100,
              sizeKB: parseInt(sizeKB),
              category: 'node_modules'
            };
          } catch (e) {
            return null;
          }
        })
        .filter(p => p !== null)
        .sort((a, b) => b.sizeKB - a.sizeKB);

      // Add top 15 packages individually
      items.push(...packages.slice(0, 15));

      // Group remaining packages as "other node_modules"
      const remainingSize = packages.slice(15).reduce((sum, p) => sum + p.sizeMB, 0);
      if (remainingSize > 0) {
        items.push({
          name: 'other node_modules',
          sizeMB: Math.round(remainingSize * 100) / 100,
          category: 'node_modules'
        });
      }
    }

    // Get framework directories
    const frameworkDirs = ['tools', 'web-app', 'connectors', 'data', 'scripts', 'my-workspace'];
    frameworkDirs.forEach(dir => {
      const dirPath = join(frameworkRoot, dir);
      if (existsSync(dirPath)) {
        try {
          const sizeKB = execSync(`du -sk "${dirPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
          const sizeMB = parseInt(sizeKB) / 1024;
          items.push({
            name: dir,
            sizeMB: Math.round(sizeMB * 100) / 100,
            sizeKB: parseInt(sizeKB),
            category: 'framework'
          });
        } catch (e) {}
      }
    });

    // Sort all items by size
    items.sort((a, b) => (b.sizeKB || b.sizeMB * 1024) - (a.sizeKB || a.sizeMB * 1024));

    res.json({
      success: true,
      items: items,
      total: items.reduce((sum, item) => sum + item.sizeMB, 0)
    });
  } catch (error) {
    console.error('Error analyzing framework:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tools
 * List tools/extensions from workspace (matches Electron main.js logic)
 */
app.get('/api/tools', (req, res) => {
  try {
    const tools = [];

    // Scan both tools/ (framework) and extensions/ (instance-specific)
    const dirsToScan = [
      { path: join(currentWorkspace, 'tools'), label: 'tools' },
      { path: join(currentWorkspace, 'extensions'), label: 'extensions' }
    ];

    for (const dir of dirsToScan) {
      if (!existsSync(dir.path)) {
        continue;
      }

      const entries = readdirSync(dir.path).filter(item => {
        const itemPath = join(dir.path, item);
        return statSync(itemPath).isDirectory() && !item.startsWith('.');
      });

      for (const entry of entries) {
        const configPath = join(dir.path, entry, 'config.json');
        if (existsSync(configPath)) {
          try {
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            tools.push({
              id: entry,
              name: config.name || entry.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              description: config.description || `${entry} tool`,
              version: config.version || '1.0.0',
              type: dir.label,
              config
            });
          } catch (e) {
            console.error(`Failed to parse config for ${entry}:`, e.message);
          }
        }
      }
    }

    console.log(`🔧 Found ${tools.length} tools/extensions in ${currentWorkspace}`);
    res.json({ success: true, tools, total: tools.length });
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tools/:toolId/config
 * Get a specific tool's config
 */
app.get('/api/tools/:toolId/config', (req, res) => {
  try {
    const { toolId } = req.params;

    // Check both tools/ and extensions/ directories
    const dirsToCheck = [
      join(currentWorkspace, 'tools', toolId, 'config.json'),
      join(currentWorkspace, 'extensions', toolId, 'config.json')
    ];

    for (const configPath of dirsToCheck) {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        return res.json({ success: true, config });
      }
    }

    res.status(404).json({ success: false, error: `Tool config not found: ${toolId}` });
  } catch (error) {
    console.error('Error getting tool config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/connectors
 * List connectors from workspace with status and lastSync
 */
app.get('/api/connectors', (req, res) => {
  try {
    const connectors = [];
    const connectorsDir = join(currentWorkspace, 'connectors');

    if (existsSync(connectorsDir)) {
      const connectorDirs = readdirSync(connectorsDir).filter(item => {
        const itemPath = join(connectorsDir, item);
        return statSync(itemPath).isDirectory() && !item.startsWith('.') && item !== 'example';
      });

      for (const dir of connectorDirs) {
        const connectorPath = join(connectorsDir, dir);
        const indexPath = join(connectorPath, 'index.js');

        // Check for index.js
        if (!existsSync(indexPath)) {
          connectors.push({
            id: dir,
            name: dir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            status: 'missing-index',
            description: 'Missing index.js - connector not functional',
            lastSync: 'N/A',
            path: connectorPath
          });
          continue;
        }

        // Look for data directory to determine lastSync
        let lastSync = 'Never';
        let dataDir = null;

        // Try to find schema.json with data_location
        const schemaPath = join(connectorPath, 'schema.json');
        if (existsSync(schemaPath)) {
          try {
            const schemaData = readFileSync(schemaPath, 'utf-8');
            const schema = JSON.parse(schemaData);
            if (schema.data_location) {
              // e.g., "data/g2-visits/file.csv" -> "data/g2-visits"
              const locationParts = schema.data_location.split('/');
              if (locationParts.length >= 2 && locationParts[0] === 'data') {
                dataDir = join(currentWorkspace, locationParts[0], locationParts[1]);
              }
            }
          } catch {
            // Schema file exists but couldn't read it
          }
        }

        // Fallback: name-based lookup - try multiple patterns
        if (!dataDir) {
          const possibleDirs = [
            join(currentWorkspace, 'data', dir.replace(/-/g, '_')),  // g2-api -> g2_api
            join(currentWorkspace, 'data', dir),                      // exact match
            join(currentWorkspace, 'data', `${dir.replace(/-/g, '_')}_deals`),   // hubspot -> hubspot_deals
            join(currentWorkspace, 'data', `${dir.replace(/-/g, '_')}_companies`), // hubspot -> hubspot_companies
            join(currentWorkspace, 'data', `${dir.replace(/-api$/, '').replace(/-/g, '-')}-visits`), // g2-api -> g2-visits
          ];

          for (const possibleDir of possibleDirs) {
            if (existsSync(possibleDir)) {
              dataDir = possibleDir;
              break;
            }
          }
        }

        // Check for recent data files
        if (dataDir && existsSync(dataDir)) {
          try {
            const dirStat = statSync(dataDir);
            if (dirStat.isDirectory()) {
              const dataFiles = readdirSync(dataDir).filter(f => !f.startsWith('.'));
              let mostRecentTime = 0;

              for (const file of dataFiles) {
                const filePath = join(dataDir, file);
                try {
                  const fileStat = statSync(filePath);
                  if (fileStat.isFile() && fileStat.mtime.getTime() > mostRecentTime) {
                    mostRecentTime = fileStat.mtime.getTime();
                  }
                } catch {
                  // Skip files we can't stat
                }
              }

              if (mostRecentTime > 0) {
                lastSync = new Date(mostRecentTime).toISOString().split('T')[0];
              }
            }
          } catch {
            // No data directory or can't read it
          }
        }

        // Get description from package.json or README
        let description = '';
        const pkgPath = join(connectorPath, 'package.json');
        if (existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            description = pkg.description || '';
          } catch {
            // Ignore parse errors
          }
        }

        connectors.push({
          id: dir,
          name: dir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          status: lastSync && lastSync !== 'Never' ? 'active' : 'needs-fix',
          description,
          lastSync,
          path: connectorPath
        });
      }
    }

    res.json({ success: true, connectors, total: connectors.length });
  } catch (error) {
    console.error('Error listing connectors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/datasources/:id/sync
 * Run sync for a data source
 */
app.post('/api/datasources/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;

    // Load data-sources.json to find the sync script
    const dataSourcesFile = join(currentWorkspace, 'data', 'data-sources.json');
    if (!existsSync(dataSourcesFile)) {
      return res.status(404).json({ success: false, error: 'data-sources.json not found' });
    }

    const dataSourcesContent = readFileSync(dataSourcesFile, 'utf-8');
    const dataSourcesData = JSON.parse(dataSourcesContent);
    const source = dataSourcesData.sources?.[id];

    if (!source) {
      return res.status(404).json({ success: false, error: `Data source '${id}' not found` });
    }

    if (!source.sync_script) {
      return res.status(400).json({ success: false, error: `Data source '${id}' has no sync_script configured` });
    }

    // Run the sync script
    const syncScript = join(currentWorkspace, source.sync_script);
    if (!existsSync(syncScript)) {
      return res.status(404).json({ success: false, error: `Sync script not found: ${source.sync_script}` });
    }

    console.log(`🔄 Running sync for ${id}: node ${syncScript}`);

    const output = execSync(`node "${syncScript}"`, {
      cwd: currentWorkspace,
      encoding: 'utf-8',
      timeout: 300000, // 5 minute timeout
      env: { ...process.env }
    });

    console.log(`✅ Sync completed for ${id}`);
    res.json({ success: true, output });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || ''
    });
  }
});

/**
 * POST /api/signals/refresh
 * Regenerate the signals data by running query-signals.cjs
 */
app.post('/api/signals/refresh', async (req, res) => {
  try {
    const signalsScript = join(currentWorkspace, 'projects/mediatrader-signals/query-signals.cjs');

    if (!existsSync(signalsScript)) {
      return res.status(404).json({ success: false, error: 'Signals script not found' });
    }

    console.log(`🔄 Refreshing signals data...`);

    const output = execSync(`node "${signalsScript}"`, {
      cwd: currentWorkspace,
      encoding: 'utf-8',
      timeout: 120000, // 2 minute timeout
      env: { ...process.env }
    });

    console.log(`✅ Signals refresh completed`);
    res.json({ success: true, output });
  } catch (error) {
    console.error('Signals refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || ''
    });
  }
});

/**
 * GET /api/datasources
 * List data sources from data/data-sources.json
 */
app.get('/api/datasources', (req, res) => {
  try {
    const dataSourcesFile = join(currentWorkspace, 'data', 'data-sources.json');

    if (existsSync(dataSourcesFile)) {
      const content = readFileSync(dataSourcesFile, 'utf-8');
      const data = JSON.parse(content);
      // Return sources object directly - matches what Overview.jsx expects
      res.json({ success: true, sources: data.sources || {} });
    } else {
      // Fallback: scan for .db files if no data-sources.json exists
      const dataSources = [];
      const dataDir = join(currentWorkspace, 'data');

      if (existsSync(dataDir)) {
        const findDbs = (dir, prefix = '') => {
          const items = readdirSync(dir);
          for (const item of items) {
            const itemPath = join(dir, item);
            const stat = statSync(itemPath);
            if (stat.isDirectory()) {
              findDbs(itemPath, prefix ? `${prefix}/${item}` : item);
            } else if (item.endsWith('.db')) {
              dataSources.push({
                id: prefix ? `${prefix}/${item}` : item,
                name: item.replace('.db', ''),
                path: itemPath,
                size: stat.size,
                modified: stat.mtime
              });
            }
          }
        };
        findDbs(dataDir);
      }

      // Convert array to sources object for consistency
      const sources = {};
      dataSources.forEach(ds => {
        sources[ds.id] = { name: ds.name, path: ds.path };
      });
      res.json({ success: true, sources });
    }
  } catch (error) {
    console.error('Error listing data sources:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workspace/file
 * Read a file from the workspace
 * ?path=relative/path/to/file.json
 */
app.get('/api/workspace/file', (req, res) => {
  try {
    const { path: relativePath } = req.query;

    if (!relativePath) {
      return res.status(400).json({
        success: false,
        error: 'path query parameter required'
      });
    }

    const filePath = join(currentWorkspace, relativePath);

    if (!existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `File not found: ${relativePath}`
      });
    }

    const content = readFileSync(filePath, 'utf8');
    res.json({ success: true, content });
  } catch (error) {
    console.error('Error reading workspace file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/db/query
 * Execute SQL query against a workspace database
 * Body: { database: "path/to/db.sqlite", sql: "SELECT ...", params: [] }
 */
app.post('/api/db/query', (req, res) => {
  try {
    const { database, sql, params = [] } = req.body;

    if (!database || !sql) {
      return res.status(400).json({
        success: false,
        error: 'database and sql are required'
      });
    }

    // Resolve database path relative to workspace
    const dbPath = join(currentWorkspace, database);

    if (!existsSync(dbPath)) {
      return res.status(404).json({
        success: false,
        error: `Database not found: ${database}`
      });
    }

    const db = new Database(dbPath, { readonly: true });

    try {
      // Determine if this is a SELECT or other query
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

      let result;
      if (isSelect) {
        const stmt = db.prepare(sql);
        result = stmt.all(...params);
      } else {
        const stmt = db.prepare(sql);
        result = stmt.run(...params);
      }

      db.close();

      res.json({
        success: true,
        data: result
      });
    } catch (queryError) {
      db.close();
      throw queryError;
    }
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mediatrader/query
 * Query MediaTrader data source using config-driven system
 * Body: { sourceId: "google-ads", options: { aggregation: 'sum' } }
 */
app.post('/api/mediatrader/query', (req, res) => {
  try {
    const { sourceId, options = {} } = req.body;

    if (!sourceId) {
      return res.status(400).json({
        success: false,
        error: 'sourceId is required'
      });
    }

    // Load MediaTrader config from workspace
    const configPaths = [
      join(currentWorkspace, 'extensions/mediatrader/config.json'),
      join(currentWorkspace, 'tools/mediatrader/config.json')
    ];

    let config = null;
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const configData = readFileSync(configPath, 'utf-8');
          config = JSON.parse(configData);
          break;
        } catch (err) {
          console.error('❌ Error parsing MediaTrader config:', err);
        }
      }
    }

    if (!config) {
      console.warn('⚠️ MediaTrader config not found');
      return res.json([]);
    }

    // Find source in channels or conversionSources
    const source = [...(config.channels || []), ...(config.conversionSources || [])].find(s => s.id === sourceId);

    if (!source) {
      console.warn(`⚠️ Source "${sourceId}" not found in config`);
      return res.json([]);
    }

    if (!source.enabled) {
      console.warn(`⚠️ Source "${sourceId}" is disabled`);
      return res.json([]);
    }

    // Handle CSV data sources
    if (source.dataSource.endsWith('.csv')) {
      const { startDate = '2024-01-01', endDate = '2025-12-31' } = options;
      const csvPath = join(currentWorkspace, source.dataSource);

      if (!existsSync(csvPath)) {
        console.warn(`⚠️ CSV file not found: ${csvPath}`);
        return res.json([]);
      }

      const csvData = readFileSync(csvPath, 'utf-8');
      const lines = csvData.trim().split('\n').slice(1);
      const results = lines
        .map(line => {
          const [month, value] = line.split(',');
          return { month, value: parseInt(value, 10) };
        })
        .filter(row => {
          const monthDate = row.month.includes('-') ? `${row.month}-01` : row.month;
          return monthDate >= startDate && monthDate <= endDate;
        });

      console.log(`✅ MediaTrader: Got ${results.length} rows for "${sourceId}" (CSV)`);
      return res.json(results);
    }

    // Handle SQLite data sources
    if (source.dataSource.endsWith('.sqlite') || source.dataSource.endsWith('.db')) {
      const { startDate = '2022-01-01', endDate = '2025-12-31', aggregation = 'count' } = options;
      const dbPath = join(currentWorkspace, source.dataSource);

      if (!existsSync(dbPath)) {
        console.warn(`⚠️ Database not found: ${dbPath}`);
        return res.json([]);
      }

      const db = new Database(dbPath, { readonly: true });

      // Determine what to aggregate
      let aggregateSQL = 'COUNT(*) as count';
      if (aggregation === 'sum' && source.costField) {
        aggregateSQL = `SUM([${source.costField}]) as spend`;
      } else if ((aggregation === 'sum' || aggregation === 'count') && source.valueField) {
        aggregateSQL = `SUM([${source.valueField}]) as value`;
      }

      // Handle different date formats
      let monthExpression;
      let dateFieldExpression = `[${source.dateField}]`;

      if (source.dateFormat === 'month') {
        monthExpression = `[${source.dateField}]`;
      } else if (source.dateFormat === 'unixepoch') {
        dateFieldExpression = `datetime(CASE WHEN [${source.dateField}] > 1000000000000 THEN [${source.dateField}]/1000 ELSE [${source.dateField}] END, 'unixepoch')`;
        monthExpression = `strftime('%Y-%m', datetime(CASE WHEN [${source.dateField}] > 1000000000000 THEN [${source.dateField}]/1000 ELSE [${source.dateField}] END, 'unixepoch'))`;
      } else {
        monthExpression = `strftime('%Y-%m', [${source.dateField}])`;
      }

      // Build WHERE clause
      let whereClause = `WHERE ${dateFieldExpression} IS NOT NULL
          AND ${dateFieldExpression} >= ?
          AND ${dateFieldExpression} <= ?`;

      if (source.filterField && source.filterValue) {
        whereClause += `\n      AND [${source.filterField}] = '${source.filterValue}'`;
      }

      if (source.whereClause) {
        whereClause += `\n      AND ${source.whereClause}`;
      }

      const query = `
        SELECT
          ${monthExpression} as month,
          ${aggregateSQL}
        FROM ${source.table}
        ${whereClause}
        GROUP BY month
        ORDER BY month
      `;

      try {
        const results = db.prepare(query).all(startDate, endDate);
        db.close();
        console.log(`✅ MediaTrader: Got ${results.length} rows for "${sourceId}" (SQLite)`);
        return res.json(results);
      } catch (queryErr) {
        db.close();
        console.error(`❌ Query error for "${sourceId}":`, queryErr.message);
        return res.json([]);
      }
    }

    console.warn(`⚠️ Unknown data source type: ${source.dataSource}`);
    res.json([]);
  } catch (error) {
    console.error(`❌ Error querying MediaTrader source:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'localbase-insights-server',
    port: PORT
  });
});

/**
 * Static file serving with no-cache headers (dynamic based on current workspace)
 */
app.use((req, res, next) => {
  // Re-create static middleware for current workspace on each request
  express.static(appDir, {
    setHeaders: (res, path) => {
      // Disable caching for all files
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  })(req, res, next);
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 LocalBase Insights server running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${appDir}`);
  console.log(`📋 API endpoints:`);
  console.log(`   GET    /api/workspaces         - List available workspaces`);
  console.log(`   POST   /api/workspace/switch   - Switch to different workspace`);
  console.log(`   GET    /api/workspace          - Current workspace info`);
  console.log(`   DELETE /api/viz/:id            - Delete visualization`);
  console.log(`   GET    /api/viz                - List all visualizations`);
  console.log(`   GET    /health                 - Health check`);
  console.log(`   GET    /*                      - Static files`);
});