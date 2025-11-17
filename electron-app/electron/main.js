import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import fs from 'fs/promises'
import { unlinkSync, existsSync, readFileSync } from 'fs'
import pty from 'node-pty'
import { config } from 'dotenv'
import Database from 'better-sqlite3'
import { spawn } from 'child_process'
import chokidar from 'chokidar'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

console.log('🚀 App starting...', {
  isDev,
  isPackaged: app.isPackaged,
  NODE_ENV: process.env.NODE_ENV,
  appPath: app.getAppPath(),
  resourcesPath: process.resourcesPath,
  __dirname
})

// Load environment variables from env.local
// In production, resources are in process.resourcesPath
// In development, they're in the project root (instance directory, not framework)
const instanceRoot = isDev
  ? path.join(__dirname, '..', '..')  // electron-app is 2 levels deep in instance
  : process.resourcesPath

const envPath = path.join(instanceRoot, 'env.local')
config({ path: envPath })
console.log(`📝 Loading env from: ${envPath}`)
console.log(`📂 Instance root: ${instanceRoot}`)

// Set app name immediately (for macOS Dock and menu bar)
app.setName('LocalBase')

// Track current project root - ALWAYS default to instance directory
// Saved config should only override if user explicitly selects different workspace
let currentProjectRoot = instanceRoot

// Track Express server process for cleanup
let expressProcess = null

/**
 * Start Express server for a given workspace
 */
function startExpressServer(projectRoot) {
  // Don't start if already running
  if (expressProcess) {
    console.log('⚠️  Express server already running')
    return
  }

  try {
    console.log('🚀 Starting Express server...')
    console.log('  Project root:', projectRoot)

    expressProcess = spawn('npm', ['start'], {
      cwd: projectRoot,
      stdio: 'pipe',
      shell: true
    })

    // Log Express server output
    expressProcess.stdout.on('data', (data) => {
      console.log(`[Express] ${data.toString().trim()}`)
    })

    expressProcess.stderr.on('data', (data) => {
      console.error(`[Express Error] ${data.toString().trim()}`)
    })

    expressProcess.on('close', (code) => {
      console.log(`[Express] Process exited with code ${code}`)
      expressProcess = null
    })

    console.log('✅ Express server started from:', projectRoot)
  } catch (error) {
    console.error('❌ Failed to start Express server:', error)
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'LocalBase',
    autoHideMenuBar: true, // Hide menu bar on Linux/Windows
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Set Content Security Policy
  // NOTE: 'unsafe-eval' is required for Vite HMR in dev mode
  // Production build uses strict CSP without 'unsafe-eval' - warning will disappear
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* localbase: https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; frame-src 'self' localbase:;"
            : "default-src 'self' localbase: https://cdn.jsdelivr.net; connect-src 'self' http://localhost:3000; frame-src 'self' localbase:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;" // Allow inline scripts for visualizations and data URIs for icons
        ]
      }
    })
  })

  // Clear cache in development to prevent stale HTML files
  if (isDev) {
    await mainWindow.webContents.session.clearCache()
    console.log('🗑️  Cleared Electron cache')
  }

  // Load from Vite dev server in development, or from built files in production
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // In production, dist files are in the app.asar
    // Use __dirname which points to app.asar/electron, so ../dist/index.html
    const rendererPath = path.join(__dirname, '..', 'dist', 'index.html')
    console.log('📂 Loading renderer from:', rendererPath)
    console.log('📂 __dirname:', __dirname)
    console.log('📂 app.getAppPath():', app.getAppPath())

    mainWindow.loadFile(rendererPath).catch(err => {
      console.error('❌ Failed to load renderer:', err)
    })
  }

  // Log any console messages from renderer for debugging (dev mode only)
  if (isDev) {
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      try {
        console.log(`[Renderer] ${message}`)
      } catch (err) {
        // Ignore EPIPE errors when stdout is closed
        if (err.code !== 'EPIPE') throw err
      }
    })
  }
}

