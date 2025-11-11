#!/usr/bin/env node
/**
 * Express.js Web Server for GoSkills Analytics
 * Replaces Python HTTP server with proper routing
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from app directory
app.use('/static', express.static('app'));
app.use('/viz', express.static('app/viz'));
app.use('/assets', express.static('app/assets'));
app.use('/node_modules', express.static('node_modules'));

// Main dashboard route
app.get('/', (req, res) => {
  const indexPath = join(__dirname, 'app', 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard not found');
  }
});

// Individual visualization routes
app.get('/viz/:chartId', (req, res) => {
  const chartId = req.params.chartId;
  const chartPath = join(__dirname, 'app', 'viz', `${chartId}.html`);

  if (existsSync(chartPath)) {
    res.sendFile(chartPath);
  } else {
    res.status(404).send(`Visualization not found: ${chartId}`);
  }
});

// API route for visualization listings
app.get('/api/visualizations', (req, res) => {
  const registryPath = join(__dirname, 'app', 'assets', 'visualizations.json');

  if (existsSync(registryPath)) {
    try {
      const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
      res.json(registry);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load visualization registry' });
    }
  } else {
    res.json({ visualizations: [], totalVisualizations: 0 });
  }
});

// API route for ROAS analysis by date range
app.get('/api/media-correlation/roas', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters required' });
    }

    // Import and run the analysis
    const { runROASByDateRange } = await import('./projects/lead-lag-indicator/analysis/run-roas-by-date-range.js');
    const results = runROASByDateRange(startDate, endDate);

    // Calculate totals
    // Note: totalSpend sums across channels (each channel has different spend)
    // But totalRevenue and totalDeals should NOT be summed across channels
    // (same deals are attributed to all channels)
    let totalSpend = 0;

    Object.values(results).forEach(channelData => {
      Object.values(channelData).forEach(metrics => {
        totalSpend += metrics.spend;
      });
    });

    // Get actual revenue and deal count from first channel (they're all the same)
    const firstChannel = Object.values(results)[0];
    let actualRevenue = 0;
    let actualDeals = 0;

    Object.values(firstChannel).forEach(metrics => {
      actualRevenue += metrics.revenue;
      actualDeals += metrics.deals;
    });

    res.json({
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
    console.error('Error running ROAS analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE endpoint for visualization removal
app.delete('/api/viz/:id', (req, res) => {
  const { id } = req.params;
  const registryPath = join(__dirname, 'app', 'assets', 'visualizations.json');
  const vizPath = join(__dirname, 'app', 'viz', `${id}.html`);

  console.log(`🗑️ Delete request for viz ID: ${id}`);

  try {
    // Read current registry
    if (!existsSync(registryPath)) {
      return res.status(404).json({ success: false, error: 'Registry not found' });
    }

    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const vizIndex = registry.visualizations.findIndex(v => v.id === id);

    if (vizIndex === -1) {
      return res.status(404).json({ success: false, error: 'Visualization not found' });
    }

    // Remove from registry
    const removedViz = registry.visualizations.splice(vizIndex, 1)[0];

    // Update registry file
    writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Delete visualization file if it exists
    if (existsSync(vizPath)) {
      unlinkSync(vizPath);
      console.log(`🗑️ Deleted file: ${vizPath}`);
    }

    console.log(`✅ Successfully deleted visualization: ${removedViz.title}`);
    res.json({ success: true, message: `Visualization '${removedViz.title}' deleted successfully` });

  } catch (error) {
    console.error('❌ Delete failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GoSkills Analytics Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

export default app;