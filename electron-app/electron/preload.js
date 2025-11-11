const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    destroy: (id) => ipcRenderer.invoke('terminal:destroy', { id }),
    getInfo: () => ipcRenderer.invoke('terminal:getInfo'),
    onData: (callback) => ipcRenderer.on('terminal:data', (event, data) => callback(data)),
    onExit: (callback) => ipcRenderer.on('terminal:exit', (event, data) => callback(data)),
  },
  files: {
    select: () => ipcRenderer.invoke('files:select'),
    selectDirectory: () => ipcRenderer.invoke('files:selectDirectory'),
    getHome: () => ipcRenderer.invoke('files:getHome'),
    listDirectory: (path) => ipcRenderer.invoke('files:listDirectory', path),
  },
  workspace: {
    save: (workspace) => ipcRenderer.invoke('workspace:save', workspace),
    list: () => ipcRenderer.invoke('workspace:list'),
    getActive: () => ipcRenderer.invoke('workspace:getActive'),
  },
  config: {
    getProjectRoot: () => ipcRenderer.invoke('config:getProjectRoot'),
    setProjectRoot: (projectRoot) => ipcRenderer.invoke('config:setProjectRoot', projectRoot),
    saveSupabaseConfig: (config) => ipcRenderer.invoke('config:saveSupabaseConfig', config),
    getSupabaseConfig: () => ipcRenderer.invoke('config:getSupabaseConfig'),
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  vimHints: {
    onTrigger: (callback) => ipcRenderer.on('vim-hint-trigger', (event, data) => callback(data)),
  },
  api: {
    getVisualizations: () => ipcRenderer.invoke('api:getVisualizations'),
    deleteVisualization: (id) => ipcRenderer.invoke('api:deleteVisualization', id),
    getCallMetrics: (params) => ipcRenderer.invoke('api:getCallMetrics', params),
    getTools: () => ipcRenderer.invoke('api:getTools'),
    getToolConfig: (toolId) => ipcRenderer.invoke('api:getToolConfig', toolId),
    getConnectors: () => ipcRenderer.invoke('api:getConnectors'),
    getDataSources: () => ipcRenderer.invoke('api:getDataSources'),
    syncDataSource: (sourceId) => ipcRenderer.invoke('api:syncDataSource', sourceId),
    querySQLite: (params) => ipcRenderer.invoke('api:querySQLite', params),
    syncAutomated: () => ipcRenderer.invoke('api:syncAutomated'),
    readWorkspaceFile: (relativePath) => ipcRenderer.invoke('api:readWorkspaceFile', relativePath),
  },
  db: {
    query: async (query, params = []) => {
      const result = await ipcRenderer.invoke('api:querySQLite', {
        database: 'data/localbase.db',
        query
      })
      if (result.success) {
        return result.data
      } else {
        throw new Error(result.error)
      }
    }
  },
  mediatrader: {
    getDealsCreated: () => ipcRenderer.invoke('mediatrader:getDealsCreated'),
    getBusinessesCreated: () => ipcRenderer.invoke('mediatrader:getBusinessesCreated'),
    getOrganicClicks: () => ipcRenderer.invoke('mediatrader:getOrganicClicks'),
    getOrganicImpressions: () => ipcRenderer.invoke('mediatrader:getOrganicImpressions'),
    getDirectTraffic: () => ipcRenderer.invoke('mediatrader:getDirectTraffic'),
    getYouTubeViews: () => ipcRenderer.invoke('mediatrader:getYouTubeViews'),
    getGooglePaidImpressions: () => ipcRenderer.invoke('mediatrader:getGooglePaidImpressions'),
    getFacebookPaidImpressions: () => ipcRenderer.invoke('mediatrader:getFacebookPaidImpressions'),
    getBingPaidImpressions: () => ipcRenderer.invoke('mediatrader:getBingPaidImpressions'),
    getGoogleAdsSpend: () => ipcRenderer.invoke('mediatrader:getGoogleAdsSpend'),
    getFacebookAdsSpend: () => ipcRenderer.invoke('mediatrader:getFacebookAdsSpend'),
    getBingAdsSpend: () => ipcRenderer.invoke('mediatrader:getBingAdsSpend'),
    queryDataSource: (params) => ipcRenderer.invoke('mediatrader:queryDataSource', params),
  },
  // Plugin IPC methods will be registered here dynamically
  // Example: tools like MediaTrader can extend this with their own IPC handlers
})