app.whenReady().then(async () => {
  // Force app name on macOS
  if (process.platform === 'darwin') {
    app.setName('LocalBase')
  }

  // Load the current workspace from config (no servers to start - using IPC!)
  const userDataPath = app.getPath('userData')
  const configPath = path.join(userDataPath, 'config.json')

  try {
    const configData = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configData)
    if (config.projectRoot) {
      console.log('📋 Found saved workspace:', config.projectRoot)

      // Validate workspace exists
      if (existsSync(config.projectRoot)) {
        currentProjectRoot = config.projectRoot
        console.log('✅ Using saved workspace:', currentProjectRoot)

        // Start Express server for saved workspace
        startExpressServer(currentProjectRoot)
      } else {
        console.log('⚠️  Saved workspace no longer exists, waiting for user selection')
      }
    } else {
      console.log('⏸️  No workspace configured, waiting for user selection')
    }
  } catch {
    console.log('⏸️  No config found, waiting for user to select workspace')
  }

  // Register custom protocol to serve visualization files from workspace
  protocol.handle('localbase', async (request) => {
    try {
      let url = request.url.slice('localbase://'.length)

      // Remove query parameters for path resolution
      const [urlPath] = url.split('?')

      let filePath

      // Handle API visualization requests (e.g., api/viz/mvrq803bx)
      if (urlPath.startsWith('api/viz/')) {
        const vizId = urlPath.replace('api/viz/', '')
        const registryPath = path.join(currentProjectRoot, 'web-app/assets/visualizations.json')

        if (existsSync(registryPath)) {
          const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
          const viz = registry.visualizations?.find(v => v.id === vizId)

          if (viz && viz.filename) {
            filePath = path.join(currentProjectRoot, 'web-app/viz', viz.filename)
          }
        }
      }
      // Handle direct viz file requests (e.g., viz/filename.html)
      else if (urlPath.startsWith('viz/')) {
        // Check if this is a viz asset request (viz/assets/...)
        if (urlPath.startsWith('viz/assets/')) {
          // Strip 'viz/' and map to web-app/assets/
          filePath = path.join(currentProjectRoot, 'web-app', urlPath.replace('viz/', ''))
        } else {
          // Regular viz file
          filePath = path.join(currentProjectRoot, 'web-app', urlPath)
        }
      }
      // Handle asset requests (e.g., assets/sql-wasm.js from web-app pages)
      else if (urlPath.startsWith('assets/')) {
        filePath = path.join(currentProjectRoot, 'web-app', urlPath)
      }
      // Handle any other paths as-is
      else {
        filePath = path.join(currentProjectRoot, urlPath)
      }

      if (!filePath || !existsSync(filePath)) {
        console.error('❌ File not found:', filePath || 'undefined')
        return new Response('File not found', { status: 404 })
      }

      console.log('📄 Serving file:', filePath)

      const fileBuffer = readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()

      // Determine MIME type
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      }

      const mimeType = mimeTypes[ext] || 'text/plain'

      return new Response(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } catch (error) {
      console.error('❌ Error serving file:', error)
      return new Response('File not found', { status: 404 })
    }
  })

  // Load Vimium extension in development mode
  if (isDev) {
    try {
      const vimiumPath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Extensions/dbepggeogbaibhgnhhndojpepiihcmeb')
      // Try to find the latest version directory
      const { session } = require('electron')
      const fs = require('fs')
      if (fs.existsSync(vimiumPath)) {
        const versions = fs.readdirSync(vimiumPath)
        if (versions.length > 0) {
          const latestVersion = versions.sort().reverse()[0]
          const extensionPath = path.join(vimiumPath, latestVersion)
          await session.defaultSession.loadExtension(extensionPath, { allowFileAccess: true })
          console.log('✓ Vimium extension loaded')
        }
      }
    } catch (err) {
      console.log('Vimium not found or failed to load:', err.message)
    }
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  // Cleanup Express server process
  if (expressProcess) {
    console.log('🛑 Stopping Express server...')
    expressProcess.kill()
    expressProcess = null
  }

  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  // Ensure Express server is stopped when app quits
  if (expressProcess) {
    console.log('🛑 Stopping Express server on app quit...')
    expressProcess.kill()
    expressProcess = null
  }
})

// Terminal PTY management
const terminals = new Map()
let terminalIdCounter = 0

// Create a new PTY session
ipcMain.handle('terminal:create', (event, { cols, rows, cwd }) => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'
  // Use provided cwd or fallback to user's home directory
  const workingDir = cwd || os.homedir()

  // Load env.local from the current instance workspace
  let envLocalVars = {}
  try {
    const envLocalPath = path.join(currentProjectRoot, 'env.local')
    if (existsSync(envLocalPath)) {
      const envContent = readFileSync(envLocalPath, 'utf-8')
      // Parse env.local file (simple KEY=VALUE format)
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim()
        // Skip comments and empty lines
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=')
          if (key && valueParts.length > 0) {
            // Join value parts in case value contains '='
            envLocalVars[key.trim()] = valueParts.join('=').trim()
          }
        }
      })
      console.log(`📝 Loaded ${Object.keys(envLocalVars).length} env variables from env.local`)
    }
  } catch (err) {
    console.log('⚠️  Could not load env.local for terminal:', err.message)
  }

  // Create environment with proper terminal settings for Claude Code
  const terminalEnv = {
    ...process.env,
    ...envLocalVars, // Instance-specific env vars from env.local
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    // Ensure Claude Code can detect it's in a proper terminal
    TERM_PROGRAM: 'LocalBase'
    // REMOVED: TERM_FEATURES was causing Claude Code to show separator lines on every keystroke
  }

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: workingDir,
    env: terminalEnv
  })

  const id = terminalIdCounter++
  terminals.set(id, ptyProcess)

  // Forward PTY output to renderer
  ptyProcess.onData((data) => {
    event.sender.send('terminal:data', { id, data })
  })

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    terminals.delete(id)
    event.sender.send('terminal:exit', { id, exitCode })
  })

  return { id }
})

// Write data to PTY (user input)
ipcMain.handle('terminal:write', (event, { id, data }) => {
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.write(data)
  }
})

// Resize PTY
ipcMain.handle('terminal:resize', (event, { id, cols, rows }) => {
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.resize(cols, rows)
  }
})

// Destroy PTY session
ipcMain.handle('terminal:destroy', (event, { id }) => {
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.kill()
    terminals.delete(id)
  }
})

ipcMain.handle('terminal:getInfo', async () => {
  return {
    platform: process.platform,
    shell: process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh',
    cwd: path.join(__dirname, '..', '..'), // Main LocalBase project root
    user: os.userInfo().username,
    home: os.homedir()
  }
})

// File selection IPC handler
ipcMain.handle('files:select', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Data Files', extensions: ['csv', 'json', 'db', 'sqlite', 'sqlite3'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled) {
    return []
  }

  return result.filePaths.map(filePath => ({
    path: filePath,
    name: path.basename(filePath)
  }))
})

// Directory selection IPC handler
ipcMain.handle('files:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// File browser IPC handlers
ipcMain.handle('files:getHome', async () => {
  return os.homedir()
})

ipcMain.handle('files:listDirectory', async (event, dirPath) => {
  try {
    const fs = await import('fs/promises')
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    // Filter out system/protected directories that we can't access
    const skipDirs = ['.Trash', '.Trashes', 'System', 'Volumes', 'dev', 'private']
    const filteredEntries = entries.filter(entry => !skipDirs.includes(entry.name))

    const items = await Promise.all(
      filteredEntries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name)
        let stats
        try {
          stats = await fs.stat(fullPath)
        } catch (err) {
          // Silently skip files we can't stat (permission issues, etc)
          return null
        }

        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: stats?.size || 0,
          modified: stats?.mtime || null
        }
      })
    )

    // Filter out null entries (files we couldn't stat)
    const validItems = items.filter(item => item !== null)

    // Sort: directories first, then by name
    return validItems.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Error listing directory:', error)
    return []
  }
})

