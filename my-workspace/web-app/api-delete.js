#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Delete visualization API
 * Removes file and updates visualizations.json
 */
export async function deleteVisualization(vizId) {
  try {
    const vizJsonPath = 'assets/visualizations.json';

    if (!existsSync(vizJsonPath)) {
      throw new Error('visualizations.json not found');
    }

    // Load current visualizations
    const data = JSON.parse(readFileSync(vizJsonPath, 'utf8'));
    const visualizations = data.visualizations || [];

    // Find the visualization to delete
    const vizIndex = visualizations.findIndex(v => v.id === vizId);
    if (vizIndex === -1) {
      throw new Error(`Visualization with ID "${vizId}" not found`);
    }

    const viz = visualizations[vizIndex];

    // Remove the HTML file
    const filePath = viz.url.replace(/^\//, ''); // Remove leading slash
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`🗑️  Deleted file: ${filePath}`);
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }

    // Remove from visualizations array
    visualizations.splice(vizIndex, 1);

    // Update metadata
    data.visualizations = visualizations;
    data.totalVisualizations = visualizations.length;
    data.lastUpdated = new Date().toISOString();

    // Save updated visualizations.json
    writeFileSync(vizJsonPath, JSON.stringify(data, null, 2));
    console.log(`✅ Updated visualizations.json`);

    return {
      success: true,
      message: `Visualization "${viz.name}" deleted successfully`,
      deletedViz: viz
    };

  } catch (error) {
    console.error('❌ Delete failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Simple HTTP handler for delete requests
if (import.meta.url === `file://${process.argv[1]}`) {
  const vizId = process.argv[2];
  if (!vizId) {
    console.error('Usage: node api-delete.js <viz-id>');
    process.exit(1);
  }

  const result = await deleteVisualization(vizId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}