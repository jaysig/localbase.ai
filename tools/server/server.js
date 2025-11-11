#!/usr/bin/env node
/**
 * Express.js Web Server for LocalBase Insights
 * Replaces Python HTTP server with proper routing
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const app = express();
const PORT = process.env.PORT || 3000;

// Detect available LocalBase workspaces
function detectWorkspaces() {
  const workDir = join(homedir(), 'Work');
  const workspaces = [];

  try {
    const entries = readdirSync(workDir);

    for (const entry of entries) {
      const fullPath = join(workDir, entry);

      // Skip if not a directory
      if (!statSync(fullPath).isDirectory()) continue;

      // Check for web-app/assets/visualizations.json OR app/assets/visualizations.json (LocalBase instance)
      const webAppVizPath = join(fullPath, 'web-app', 'assets', 'visualizations.json');
      const appVizPath = join(fullPath, 'app', 'assets', 'visualizations.json');

      if (existsSync(webAppVizPath) || existsSync(appVizPath)) {
        // Exclude the framework repo (localbase.ai)
        if (entry !== 'localbase.ai') {
          workspaces.push({
            name: entry,
            path: fullPath
          });
        }
      }
    }
  } catch (error) {
    console.error('Error detecting workspaces:', error);
  }

  return workspaces;
}

// Enable CORS for API endpoints
app.use(cors());
app.use(express.json());

// Serve static files from web-app directory
app.use('/static', express.static(join(projectRoot, 'web-app')));
app.use('/viz', express.static(join(projectRoot, 'web-app/viz')));
app.use('/assets', express.static(join(projectRoot, 'web-app/assets')));
app.use('/node_modules', express.static(join(projectRoot, 'node_modules')));

// Main dashboard route
app.get('/', (req, res) => {
  const indexPath = join(projectRoot, 'web-app', 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard not found');
  }
});

// Individual visualization routes
app.get('/viz/:chartId', (req, res) => {
  const chartId = req.params.chartId;
  const chartPath = join(projectRoot, 'web-app', 'viz', `${chartId}.html`);

  if (existsSync(chartPath)) {
    res.sendFile(chartPath);
  } else {
    res.status(404).send(`Visualization not found: ${chartId}`);
  }
});

// API route for workspace info
app.get('/api/workspaces', (req, res) => {
  try {
    const allWorkspaces = detectWorkspaces();
    const workspacesWithActive = allWorkspaces.map(ws => ({
      ...ws,
      active: ws.path === projectRoot
    }));

    // Sort workspaces: my-workspace first, then alphabetically
    const sortedWorkspaces = workspacesWithActive.sort((a, b) => {
      if (a.name === 'my-workspace') return -1;
      if (b.name === 'my-workspace') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      workspaces: sortedWorkspaces,
      current: projectRoot
    });
  } catch (error) {
    console.error('Error listing workspaces:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API route for visualization listings
app.get('/api/visualizations', (req, res) => {
  const registryPath = join(projectRoot, 'web-app', 'assets', 'visualizations.json');

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
  const registryPath = join(projectRoot, 'web-app', 'assets', 'visualizations.json');
  const vizPath = join(projectRoot, 'web-app', 'viz', `${id}.html`);

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
  console.log(`🚀 LocalBase Insights Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

export default app;