// Project root configuration
ipcMain.handle('config:getProjectRoot', async () => {
  // Try to read from app config
  const userDataPath = app.getPath('userData')
  const configPath = path.join(userDataPath, 'config.json')

  try {
    const configData = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configData)
    return config.projectRoot || null
  } catch {
    // No config file = no workspace selected yet
    return null
  }
})

ipcMain.handle('config:setProjectRoot', async (event, projectRoot) => {
  const userDataPath = app.getPath('userData')
  const configPath = path.join(userDataPath, 'config.json')

  console.log('📂 IPC: setProjectRoot called')
  console.log('  Project root:', projectRoot)
  console.log('  Config path:', configPath)

  try {
    let config = {}
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(configData)
      console.log('  Existing config:', config)
    } catch {
      console.log('  No existing config, creating new')
    }

    config.projectRoot = projectRoot
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    console.log('✅ Project root saved successfully')

    // Update current project root - workspace switching is now instant!
    currentProjectRoot = projectRoot
    console.log('🔄 Updated currentProjectRoot:', currentProjectRoot)

    // Start Express server for this workspace
    startExpressServer(projectRoot)

    return { success: true }
  } catch (error) {
    console.error('❌ Failed to save project root:', error)
    return { success: false, error: error.message }
  }
})

// Save Supabase configuration to env.local
ipcMain.handle('config:saveSupabaseConfig', async (event, { url, key }) => {
  console.log('📂 IPC: saveSupabaseConfig called')

  try {
    if (!currentProjectRoot) {
      throw new Error('No project root set')
    }

    const envPath = path.join(currentProjectRoot, 'env.local')
    console.log('  env.local path:', envPath)

    // Read existing env.local or create new
    let envContent = ''
    try {
      envContent = await fs.readFile(envPath, 'utf-8')
    } catch {
      console.log('  No existing env.local, creating new')
    }

    // Parse existing env vars
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        envVars[match[1]] = match[2]
      }
    })

    // Update Supabase vars
    envVars['SUPABASE_URL'] = url
    envVars['SUPABASE_SECRET_KEY'] = key

    // Generate new env.local content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'

    await fs.writeFile(envPath, newEnvContent)
    console.log('✅ Supabase config saved to env.local')

    return { success: true }
  } catch (error) {
    console.error('❌ Error saving project root:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('config:getSupabaseConfig', async () => {
  console.log('📂 IPC: getSupabaseConfig called')

  try {
    if (!currentProjectRoot) {
      return { url: null, key: null }
    }

    const envPath = path.join(currentProjectRoot, 'env.local')

    // Read env.local
    let envContent = ''
    try {
      envContent = await fs.readFile(envPath, 'utf-8')
    } catch {
      return { url: null, key: null }
    }

    // Parse env vars
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        envVars[match[1]] = match[2]
      }
    })

    return {
      url: envVars['SUPABASE_URL'] || null,
      key: envVars['SUPABASE_SECRET_KEY'] || null
    }
  } catch (error) {
    console.error('❌ Error reading Supabase config:', error)
    return { url: null, key: null }
  }
})

// Workspace persistence
const getWorkspacesPath = () => {
  return path.join(app.getPath('userData'), 'workspaces.json')
}

