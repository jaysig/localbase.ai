/**
 * Browser API shim - replaces window.electronAPI for browser-only mode
 * Calls Express server at localhost:3000 instead of Electron IPC
 */

const API_BASE = 'http://localhost:3000';

/**
 * Get auth token from localStorage
 */
export function getAuthToken() {
  return localStorage.getItem('localbase-auth-token');
}

/**
 * Make authenticated fetch request
 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  // If we get 401, clear token and reload to show login
  if (response.status === 401) {
    const data = await response.json();
    if (data.authEnabled) {
      localStorage.removeItem('localbase-auth-token');
      window.location.reload();
    }
  }

  return response;
}

export const browserAPI = {
  config: {
    async getProjectRoot() {
      const res = await authFetch(`${API_BASE}/api/workspace`);
      const data = await res.json();
      return data.success ? data.path : null;
    },
    async setProjectRoot(path) {
      const res = await authFetch(`${API_BASE}/api/workspace/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      if (data.success) {
        // Notify components that workspace changed
        window.dispatchEvent(new CustomEvent('workspace:changed', { detail: path }));
      }
      return data;
    }
  },

  api: {
    async getVisualizations() {
      const res = await authFetch(`${API_BASE}/api/viz`);
      const data = await res.json();
      return data.success ? { success: true, visualizations: data.visualizations, projectsWithPresentation: data.projectsWithPresentation || [] } : data;
    },
    async deleteVisualization(id) {
      const res = await authFetch(`${API_BASE}/api/viz/${id}`, { method: 'DELETE' });
      return res.json();
    },
    async getTools() {
      const res = await authFetch(`${API_BASE}/api/tools`);
      const data = await res.json();
      return data.success ? data : { success: true, tools: [] };
    },
    async getConnectors() {
      const res = await authFetch(`${API_BASE}/api/connectors`);
      const data = await res.json();
      return data.success ? data : { success: true, connectors: [] };
    },
    async getDataSources() {
      const res = await authFetch(`${API_BASE}/api/datasources`);
      const data = await res.json();
      return data.success ? data : { success: true, dataSources: [] };
    },
    async getToolConfig(toolId) {
      const res = await authFetch(`${API_BASE}/api/tools/${toolId}/config`);
      return res.json();
    },
    async readWorkspaceFile(relativePath) {
      const res = await authFetch(`${API_BASE}/api/workspace/file?path=${encodeURIComponent(relativePath)}`);
      return res.json();
    },
    async syncDataSource(sourceId) {
      const res = await authFetch(`${API_BASE}/api/datasources/${sourceId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    },
    async toggleVizPin(id, pinned) {
      const res = await authFetch(`${API_BASE}/api/viz/${id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned })
      });
      return res.json();
    }
  },

  files: {
    async getHome() {
      // In browser mode, return null to signal Home.jsx to use /api/workspaces instead
      return null;
    },
    async listDirectory(path) {
      // Not available in browser mode - Home.jsx should use /api/workspaces
      return [];
    }
  },

  // Workspaces API - browser mode uses this instead of filesystem scanning
  workspaces: {
    async list() {
      const res = await authFetch(`${API_BASE}/api/workspaces`);
      return res.json();
    }
  },

  // Workspace management
  workspace: {
    async create({ workspaceName, parentDir }) {
      const res = await authFetch(`${API_BASE}/api/workspace/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceName, parentDir })
      });
      return res.json();
    },
    async delete(workspacePath) {
      const res = await authFetch(`${API_BASE}/api/workspace`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workspacePath })
      });
      return res.json();
    }
  },

  // Terminal is not available in browser mode
  terminal: null,

  // DB queries go through server - matches Electron's hardcoded localbase.db
  db: {
    async query(sql, params = []) {
      const res = await authFetch(`${API_BASE}/api/db/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: 'data/localbase.db',
          sql,
          params
        })
      });
      const result = await res.json();
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    }
  },

  // MediaTrader specific API - queryDataSource using config-driven system
  mediatrader: {
    async queryDataSource(params) {
      const res = await authFetch(`${API_BASE}/api/mediatrader/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: params.sourceId,
          options: params.options || {}
        })
      });
      const result = await res.json();
      // The endpoint returns array directly on success, or {success: false, error} on failure
      return Array.isArray(result) ? result : [];
    }
  }
};

/**
 * Initialize browser API - call this on app startup
 * Sets window.electronAPI to browserAPI if not in Electron
 */
export function initBrowserAPI() {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    console.log('🌐 Browser mode detected - using browserAPI shim');
    window.electronAPI = browserAPI;
  }
}
