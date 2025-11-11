#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function titleFromFilename(filename) {
  return filename
    .replace('.html', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function regenerateRegistry(workspacePath) {
  const vizDir = path.join(workspacePath, 'app/viz');
  const registryPath = path.join(workspacePath, 'app/assets/visualizations.json');

  if (!fs.existsSync(vizDir)) {
    console.log(`❌ Viz directory not found: ${vizDir}`);
    return;
  }

  // Get all HTML files
  const files = fs.readdirSync(vizDir)
    .filter(f => f.endsWith('.html'))
    .sort();

  console.log(`📊 Found ${files.length} visualizations in ${workspacePath}`);

  // Generate registry entries
  const visualizations = files.map(filename => {
    const stats = fs.statSync(path.join(vizDir, filename));
    return {
      id: generateId(),
      title: titleFromFilename(filename),
      filename: filename,
      url: `/viz/${filename}`,
      type: 'chart',
      library: 'custom',
      createdAt: stats.mtime.toISOString(),
      size: { width: 1200, height: 800 }
    };
  });

  const registry = {
    visualizations: visualizations,
    lastUpdated: new Date().toISOString()
  };

  // Ensure assets directory exists
  const assetsDir = path.dirname(registryPath);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Write registry
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`✅ Wrote ${visualizations.length} entries to ${registryPath}`);
}

// Regenerate for both workspaces
const renuPath = path.join(process.env.HOME, 'Work/renu');
const goskillsPath = path.join(process.env.HOME, 'Work/goskills');

console.log('🔄 Regenerating visualization registries...\n');

regenerateRegistry(renuPath);
console.log('');
regenerateRegistry(goskillsPath);

console.log('\n✨ Done!');
