#!/usr/bin/env node
/**
 * Auto-categorize visualizations based on title keywords
 *
 * Standard types:
 * - chart: Single chart visualizations
 * - dashboard: Multiple charts/metrics on one page
 * - table: Data tables
 * - correlation: Correlation analysis
 * - analysis: General analysis views
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type rules based on title keywords
const TYPE_RULES = [
  { pattern: /dashboard/i, type: 'dashboard' },
  { pattern: /correlation/i, type: 'correlation' },
  { pattern: /\btable\b/i, type: 'table' },
  { pattern: /analysis/i, type: 'analysis' },
  // Default to chart if no matches
];

function categorizeVisualization(title, currentType) {
  // Find first matching rule
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(title)) {
      return rule.type;
    }
  }

  // Default: keep as chart
  return 'chart';
}

function updateVisualizationTypes(vizJsonPath) {
  console.log(`\n📊 Categorizing visualizations in ${vizJsonPath}`);

  // Read visualizations.json
  const vizData = JSON.parse(fs.readFileSync(vizJsonPath, 'utf8'));

  let updated = 0;
  const typeChanges = [];

  // Update each visualization
  vizData.visualizations = vizData.visualizations.map(viz => {
    const oldType = viz.type || 'chart';
    const newType = categorizeVisualization(viz.title, oldType);

    if (oldType !== newType) {
      typeChanges.push({
        title: viz.title,
        old: oldType,
        new: newType
      });
      updated++;
    }

    return {
      ...viz,
      type: newType
    };
  });

  // Write updated file
  fs.writeFileSync(vizJsonPath, JSON.stringify(vizData, null, 2) + '\n');

  // Show summary
  console.log(`\n✅ Updated ${updated} visualization types`);

  if (typeChanges.length > 0) {
    console.log('\nChanges:');
    typeChanges.forEach(({ title, old, new: newType }) => {
      console.log(`  - "${title}": ${old} → ${newType}`);
    });
  }

  // Show type distribution
  const typeCounts = {};
  vizData.visualizations.forEach(viz => {
    typeCounts[viz.type] = (typeCounts[viz.type] || 0) + 1;
  });

  console.log('\nType distribution:');
  Object.entries(typeCounts).sort().forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  return updated;
}

// Main
const args = process.argv.slice(2);
const workspaceRoot = args[0] || process.cwd();
const vizJsonPath = path.join(workspaceRoot, 'app/assets/visualizations.json');

if (!fs.existsSync(vizJsonPath)) {
  console.error(`❌ visualizations.json not found at ${vizJsonPath}`);
  process.exit(1);
}

updateVisualizationTypes(vizJsonPath);
console.log('\n✨ Done!\n');