ipcMain.handle('workspace:save', async (event, workspace) => {
  try {
    const workspacesPath = getWorkspacesPath()
    let workspaces = []

    try {
      const data = await fs.readFile(workspacesPath, 'utf-8')
      workspaces = JSON.parse(data)
    } catch {
      // File doesn't exist yet
    }

    // Add or update workspace
    const existing = workspaces.findIndex(w => w.workspaceName === workspace.workspaceName)
    if (existing >= 0) {
      workspaces[existing] = workspace
    } else {
      workspaces.push(workspace)
    }

    await fs.writeFile(workspacesPath, JSON.stringify(workspaces, null, 2))
    return { success: true }
  } catch (error) {
    console.error('Error saving workspace:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('workspace:list', async () => {
  try {
    const workspacesPath = getWorkspacesPath()
    const data = await fs.readFile(workspacesPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
})

ipcMain.handle('workspace:getActive', async () => {
  try {
    const workspacesPath = getWorkspacesPath()
    const data = await fs.readFile(workspacesPath, 'utf-8')
    const workspaces = JSON.parse(data)
    return workspaces[0] || null // First one is active
  } catch {
    return null
  }
})

// API IPC Handlers - replace HTTP server with direct IPC
// These handlers read data from the current workspace

// GET /api/viz - List all visualizations
ipcMain.handle('api:getVisualizations', async () => {
  try {
    console.log('📊 getVisualizations: Reading from workspace:', currentProjectRoot)

    // Check which directory structure exists (web-app/ or app/)
    const webAppRegistry = path.join(currentProjectRoot, 'web-app', 'assets', 'visualizations.json')
    const appRegistry = path.join(currentProjectRoot, 'app', 'assets', 'visualizations.json')

    let vizRegistryPath
    try {
      await fs.access(webAppRegistry)
      vizRegistryPath = webAppRegistry
      console.log('📊 Using web-app/ registry')
    } catch {
      vizRegistryPath = appRegistry
      console.log('📊 Using app/ registry')
    }

    const data = await fs.readFile(vizRegistryPath, 'utf-8')
    const registry = JSON.parse(data)

    // Detect workspace from path
    const workspace = currentProjectRoot.includes('/my-workspace') ? 'my-workspace'
      : currentProjectRoot.includes('/localbase.ai') ? 'framework'
      : path.basename(currentProjectRoot)

    console.log(`📊 Detected workspace: ${workspace}`)

    // Filter visualizations by workspace
    const allViz = registry.visualizations || []
    const workspaceViz = allViz.filter(v => v.workspace === workspace)

    // Warn about cross-workspace contamination
    const wrongWorkspace = allViz.filter(v => v.workspace && v.workspace !== workspace)
    if (wrongWorkspace.length > 0) {
      console.warn(`⚠️  Found ${wrongWorkspace.length} visualizations from other workspaces (filtering them out):`)
      wrongWorkspace.forEach(v => console.warn(`   - "${v.title}" (${v.workspace})`))
    }

    // Warn about visualizations without workspace metadata
    const noWorkspace = allViz.filter(v => !v.workspace)
    if (noWorkspace.length > 0) {
      console.warn(`⚠️  Found ${noWorkspace.length} visualizations without workspace metadata (filtering them out)`)
    }

    // Sort by createdAt (newest first) to ensure most recent visualizations appear first
    const sortedVisualizations = workspaceViz.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0)
      const dateB = new Date(b.createdAt || 0)
      return dateB - dateA // Descending order (newest first)
    })

    console.log(`📊 Returning ${sortedVisualizations.length} visualizations for workspace "${workspace}" (filtered from ${allViz.length} total)`)

    return {
      success: true,
      visualizations: sortedVisualizations,
      total: sortedVisualizations.length,
      workspace: workspace
    }
  } catch (error) {
    console.error('Error reading visualizations:', error)
    return {
      success: false,
      error: error.message,
      visualizations: [],
      total: 0
    }
  }
})

// GET /api/tools - Get available tools and extensions from workspace
ipcMain.handle('api:getTools', async () => {
  try {
    console.log('🔧 getTools: Scanning workspace:', currentProjectRoot)
    const tools = []

    // Scan both tools/ (framework) and extensions/ (instance-specific)
    const dirsToScan = [
      { path: path.join(currentProjectRoot, 'tools'), label: 'tools' },
      { path: path.join(currentProjectRoot, 'extensions'), label: 'extensions' }
    ]

    for (const dir of dirsToScan) {
      // Check if directory exists
      try {
        await fs.access(dir.path)
      } catch {
        console.log(`📁 No ${dir.label} directory found`)
        continue
      }

      const entries = await fs.readdir(dir.path, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const toolConfigPath = path.join(dir.path, entry.name, 'config.json')

          try {
            await fs.access(toolConfigPath)
            const configData = await fs.readFile(toolConfigPath, 'utf-8')
            const config = JSON.parse(configData)

            tools.push({
              id: entry.name,
              name: config.name || entry.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              description: config.description || `${entry.name} tool`,
              version: config.version || '1.0.0',
              type: dir.label, // 'tools' or 'extensions'
              config: config
            })
          } catch {
            // Skip directories without config.json
            console.log(`⏭️  Skipping ${entry.name} in ${dir.label} (no config.json)`)
          }
        }
      }
    }

    console.log(`🔧 Found ${tools.length} tools/extensions in ${currentProjectRoot}`)

    return {
      success: true,
      tools: tools,
      total: tools.length
    }
  } catch (error) {
    console.error('Error reading tools:', error)
    return {
      success: false,
      error: error.message,
      tools: [],
      total: 0
    }
  }
})

// Read any file from current workspace
ipcMain.handle('api:readWorkspaceFile', async (event, relativePath) => {
  try {
    const filePath = path.join(currentProjectRoot, relativePath)
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    console.error(`❌ Error reading workspace file ${relativePath}:`, error.message)
    return { success: false, error: error.message }
  }
})

