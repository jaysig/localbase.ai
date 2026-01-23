#!/usr/bin/env node
/**
 * Task: Example Task
 *
 * This is a template task. Replace this with your actual task logic.
 *
 * Pattern:
 *   1. Load config from agent.json
 *   2. Read input data (databases, files, APIs)
 *   3. Process/transform data
 *   4. Write output to output/ folder
 *   5. Log next steps for the user
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output')

// Load agent config
const CONFIG = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'agent.json'), 'utf-8'))

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

console.log(`=== ${CONFIG.name}: ${CONFIG.tasks[0].name} ===\n`)

// Log config
console.log('Config:', JSON.stringify(CONFIG.inputs.config, null, 2))
console.log()

// ===========================================
// YOUR TASK LOGIC GOES HERE
// ===========================================

// Example: Read from a database
// import Database from 'better-sqlite3'
// const db = new Database(path.join(PROJECT_ROOT, '../../data/your-data/db.sqlite'), { readonly: true })
// const rows = db.prepare('SELECT * FROM table').all()
// db.close()

// Example: Process data
const result = {
  generated: new Date().toISOString(),
  config: CONFIG.inputs.config,
  message: 'Replace this with your actual output',
  data: []
}

// ===========================================
// END TASK LOGIC
// ===========================================

// Write output
const outputPath = path.join(OUTPUT_DIR, 'result.json')
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))

console.log(`✓ Saved output to output/result.json`)
console.log('\nNext: Add more tasks or run the next task in sequence')
