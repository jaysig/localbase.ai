#!/usr/bin/env node

/**
 * LocalBase Insights Unified Server
 * Serves static files + handles visualization management API
 */

import express from 'express';
import { join, dirname, basename, normalize } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Enable require() for CommonJS modules
const require = createRequire(import.meta.url);
import { VizRegistry } from '../viz/registry.js';
import { unlinkSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
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
import { handleChat, getChatConfig } from './chat-handler.js';
import {
  initConversationStore,
  createConversation,
  addMessage,
  getConversation,
  listConversations,
  searchConversations,
  updateConversationTitle,
  deleteConversation,
  LIMITS
} from './conversation-store.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Sanitize a path for safe use in shell commands.
 * Rejects paths with characters that could enable command injection.
 * @param {string} p - The path to sanitize
 * @returns {string} The sanitized absolute path
 * @throws {Error} If path contains dangerous characters
 */
function sanitizePath(p) {
  // Resolve to absolute path first
  const resolved = normalize(p);

  // Check for shell metacharacters that could enable injection
  // Allow: alphanumeric, /, -, _, ., space (but not at start/end)
  const dangerousChars = /[`$&|;()<>{}!\\'"*?\[\]\n\r]/;
  if (dangerousChars.test(resolved)) {
    throw new Error('Path contains invalid characters');
  }

  // Prevent null bytes
  if (resolved.includes('\0')) {
    throw new Error('Path contains null bytes');
  }

  return resolved;
}
const __dirname = dirname(__filename);

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const app = express();
const PORT = 3000;

// Get current workspace from persistent config (sanitize on load)
let currentWorkspace = sanitizePath(getCurrentWorkspace());

// Initialize conversation store
initConversationStore(currentWorkspace);

// Detect if running from framework (localbase.ai) vs instance
const cwd = process.cwd();
const frameworkRoot = join(dirname(__dirname), '..'); // tools/server -> tools -> root

// Viz directory at workspace root
function getVizDir(workspace) {
  return join(workspace, 'viz');
}


// Current viz directory
let vizDir = getVizDir(currentWorkspace);

// Security headers middleware
app.use((req, res, next) => {
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS - only allow localhost origins
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Block access to sensitive files and path traversal
const SENSITIVE_FILES = ['env.local', '.env', 'credentials.json', '.git', '.gitignore'];
app.use((req, res, next) => {
  const path = decodeURIComponent(req.path);

  // Block path traversal
  if (path.includes('..')) {
    return res.status(403).json({ error: 'Path traversal not allowed' });
  }

  // Block sensitive files
  const filename = path.split('/').pop();
  if (SENSITIVE_FILES.some(f => filename === f || path.includes(`/${f}`))) {
    return res.status(403).json({ error: 'Access to sensitive files not allowed' });
  }

  next();
});

// Initialize registry using viz directory at workspace root
let registry = new VizRegistry(vizDir);

console.log(`📁 Current workspace: ${currentWorkspace}`);
console.log(`📁 Config file: ${getConfigPath()}`);
console.log(`📁 Viz directory: ${vizDir}`);

/**
 * Switch to a different workspace
 * @param {string} workspacePath - Must be pre-sanitized via sanitizePath()
 */
function switchWorkspace(workspacePath) {
  // Double-check sanitization (defense in depth)
  currentWorkspace = sanitizePath(workspacePath);
  vizDir = getVizDir(currentWorkspace);

  // Re-initialize registry with new workspace viz dir
  registry = new VizRegistry(vizDir);

  // Re-initialize conversation store for new workspace
  initConversationStore(currentWorkspace);

  // Persist workspace selection
  setCurrentWorkspace(currentWorkspace);

  console.log(`🔄 Switched to workspace: ${currentWorkspace}`);
  console.log(`📁 New registry path: ${registry.registryPath}`);
  console.log(`⚠️  Note: Extension routes from previous workspace are still mounted. Restart server to load new extension routes.`);
}

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
    const vizPath = join(vizDir, safeFilename);

    // Verify the resolved path is still within viz directory
    const normalizedPath = normalize(vizPath);
    const normalizedVizDir = normalize(vizDir);
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
    const projectsWithPresentation = registry.getProjectsWithPresentation();
    res.json({
      success: true,
      visualizations: allViz,
      projectsWithPresentation,
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
          <p>Visualization with ID "${escapeHtml(id)}" was not found.</p>
          <a href="/">← Back to Dashboard</a>
        </body>
        </html>
      `);
    }

    // Serve the actual HTML file
    const vizPath = join(vizDir, viz.filename);
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
        <p>Error serving visualization: ${escapeHtml(error.message)}</p>
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
    // Registry now in data/assets/
    const vizRegistryPath = join(vizDir, 'visualizations.json');
    if (!existsSync(vizRegistryPath)) {
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

    // Sanitize path to prevent command injection
    let safePath;
    try {
      safePath = sanitizePath(workspacePath);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workspace path: ' + e.message
      });
    }

    // Validate workspace exists (check viz/ directory)
    const vizPath = join(safePath, 'viz', 'visualizations.json');

    if (!existsSync(vizPath)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid workspace: visualizations.json not found in viz/'
      });
    }

    // Switch workspace (use sanitized path)
    switchWorkspace(safePath);

    res.json({
      success: true,
      workspace: currentWorkspace,
      message: `Switched to ${safePath.split('/').pop()}`
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
 * POST /api/workspace/create
 * Create a new workspace
 */
app.post('/api/workspace/create', (req, res) => {
  try {
    const { workspaceName, parentDir } = req.body;

    if (!workspaceName) {
      return res.status(400).json({
        success: false,
        error: 'Workspace name is required'
      });
    }

    // Sanitize workspace name - only allow alphanumeric, dash, underscore
    const safeName = workspaceName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workspace name'
      });
    }

    // Default to ~/Work if no parent specified
    const parent = parentDir || join(homedir(), 'Work');
    let finalName = safeName;
    let workspacePath = join(parent, finalName);

    // If folder exists, check if it's already a LocalBase workspace
    if (existsSync(workspacePath)) {
      const vizPath = join(workspacePath, 'viz', 'visualizations.json');
      if (existsSync(vizPath)) {
        // Already a LocalBase workspace
        return res.status(400).json({
          success: false,
          error: 'Workspace already exists'
        });
      }
      // Folder exists but not a LocalBase workspace - append suffix
      finalName = `${safeName}-localbase`;
      workspacePath = join(parent, finalName);

      // Check if the suffixed version also exists
      if (existsSync(workspacePath)) {
        return res.status(400).json({
          success: false,
          error: `Both ${safeName} and ${finalName} already exist`
        });
      }
    }

    // Create workspace directory structure (full LocalBase instance)
    mkdirSync(workspacePath, { recursive: true });
    mkdirSync(join(workspacePath, 'viz'), { recursive: true });
    mkdirSync(join(workspacePath, 'data'), { recursive: true });
    mkdirSync(join(workspacePath, 'connectors'), { recursive: true });
    mkdirSync(join(workspacePath, 'tools'), { recursive: true });
    mkdirSync(join(workspacePath, 'scripts'), { recursive: true });

    // Create empty visualizations.json
    writeFileSync(
      join(workspacePath, 'viz', 'visualizations.json'),
      JSON.stringify({ visualizations: [] }, null, 2)
    );

    // Create package.json
    writeFileSync(
      join(workspacePath, 'package.json'),
      JSON.stringify({
        name: finalName,
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'echo "Use localbase framework to run this workspace"'
        }
      }, null, 2)
    );

    // Create CLAUDE.md
    writeFileSync(
      join(workspacePath, 'CLAUDE.md'),
      `# ${finalName}\n\nLocalBase workspace.\n\n## Data Sources\n\n(Add your data source documentation here)\n`
    );

    // Create env.local template
    writeFileSync(
      join(workspacePath, 'env.local'),
      '# Add your API keys and credentials here\n'
    );

    // Switch to the new workspace
    switchWorkspace(workspacePath);

    res.json({
      success: true,
      workspacePath,
      message: `Created workspace: ${finalName}`
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
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
      const vizRegistryPath = join(vizDir, 'visualizations.json');
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
    const frameworkDirs = ['tools', 'app', 'data', 'scripts'];

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
    const frameworkDirs = ['tools', 'app', 'connectors', 'data', 'scripts'];
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

    // Support both sync_script and update_command
    const syncCommand = source.sync_script || source.update_command;
    if (!syncCommand) {
      return res.status(400).json({ success: false, error: `Data source '${id}' has no sync_script or update_command configured` });
    }

    // Handle full command (e.g., "node connectors/hubspot/sync-deals.js") or just script path
    let scriptPath, command;
    if (syncCommand.startsWith('node ')) {
      scriptPath = syncCommand.replace('node ', '');
      command = syncCommand;
    } else {
      scriptPath = syncCommand;
      command = `node "${syncCommand}"`;
    }

    const fullScriptPath = join(currentWorkspace, scriptPath);
    if (!existsSync(fullScriptPath)) {
      return res.status(404).json({ success: false, error: `Sync script not found: ${scriptPath}` });
    }

    console.log(`🔄 Running sync for ${id}: ${command}`);

    const output = execSync(command, {
      cwd: currentWorkspace,
      encoding: 'utf-8',
      timeout: 300000, // 5 minute timeout
      env: { ...process.env }
    });

    console.log(`✅ Sync completed for ${id}`);

    // Update last_sync date in data-sources.json
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    dataSourcesData.sources[id].last_sync = today;
    writeFileSync(dataSourcesFile, JSON.stringify(dataSourcesData, null, 2));
    console.log(`📅 Updated last_sync for ${id} to ${today}`);

    res.json({ success: true, output, last_sync: today });
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

    // Security: Block path traversal
    if (relativePath.includes('..')) {
      return res.status(403).json({
        success: false,
        error: 'Path traversal not allowed'
      });
    }

    // Security: Block sensitive files
    const filename = relativePath.split('/').pop();
    if (SENSITIVE_FILES.some(f => filename === f || relativePath.includes(f))) {
      return res.status(403).json({
        success: false,
        error: 'Access to sensitive files not allowed'
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
 * GET /api/chat/config
 * Get current chat configuration (provider, model, available options)
 */
app.get('/api/chat/config', (req, res) => {
  try {
    const config = getChatConfig();
    res.json({ success: true, ...config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations
 * List all conversations
 */
app.get('/api/conversations', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = listConversations(parseInt(limit), parseInt(offset));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations/search
 * Search conversations by title or content
 */
app.get('/api/conversations/search', (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }
    const conversations = searchConversations(q, parseInt(limit));
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/conversations/:id
 * Get a single conversation with all messages
 */
app.get('/api/conversations/:id', (req, res) => {
  try {
    const conversation = getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true, conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation with first message
 */
app.post('/api/conversations', (req, res) => {
  try {
    const { message, model, provider } = req.body;
    if (!message || !message.content) {
      return res.status(400).json({ success: false, error: 'message with content is required' });
    }
    if (message.content.length > LIMITS.MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, error: `Message exceeds maximum length of ${LIMITS.MAX_MESSAGE_LENGTH} characters` });
    }
    const conversation = createConversation(message, model, provider);
    res.json({ success: true, conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Add a message to an existing conversation
 */
app.post('/api/conversations/:id/messages', (req, res) => {
  try {
    const { message, model, provider } = req.body;
    if (!message || !message.content) {
      return res.status(400).json({ success: false, error: 'message with content is required' });
    }
    if (message.content.length > LIMITS.MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, error: `Message exceeds maximum length of ${LIMITS.MAX_MESSAGE_LENGTH} characters` });
    }
    addMessage(req.params.id, message, model, provider);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation title
 */
app.patch('/api/conversations/:id', (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }
    if (title.length > LIMITS.MAX_TITLE_LENGTH) {
      return res.status(400).json({ success: false, error: `Title exceeds maximum length of ${LIMITS.MAX_TITLE_LENGTH} characters` });
    }
    updateConversationTitle(req.params.id, title);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation
 */
app.delete('/api/conversations/:id', (req, res) => {
  try {
    deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/chat
 * Chat endpoint for browser mode AI interaction
 * Body: { messages: [{ role: 'user'|'assistant', content: string }], provider?, model?, currentViz? }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, currentViz, provider, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'messages array is required'
      });
    }

    const lastMessage = messages[messages.length - 1];
    console.log(`💬 Chat request: "${lastMessage?.content?.substring(0, 50)}..."`);
    if (currentViz) {
      console.log(`📊 Context viz: ${currentViz.title} (${currentViz.filename})`);
    }

    // Call the chat handler
    const result = await handleChat(messages, currentWorkspace, currentViz, provider, model);

    res.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
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
 * Serve viz files from workspace viz/ directory
 * Dynamic middleware that uses current vizDir (updates on workspace switch)
 */
app.use('/viz', (req, res, next) => {
  express.static(vizDir, {
    setHeaders: (res, path) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      // Allow embedding in iframes (needed for Vite dev server on different port)
      res.removeHeader('X-Frame-Options');
    }
  })(req, res, next);
});

/**
 * Serve data files from workspace data/ directory
 * Used by visualizations to load SQLite databases client-side
 */
app.use('/data', (req, res, next) => {
  const dataDir = join(currentWorkspace, 'data');
  express.static(dataDir, {
    setHeaders: (res, path) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  })(req, res, next);
});

// Note: UI is served by Vite dev server on port 5173 during development
// Port 3000 is API-only. For production, run `npm run build` and serve app/dist separately.

/**
 * Load extension routes from extensions/{ext-id}/routes.js
 * Each routes.js should export a function that receives (router, workspace) and registers routes
 * Routes are mounted at /api/ext/{extension-id}/
 */
async function loadExtensionRoutes() {
  const extensionsDir = join(currentWorkspace, 'extensions');

  if (!existsSync(extensionsDir)) {
    return;
  }

  const entries = readdirSync(extensionsDir).filter(item => {
    const itemPath = join(extensionsDir, item);
    return statSync(itemPath).isDirectory() && !item.startsWith('.');
  });

  for (const extId of entries) {
    const routesPath = join(extensionsDir, extId, 'routes.js');

    if (existsSync(routesPath)) {
      try {
        // Dynamic import of the routes module
        const routesModule = await import(`file://${routesPath}`);

        if (typeof routesModule.default === 'function') {
          // Create a sub-router for this extension
          const extRouter = express.Router();

          // Pass the router and workspace to the extension's route setup function
          await routesModule.default(extRouter, currentWorkspace);

          // Mount at /api/ext/{extension-id}
          app.use(`/api/ext/${extId}`, extRouter);
          console.log(`   🔌 Loaded extension routes: /api/ext/${extId}`);
        } else {
          console.warn(`   ⚠️  Extension ${extId}/routes.js does not export a default function`);
        }
      } catch (err) {
        console.error(`   ❌ Failed to load routes for extension ${extId}:`, err.message);
      }
    }
  }
}

// Start server (async to allow extension route loading)
(async () => {
  await loadExtensionRoutes();

  app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LocalBase API server running on http://localhost:${PORT}`);
  console.log(`📁 Viz served from: ${vizDir}`);
  console.log(`📋 API endpoints:`);
  console.log(`   GET    /api/workspaces         - List available workspaces`);
  console.log(`   POST   /api/workspace/switch   - Switch to different workspace`);
  console.log(`   GET    /api/workspace          - Current workspace info`);
  console.log(`   DELETE /api/viz/:id            - Delete visualization`);
  console.log(`   GET    /api/viz                - List all visualizations`);
  console.log(`   GET    /health                 - Health check`);
  console.log(`   GET    /*                      - Static files`);
  });
})();