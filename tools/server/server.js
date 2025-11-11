#!/usr/bin/env node
/**
 * Express.js Web Server for LocalBase Insights
 * Replaces Python HTTP server with proper routing
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { CompanyCamConnector } from '../../connectors/companycam/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for API endpoints
app.use(cors());
app.use(express.json());

// Serve static files from web-app directory
app.use('/static', express.static('web-app'));
app.use('/viz', express.static('web-app/viz'));
app.use('/assets', express.static('web-app/assets'));
app.use('/node_modules', express.static('node_modules'));

// Main dashboard route
app.get('/', (req, res) => {
  const indexPath = join(__dirname, 'web-app', 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard not found');
  }
});

// Individual visualization routes
app.get('/viz/:chartId', (req, res) => {
  const chartId = req.params.chartId;
  const chartPath = join(__dirname, 'web-app', 'viz', `${chartId}.html`);

  if (existsSync(chartPath)) {
    res.sendFile(chartPath);
  } else {
    res.status(404).send(`Visualization not found: ${chartId}`);
  }
});

// API route for visualization listings
app.get('/api/visualizations', (req, res) => {
  const registryPath = join(__dirname, 'web-app', 'assets', 'visualizations.json');

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

// DELETE endpoint for visualization removal
app.delete('/api/viz/:id', (req, res) => {
  const { id } = req.params;
  const registryPath = join(__dirname, 'web-app', 'assets', 'visualizations.json');
  const vizPath = join(__dirname, 'web-app', 'viz', `${id}.html`);

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

// Company Cam address search endpoint
app.get('/api/companycam/search', async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address parameter required' });
  }

  try {
    const connector = new CompanyCamConnector();
    await connector.initialize();

    const result = await connector.handleTool('companycam_search_projects', {
      search: address,
      per_page: 5
    });

    const data = JSON.parse(result.content[0].text);

    if (data.projects && data.projects.length > 0) {
      // Return the first match with public URL
      const project = data.projects[0];
      return res.json({
        found: true,
        project: {
          address: project.address?.street_address_1,
          city: project.address?.city,
          state: project.address?.state,
          url: project.public_url,
          photo_count: project.photo_count
        }
      });
    } else {
      return res.json({
        found: false,
        message: 'No project found for this address'
      });
    }
  } catch (error) {
    console.error('Company Cam search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LocalBase Insights Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

export default app;