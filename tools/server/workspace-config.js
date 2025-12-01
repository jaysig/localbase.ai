#!/usr/bin/env node

/**
 * Workspace Configuration Manager
 * Manages persistent workspace selection across server restarts
 */

import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.localbase');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Detect available LocalBase workspaces
 * Scans ~/Work for directories containing viz/visualizations.json
 * Also checks for my-workspace in the framework directory
 */
export function detectWorkspaces() {
  const workDir = join(homedir(), 'Work');
  const workspaces = [];

  try {
    const entries = readdirSync(workDir);

    for (const entry of entries) {
      const fullPath = join(workDir, entry);

      // Check if it's a directory
      if (!statSync(fullPath).isDirectory()) continue;

      // Check for my-workspace in framework (highest priority)
      const myWorkspacePath = join(fullPath, 'my-workspace', 'viz', 'visualizations.json');

      if (existsSync(myWorkspacePath)) {
        // Framework with my-workspace - add my-workspace only, skip the parent
        workspaces.push({
          name: 'my-workspace',
          path: join(fullPath, 'my-workspace')
        });
        // Don't add the framework directory itself
        continue;
      }

      // Check for viz/visualizations.json (current pattern)
      const vizPath = join(fullPath, 'viz', 'visualizations.json');

      if (existsSync(vizPath)) {
        workspaces.push({
          name: entry,
          path: fullPath
        });
      }
    }
  } catch (error) {
    console.error('Error detecting workspaces:', error);
  }

  return workspaces;
}

/**
 * Read workspace config from disk
 */
export function readConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    const data = readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading workspace config:', error);
    return null;
  }
}

/**
 * Write workspace config to disk
 */
export function writeConfig(config) {
  try {
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing workspace config:', error);
    return false;
  }
}

/**
 * Get the current workspace (from config or default)
 */
export function getCurrentWorkspace() {
  const config = readConfig();

  if (config && config.currentWorkspace) {
    // Validate that the workspace still exists
    if (existsSync(config.currentWorkspace)) {
      return config.currentWorkspace;
    }
  }

  // No valid config - prefer my-workspace if it exists, otherwise use first available
  const workspaces = detectWorkspaces();

  // Prioritize my-workspace as the default
  const myWorkspace = workspaces.find(w => w.name === 'my-workspace');
  if (myWorkspace) {
    return myWorkspace.path;
  }

  // Fall back to first available workspace
  if (workspaces.length > 0) {
    return workspaces[0].path;
  }

  // Fallback to wherever the server is running from
  return process.cwd();
}

/**
 * Set the current workspace
 */
export function setCurrentWorkspace(workspacePath) {
  const config = readConfig() || {};
  config.currentWorkspace = workspacePath;
  config.lastUpdated = new Date().toISOString();

  return writeConfig(config);
}

/**
 * Get config file location
 */
export function getConfigPath() {
  return CONFIG_FILE;
}