// GET /api/toolConfig - Get a specific tool's config from workspace
ipcMain.handle('api:getToolConfig', async (event, toolId) => {
  try {
    console.log('🔧 getToolConfig: Loading config for tool:', toolId)

    // Check both tools/ and extensions/ directories
    const possiblePaths = [
      path.join(currentProjectRoot, 'tools', toolId, 'config.json'),
      path.join(currentProjectRoot, 'extensions', toolId, 'config.json')
    ]

    for (const toolConfigPath of possiblePaths) {
      try {
        await fs.access(toolConfigPath)
        const configData = await fs.readFile(toolConfigPath, 'utf-8')
        const config = JSON.parse(configData)
        console.log(`✅ Loaded config for ${toolId} from ${toolConfigPath}`)
        return {
          success: true,
          config: config
        }
      } catch {
        // Try next path
        continue
      }
    }

    console.error(`❌ Config not found for ${toolId} in tools/ or extensions/`)
    return {
      success: false,
      error: `Tool config not found: ${toolId}`
    }
  } catch (error) {
    console.error('Error loading tool config:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// GET /api/connectors - Get available connectors from workspace
ipcMain.handle('api:getConnectors', async () => {
  try {
    console.log('🔌 getConnectors: Scanning workspace:', currentProjectRoot)
    const connectorsPath = path.join(currentProjectRoot, 'connectors')

    // Check if connectors directory exists
    try {
      await fs.access(connectorsPath)
    } catch {
      console.log('📁 No connectors directory found')
      return {
        success: true,
        connectors: [],
        total: 0
      }
    }

    // Load data-sources.json to get accurate data locations and metadata
    let dataSources = {}
    try {
      const dataSourcesPath = path.join(currentProjectRoot, 'data', 'data-sources.json')
      const dataSourcesData = await fs.readFile(dataSourcesPath, 'utf-8')
      const dataSourcesJson = JSON.parse(dataSourcesData)
      dataSources = dataSourcesJson.sources || {}
    } catch (error) {
      console.log('📋 No data-sources.json found, using fallback detection')
    }

    const entries = await fs.readdir(connectorsPath, { withFileTypes: true })
    const connectors = []

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const connectorIndexPath = path.join(connectorsPath, entry.name, 'index.js')
        const connectorDir = path.join(connectorsPath, entry.name)

        // Only include directories with index.js (actual connectors)
        try {
          await fs.access(connectorIndexPath)

          // Try to read schema for metadata and data location
          let description = `${entry.name} connector`
          let lastSync = null
          let dataDir = null

          // First, try to match with data-sources.json entry
          const matchingSource = Object.entries(dataSources).find(([sourceId, sourceData]) => {
            return sourceData.connector && sourceData.connector.includes(entry.name)
          })

          if (matchingSource) {
            const [sourceId, sourceData] = matchingSource
            description = sourceData.name || description

            // Get data location from data-sources.json
            if (sourceData.storage && sourceData.storage.location) {
              dataDir = path.join(currentProjectRoot, path.dirname(sourceData.storage.location))
            } else if (sourceData.storage && sourceData.storage.database) {
              dataDir = path.join(currentProjectRoot, path.dirname(sourceData.storage.database))
            }
          }

          // Fallback: Look for schema file (could be schema.json or {name}-schema.json)
          if (!dataDir) {
            const connectorFiles = await fs.readdir(connectorDir)
            const schemaFile = connectorFiles.find(f => f.endsWith('-schema.json') || f === 'schema.json')

            if (schemaFile) {
              try {
                const schemaPath = path.join(connectorDir, schemaFile)
                const schemaData = await fs.readFile(schemaPath, 'utf-8')
                const schema = JSON.parse(schemaData)
                description = schema.description || description

                // Extract data directory from data_location field if present
                if (schema.data_location) {
                  // e.g., "data/g2-visits/file.csv" -> "data/g2-visits"
                  const locationParts = schema.data_location.split('/')
                  if (locationParts.length >= 2 && locationParts[0] === 'data') {
                    dataDir = path.join(currentProjectRoot, locationParts[0], locationParts[1])
                  }
                }
              } catch {
                // Schema file exists but couldn't read it
              }
            }
          }

          // Final fallback: name-based lookup
          if (!dataDir) {
            dataDir = path.join(currentProjectRoot, 'data', entry.name.replace(/-/g, '_'))
          }

          // Check for recent data files to determine last sync
          try {
            const dataStats = await fs.stat(dataDir)
            if (dataStats.isDirectory()) {
              const dataFiles = await fs.readdir(dataDir)
              // Look for any data files (.db, .sqlite, .json, .csv, etc.) - exclude hidden files
              const realFiles = dataFiles.filter(f => !f.startsWith('.'))

              if (realFiles.length > 0) {
                // Get the most recently modified file
                let mostRecentFile = null
                let mostRecentTime = 0

                for (const file of realFiles) {
                  const filePath = path.join(dataDir, file)
                  try {
                    const fileStats = await fs.stat(filePath)
                    if (fileStats.isFile() && fileStats.mtime.getTime() > mostRecentTime) {
                      mostRecentFile = file
                      mostRecentTime = fileStats.mtime.getTime()
                    }
                  } catch {
                    // Skip files we can't stat
                  }
                }

                if (mostRecentFile) {
                  lastSync = new Date(mostRecentTime).toISOString().split('T')[0]
                }
              }
            }
          } catch {
            // No data directory
            lastSync = 'Never'
          }

          connectors.push({
            id: entry.name,
            name: entry.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            status: lastSync && lastSync !== 'Never' ? 'active' : 'needs-fix',
            description: description,
            lastSync: lastSync || 'Never'
          })
        } catch {
          // Directory without index.js - add with missing-index status
          connectors.push({
            id: entry.name,
            name: entry.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            status: 'missing-index',
            description: 'Missing index.js - connector not functional',
            lastSync: 'N/A'
          })
          console.log(`⚠️  Found ${entry.name} directory without index.js`)
        }
      }
    }

    console.log(`🔌 Found ${connectors.length} connectors in ${currentProjectRoot}`)

    return {
      success: true,
      connectors: connectors,
      total: connectors.length
    }
  } catch (error) {
    console.error('Error reading connectors:', error)
    return {
      success: false,
      error: error.message,
      connectors: [],
      total: 0
    }
  }
})

// GET /api/data-sources - Get data sources count from data-sources.json
ipcMain.handle('api:getDataSources', async () => {
  try {
    const dataSourcesPath = path.join(currentProjectRoot, 'data', 'data-sources.json')

    try {
      const data = await fs.readFile(dataSourcesPath, 'utf-8')
      const dataSources = JSON.parse(data)
      const sourceCount = Object.keys(dataSources.sources || {}).length

      console.log(`📊 Found ${sourceCount} data sources in data-sources.json`)

      return {
        success: true,
        count: sourceCount,
        sources: dataSources.sources
      }
    } catch {
      // No data-sources.json file, fall back to counting data directories
      const dataPath = path.join(currentProjectRoot, 'data')
      try {
        const entries = await fs.readdir(dataPath, { withFileTypes: true })
        const dataDirectories = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).length

        console.log(`📊 Found ${dataDirectories} data directories (no data-sources.json)`)

        return {
          success: true,
          count: dataDirectories,
          sources: {}
        }
      } catch {
        return {
          success: true,
          count: 0,
          sources: {}
        }
      }
    }
  } catch (error) {
    console.error('Error reading data sources:', error)
    return {
      success: false,
      error: error.message,
      count: 0,
      sources: {}
    }
  }
})

// POST /api/syncDataSource - Sync a specific data source
ipcMain.handle('api:syncDataSource', async (event, sourceId) => {
  try {
    console.log(`🔄 Syncing data source: ${sourceId}`)
    console.log(`📂 Current project root: ${currentProjectRoot}`)

    // Load data-sources.json to get sync script path
    const dataSourcesPath = path.join(currentProjectRoot, 'data', 'data-sources.json')
    console.log(`📄 Reading data-sources.json from: ${dataSourcesPath}`)

    const data = await fs.readFile(dataSourcesPath, 'utf-8')
    const dataSources = JSON.parse(data)

    const source = dataSources.sources[sourceId]
    if (!source) {
      return {
        success: false,
        error: `Data source '${sourceId}' not found`
      }
    }

    // Support both sync_script and update_command field names
    const syncCommand = source.sync_script || source.update_command
    if (!syncCommand) {
      return {
        success: false,
        error: `No sync script defined for '${sourceId}'`
      }
    }

    // Parse the command (e.g., "node connectors/quickbooks/sync.js")
    const commandParts = syncCommand.trim().split(/\s+/)
    const executable = commandParts[0] // 'node'
    const scriptPath = commandParts.slice(1).join(' ') // 'connectors/quickbooks/sync.js'
    const fullScriptPath = path.join(currentProjectRoot, scriptPath)
    const args = [fullScriptPath]

    // Pass last sync date if available for incremental sync (only if not "Unknown")
    if (source.last_sync && source.last_sync !== 'Unknown') {
      args.push('--since', source.last_sync)
    }

    console.log(`🚀 Running sync command: ${executable} ${args.join(' ')}`)
    console.log(`📂 Working directory: ${currentProjectRoot}`)
    console.log(`📝 Full script path: ${fullScriptPath}`)

    // Fix PATH for spawned processes - Electron doesn't inherit full shell PATH
    const fixedEnv = {
      ...process.env,
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
    }

    // Add common node locations to PATH if not already there
    const nodePaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin', // Apple Silicon Homebrew
      path.join(os.homedir(), '.nvm/versions/node'), // nvm
      '/Users/' + os.userInfo().username + '/.nvm/versions/node'
    ]

    for (const nodePath of nodePaths) {
      if (!fixedEnv.PATH.includes(nodePath)) {
        fixedEnv.PATH = `${nodePath}:${fixedEnv.PATH}`
      }
    }

    return new Promise((resolve) => {
      const child = spawn(executable, args, {
        cwd: currentProjectRoot,
        env: fixedEnv,
        shell: true // Use shell to ensure proper PATH resolution
      })

      let output = ''
      let errorOutput = ''

      child.stdout.on('data', (data) => {
        output += data.toString()
        console.log(`[${sourceId}]`, data.toString())
      })

      child.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error(`[${sourceId} ERROR]`, data.toString())
      })

      child.on('close', async (code) => {
        console.log(`🏁 Sync process exited with code: ${code}`)

        if (code === 0) {
          console.log(`✅ Sync completed for ${sourceId}`)

          // Update the last_sync timestamp in data-sources.json
          try {
            console.log(`📝 Updating timestamp in: ${dataSourcesPath}`)
            const updatedData = await fs.readFile(dataSourcesPath, 'utf-8')
            const updatedDataSources = JSON.parse(updatedData)

            if (updatedDataSources.sources[sourceId]) {
              // Format date as YYYY-MM-DD
              const today = new Date().toISOString().split('T')[0]
              updatedDataSources.sources[sourceId].last_sync = today

              await fs.writeFile(dataSourcesPath, JSON.stringify(updatedDataSources, null, 2), 'utf-8')
              console.log(`📅 Updated last_sync timestamp for ${sourceId} to ${today}`)
              console.log(`✅ Timestamp update successful!`)
            } else {
              console.error(`⚠️ Source ${sourceId} not found in data-sources.json after sync`)
            }
          } catch (timestampError) {
            console.error(`⚠️ Failed to update timestamp for ${sourceId}:`, timestampError)
            // Don't fail the entire sync if timestamp update fails
          }

          resolve({
            success: true,
            message: `Synced ${sourceId} successfully`,
            output: output
          })
        } else {
          console.error(`❌ Sync failed for ${sourceId} with code ${code}`)
          resolve({
            success: false,
            error: `Sync failed with code ${code}`,
            output: errorOutput || output
          })
        }
      })

      child.on('error', (error) => {
        console.error(`❌ Failed to start sync for ${sourceId}:`, error)
        resolve({
          success: false,
          error: error.message
        })
      })
    })
  } catch (error) {
    console.error(`Error syncing data source ${sourceId}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
})

// POST /api/query-sqlite - Query a SQLite database (or Supabase if configured)
ipcMain.handle('api:querySQLite', async (event, { database, query }) => {
  try {
    console.log(`🗃️  querySQLite: database=${database}, query=${query.substring(0, 100)}...`)

    // Use Supabase for localbase.db if configured
    const useSupabase = database === 'data/localbase.db' &&
                        process.env.SUPABASE_URL &&
                        process.env.SUPABASE_SECRET_KEY

    if (useSupabase) {
      // Dynamically import Supabase adapter
      const { supabaseDB } = await import(path.join(currentProjectRoot, 'tools/db/supabase-adapter.js'))
      return await supabaseDB.query(query)
    }

    // Otherwise use SQLite
    const dbPath = path.join(currentProjectRoot, database)

    // Verify database exists
    if (!existsSync(dbPath)) {
      return {
        success: false,
        error: `Database not found: ${database}`
      }
    }

    // Open database (read-write for DELETE/UPDATE, readonly for SELECT)
    const isWriteQuery = /^\s*(DELETE|UPDATE|INSERT|CREATE|DROP|ALTER)/i.test(query)
    const db = new Database(dbPath, { readonly: !isWriteQuery })

    try {
      // Execute query
      const stmt = db.prepare(query)
      const result = isWriteQuery ? stmt.run() : stmt.all()

      if (isWriteQuery) {
        console.log(`✅ Query executed: ${result.changes} rows affected`)
        return { success: true, data: [], changes: result.changes }
      } else {
        console.log(`✅ Query returned ${result.length} rows`)
        return { success: true, data: result }
      }
    } finally {
      // Always close the database
      db.close()
    }
  } catch (error) {
    console.error('Error querying database:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// POST /api/sync-automated - Run automated data source syncs
ipcMain.handle('api:syncAutomated', async (event) => {
  try {
    console.log('🔄 Starting automated sync...')

    const syncs = [
      { name: 'HubSpot Companies', script: 'connectors/hubspot/sync-companies.js' },
      { name: 'HubSpot Deals', script: 'connectors/hubspot/sync-deals.js' },
      { name: 'G2 Buyer Intent', script: 'connectors/g2-api/sync.js' }
    ]

    const results = []

    for (const sync of syncs) {
      console.log(`🔄 Syncing ${sync.name}...`)

      try {
        // Run sync script
        const scriptPath = path.join(currentProjectRoot, sync.script)

        await new Promise((resolve, reject) => {
          const child = spawn('node', [scriptPath], {
            cwd: currentProjectRoot,
            env: { ...process.env },
            stdio: 'pipe'
          })

          let stdout = ''
          let stderr = ''

          child.stdout.on('data', (data) => {
            stdout += data.toString()
            console.log(`[${sync.name}] ${data.toString().trim()}`)
          })

          child.stderr.on('data', (data) => {
            stderr += data.toString()
            console.error(`[${sync.name}] ${data.toString().trim()}`)
          })

          child.on('close', (code) => {
            if (code === 0) {
              results.push({ name: sync.name, success: true, output: stdout })
              resolve()
            } else {
              results.push({ name: sync.name, success: false, error: stderr || `Exit code: ${code}` })
              resolve() // Continue to next sync even if this one fails
            }
          })

          child.on('error', (err) => {
            results.push({ name: sync.name, success: false, error: err.message })
            resolve()
          })
        })

        console.log(`✅ ${sync.name} sync complete`)
      } catch (error) {
        console.error(`❌ ${sync.name} sync failed:`, error)
        results.push({ name: sync.name, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`🎉 Automated sync complete: ${successCount}/${syncs.length} successful`)

    return {
      success: true,
      results,
      summary: `${successCount}/${syncs.length} syncs completed successfully`
    }
  } catch (error) {
    console.error('Error running automated sync:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// DELETE /api/viz/:id - Delete visualization
ipcMain.handle('api:deleteVisualization', async (event, id) => {
  try {
    const vizRegistryPath = path.join(currentProjectRoot, 'app', 'assets', 'visualizations.json')
    const data = await fs.readFile(vizRegistryPath, 'utf-8')
    const registry = JSON.parse(data)

    // Find the visualization
    const viz = registry.visualizations?.find(v => v.id === id)
    if (!viz) {
      return {
        success: false,
        error: `Visualization not found: ${id}`
      }
    }

    // Delete the HTML file
    const vizPath = path.join(currentProjectRoot, 'app', 'viz', viz.filename)
    if (existsSync(vizPath)) {
      unlinkSync(vizPath)
    }

    // Remove from registry
    registry.visualizations = registry.visualizations.filter(v => v.id !== id)
    await fs.writeFile(vizRegistryPath, JSON.stringify(registry, null, 2))

    return {
      success: true,
      message: `Visualization "${viz.title}" deleted successfully`,
      deletedViz: {
        id: viz.id,
        title: viz.title,
        filename: viz.filename
      }
    }
  } catch (error) {
    console.error('Error deleting visualization:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// File watchers for live reloading visualizations
const fileWatchers = new Map()
let vizDirectoryWatcher = null

// Start watching the viz directory for new files
ipcMain.handle('viz:watchDirectory', async (event) => {
  try {
    // Stop existing watcher if any
    if (vizDirectoryWatcher) {
      vizDirectoryWatcher.close()
    }

    const vizDir = path.join(currentProjectRoot, 'app', 'viz')
    console.log('👁️ Starting directory watch:', vizDir)

    // Get initial list of files
    let previousFiles = new Set()
    try {
      const files = await fs.readdir(vizDir)
      previousFiles = new Set(files.filter(f => f.endsWith('.html')))
    } catch (err) {
      console.error('Error reading viz directory:', err)
    }

    // Watch the directory for changes
    vizDirectoryWatcher = watch(vizDir, async (eventType, filename) => {
      if (filename && filename.endsWith('.html')) {
        // Get current list of files
        const currentFiles = new Set()
        try {
          const files = await fs.readdir(vizDir)
          files.filter(f => f.endsWith('.html')).forEach(f => currentFiles.add(f))
        } catch (err) {
          return
        }

        // Check for new files
        for (const file of currentFiles) {
          if (!previousFiles.has(file)) {
            console.log('✨ New viz file detected:', file)
            event.sender.send('viz:newFile', file)
          }
        }

        // Update previous files list
        previousFiles = currentFiles
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error watching directory:', error)
    return { success: false, error: error.message }
  }
})

// Start watching a visualization file
ipcMain.handle('viz:watchFile', async (event, filename) => {
  try {
    // Stop any existing watcher for this file
    if (fileWatchers.has(filename)) {
      await fileWatchers.get(filename).close()
      fileWatchers.delete(filename)
    }

    const filePath = path.join(currentProjectRoot, 'app', 'viz', filename)
    console.log('👁️ Starting file watch:', filePath)

    // Watch the file for changes using chokidar (more reliable than fs.watch)
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    watcher.on('change', () => {
      console.log('📝 File changed:', filename)
      event.sender.send('viz:fileChanged', filename)
    })

    watcher.on('error', (error) => {
      console.error('File watcher error:', error)
    })

    fileWatchers.set(filename, watcher)

    return { success: true }
  } catch (error) {
    console.error('Error watching file:', error)
    return { success: false, error: error.message }
  }
})

// Stop watching a visualization file
ipcMain.handle('viz:unwatchFile', async (event, filename) => {
  try {
    if (fileWatchers.has(filename)) {
      fileWatchers.get(filename).close()
      fileWatchers.delete(filename)
      console.log('👁️ Stopped watching:', filename)
    }
    return { success: true }
  } catch (error) {
    console.error('Error unwatching file:', error)
    return { success: false, error: error.message }
  }
})

// GET /api/call-metrics - Call metrics from RingCentral
ipcMain.handle('api:getCallMetrics', async (event, params = {}) => {
  try {
    const { range = 'mtd', startDate: customStart, endDate: customEnd } = params

    const dbPath = path.join(currentProjectRoot, 'data', 'ringcentral', 'ringcentral.db')
    const db = new Database(dbPath, { readonly: true })

    let startDate, endDate, previousStartDate, previousEndDate
    const today = new Date()

    // Handle custom date range
    if (customStart && customEnd) {
      startDate = customStart
      endDate = customEnd

      const start = new Date(customStart)
      const end = new Date(customEnd)
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))

      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - diffDays)

      previousStartDate = prevStart.toISOString().split('T')[0]
      previousEndDate = prevEnd.toISOString().split('T')[0]
    } else {
      // Calculate date ranges based on range parameter
      switch(range) {
        case 'mtd':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
          endDate = today.toISOString().split('T')[0]
          const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
          const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
          previousStartDate = prevMonthStart.toISOString().split('T')[0]
          previousEndDate = prevMonthEnd.toISOString().split('T')[0]
          break
        default:
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
          endDate = today.toISOString().split('T')[0]
          previousStartDate = null
          previousEndDate = null
      }
    }

    // Get current period metrics
    const current = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN call_length >= 90 THEN 1 ELSE 0 END) as conversations,
        AVG(call_length) as avgDuration
      FROM calls
      WHERE result = 'Connected'
        AND DATE(call_start_time) >= ?
        AND DATE(call_start_time) <= ?
    `).get(startDate, endDate)

    current.conversationRate = current.totalCalls > 0 ? (current.conversations / current.totalCalls * 100) : 0

    // Get daily breakdown
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
    `).all(startDate, endDate)

    db.close()

    return {
      success: true,
      current,
      previous: null,
      daily,
      dateRange: { start: startDate, end: endDate }
    }
  } catch (error) {
    console.error('Error getting call metrics:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// MediaTrader IPC handlers
ipcMain.handle('mediatrader:getDealsCreated', async () => {
  try {
    const { getDealsCreatedByMonth } = await import('../src/lib/mediatrader-data.js')
    return getDealsCreatedByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting deals:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getBusinessesCreated', async () => {
  try {
    const { getBusinessesCreatedByMonth } = await import('../src/lib/mediatrader-data.js')
    return getBusinessesCreatedByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting businesses:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getOrganicClicks', async () => {
  try {
    const { getOrganicClicksByMonth } = await import('../src/lib/mediatrader-data.js')
    return getOrganicClicksByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting organic clicks:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getOrganicImpressions', async () => {
  try {
    const { getOrganicImpressionsByMonth } = await import('../src/lib/mediatrader-data.js')
    return getOrganicImpressionsByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting organic impressions:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getDirectTraffic', async () => {
  try {
    const { getDirectTrafficByMonth } = await import('../src/lib/mediatrader-data.js')
    return getDirectTrafficByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting direct traffic:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getYouTubeViews', async () => {
  try {
    const { getYouTubeViewsByMonth } = await import('../src/lib/mediatrader-data.js')
    return getYouTubeViewsByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting YouTube views:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getGooglePaidImpressions', async () => {
  try {
    const { getGooglePaidImpressionsByMonth } = await import('../src/lib/mediatrader-data.js')
    return getGooglePaidImpressionsByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting Google paid impressions:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getFacebookPaidImpressions', async () => {
  try {
    const { getFacebookPaidImpressionsByMonth } = await import('../src/lib/mediatrader-data.js')
    return getFacebookPaidImpressionsByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting Facebook paid impressions:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getBingPaidImpressions', async () => {
  try {
    const { getBingPaidImpressionsByMonth } = await import('../src/lib/mediatrader-data.js')
    return getBingPaidImpressionsByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting Bing paid impressions:', error)
    return []
  }
})

// Ad spend data handlers
ipcMain.handle('mediatrader:getGoogleAdsSpend', async () => {
  try {
    const { getGoogleAdsSpendByMonth } = await import('../src/lib/mediatrader-data.js')
    return getGoogleAdsSpendByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting Google Ads spend:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getFacebookAdsSpend', async () => {
  try {
    const { getFacebookAdsSpendByMonth } = await import('../src/lib/mediatrader-data.js')
    return getFacebookAdsSpendByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting Facebook Ads spend:', error)
    return []
  }
})

ipcMain.handle('mediatrader:getBingAdsSpend', async () => {
  try {
    const { getBingAdsSpendByMonth } = await import('../src/lib/mediatrader-data.js')
    return getBingAdsSpendByMonth(currentProjectRoot)
  } catch (error) {
    console.error('Error getting Bing Ads spend:', error)
    return []
  }
})

// Generic config-driven data source query
ipcMain.handle('mediatrader:queryDataSource', async (event, { sourceId, options = {} }) => {
  try {
    const { queryDataSource } = await import('../src/lib/mediatrader-data.js')
    console.log(`📊 MediaTrader: Querying data source "${sourceId}" with options:`, options)
    const result = queryDataSource(currentProjectRoot, sourceId, options)
    console.log(`✅ MediaTrader: Got ${result.length} rows for "${sourceId}"`)
    return result
  } catch (error) {
    console.error(`❌ Error querying MediaTrader source "${sourceId}":`, error)
    return []
  }
})

// App quit handler
ipcMain.handle('app:quit', () => {
  app.quit()
})
