#!/usr/bin/env node

/**
 * LocalBase Insights Unified Server
 * Serves static files + handles visualization management API
 */

import express from 'express';
import { join, dirname, basename, normalize } from 'path';
import { fileURLToPath } from 'url';
import { VizRegistry } from '../viz/registry.js';
import { unlinkSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { BusinessFunnelAPI } from './business-funnel-api.js';
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

// Detect app directory (web-app/ for newer instances, app/ for older ones)
function getAppDir(workspace) {
  const webAppDir = join(workspace, 'web-app');
  const appDir = join(workspace, 'app');
  return existsSync(join(webAppDir, 'index.html')) ? webAppDir : appDir;
}

let appDir = getAppDir(currentWorkspace);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize registry and business funnel API (will be re-initialized on workspace change)
let registry = new VizRegistry(appDir);
let businessFunnelAPI = new BusinessFunnelAPI(currentWorkspace);

console.log(`📁 Current workspace: ${currentWorkspace}`);
console.log(`📁 Config file: ${getConfigPath()}`);
console.log(`📁 Registry path: ${registry.registryPath}`);

/**
 * Switch to a different workspace
 */
function switchWorkspace(workspacePath) {
  currentWorkspace = workspacePath;
  appDir = getAppDir(currentWorkspace);

  // Re-initialize registry and business funnel API
  registry = new VizRegistry(appDir);
  businessFunnelAPI = new BusinessFunnelAPI(currentWorkspace);

  // Persist workspace selection
  setCurrentWorkspace(workspacePath);

  console.log(`🔄 Switched to workspace: ${currentWorkspace}`);
  console.log(`📁 New registry path: ${registry.registryPath}`);
}

/**
 * GET /api/business-funnel
 * Get business funnel data with optional range or date parameters
 * ?range=mtd|ytd|all (default: mtd)
 * OR ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/business-funnel', (req, res) => {
  const { range, startDate, endDate } = req.query;

  // Use custom date range if provided, otherwise use range parameter
  if (startDate && endDate) {
    console.log(`📊 Business funnel data request: ${startDate} to ${endDate}`);

    try {
      const result = businessFunnelAPI.getBusinessFunnelDataByDates(startDate, endDate);

      console.log(`✅ Returned ${result.total} data points for date range`);
      console.log(`📅 Date range: ${result.dateRange.start} to ${result.dateRange.end}`);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error(`❌ Business funnel API error:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } else {
    const rangeParam = range || 'mtd';
    console.log(`📊 Business funnel data request: range=${rangeParam}`);

    try {
      const result = businessFunnelAPI.getBusinessFunnelData(rangeParam);

      console.log(`✅ Returned ${result.total} data points for range: ${rangeParam}`);
      console.log(`📅 Date range: ${result.dateRange.start} to ${result.dateRange.end}`);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error(`❌ Business funnel API error:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

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
    // Import and run the analysis from project root (not using currentWorkspace for this specific path)
    const projectRoot = join(__dirname, '..', '..');
    const analysisPath = join(projectRoot, 'projects/lead-lag-indicator/analysis/run-roas-by-date-range.js');
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
    const coreFrameworkPath = '/Users/ryanriggin/Work/localbase.ai';

    // Check if current workspace is a subdirectory (like my-workspace)
    // If so, use parent directory for instance framework stats
    let instanceFrameworkRoot = currentWorkspace;
    const workspaceName = basename(currentWorkspace);
    if (workspaceName === 'my-workspace' || workspaceName.endsWith('-workspace')) {
      instanceFrameworkRoot = dirname(currentWorkspace);
    }

    // Calculate instance framework stats (current workspace)
    let instanceFiles = 0;
    let instanceSize = 0;
    let lastModified = null;

    frameworkDirs.forEach(dir => {
      const dirPath = join(instanceFrameworkRoot, dir);
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

    // Calculate core framework stats (source repo)
    let coreFiles = 0;
    let coreSize = 0;

    frameworkDirs.forEach(dir => {
      const dirPath = join(coreFrameworkPath, dir);
      if (existsSync(dirPath)) {
        try {
          const fileCount = execSync(`find "${dirPath}" -type f 2>/dev/null | wc -l`, { encoding: 'utf8' }).trim();
          coreFiles += parseInt(fileCount) || 0;

          const dirSize = execSync(`du -sk "${dirPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
          coreSize += parseInt(dirSize) || 0;
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
      coreFramework: {
        files: coreFiles,
        size: formatSize(coreSize)
      },
      instanceFramework: {
        files: instanceFiles,
        size: formatSize(instanceSize),
        lastSync: lastSyncFormatted
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
  console.log(`   GET    /api/business-funnel    - Business funnel data (range: mtd|ytd|all)`);
  console.log(`   DELETE /api/viz/:id            - Delete visualization`);
  console.log(`   GET    /api/viz                - List all visualizations`);
  console.log(`   GET    /health                 - Health check`);
  console.log(`   GET    /*                      - Static files`);
});