import { useState, useEffect } from 'react'
import { initBrowserAPI } from '@/lib/browserAPI'

// Initialize browser API shim if not in Electron
initBrowserAPI()
import {
  Settings,
  Menu,
  Bot,
  Terminal as TerminalIcon,
  LineChart,
  Home as HomeIcon,
  FolderOpen,
  Layout,
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Home from '@/components/Home'
import Terminal from '@/components/Terminal'
import Overview from '@/components/Overview'
import VisualizationViewer from '@/components/VisualizationViewer'
import LiveWorkspace from '@/components/LiveWorkspace'
import { useVimiumShortcuts } from '@/hooks/useVimiumShortcuts'

// Static imports for tool components (avoiding Vite dynamic import issues)
import MediaTrader from '@/components/tools/MediaTrader'
import Pipeline from '@/components/crm/Pipeline'
import Customers from '@/components/crm/Customers'

// Component mapping for static imports
const toolComponentMap = {
  'mediatrader': MediaTrader,
  'pipeline': Pipeline,
  'customers': Customers
}

// Icon mapping for lucide-react icons
const getIconComponent = (iconName) => {
  const icons = {
    'DollarSign': DollarSign,
    'Users': Users,
    'TrendingUp': TrendingUp,
    'BarChart3': BarChart3
  }
  return icons[iconName] || Package
}

function App() {
  // Enable Vimium-style keyboard shortcuts
  useVimiumShortcuts()

  const [currentWorkspace, setCurrentWorkspace] = useState('')
  const [selectedView, setSelectedView] = useState('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('localbase-sidebar-collapsed') === 'true'
  })
  const [vizKey, setVizKey] = useState(0)
  const [toolNavItems, setToolNavItems] = useState([])
  const [forceSingleWorkspace, setForceSingleWorkspace] = useState(() => {
    return localStorage.getItem('localbase-force-single-workspace') === 'true'
  })

  // Listen for single workspace mode changes
  useEffect(() => {
    const handler = (e) => setForceSingleWorkspace(e.detail)
    window.addEventListener('single-workspace-mode-changed', handler)
    return () => window.removeEventListener('single-workspace-mode-changed', handler)
  }, [])

  // Listen for tab switch requests from components
  useEffect(() => {
    const handler = (e) => setSelectedView(e.detail)
    window.addEventListener('app:switchTab', handler)
    return () => window.removeEventListener('app:switchTab', handler)
  }, [])

  // Load current workspace name
  const loadWorkspace = async () => {
    try {
      if (window.electronAPI?.config) {
        const projectRoot = await window.electronAPI.config.getProjectRoot()
        if (projectRoot) {
          const workspaceName = projectRoot.split('/').pop()
          setCurrentWorkspace(workspaceName)
        } else {
          setCurrentWorkspace('')
        }
      }
    } catch (err) {
      console.error('Failed to load workspace:', err)
    }
  }

  // Load tools with presentation: "sidebar" and build nav items
  const loadToolNavItems = async () => {
    try {
      if (window.electronAPI?.api) {
        const result = await window.electronAPI.api.getTools()
        if (result.success) {
          const sidebarTools = result.tools.filter(tool =>
            tool.config?.presentation === 'sidebar'
          )

          const navItems = []
          sidebarTools.forEach(tool => {
            if (tool.config.routes) {
              // Tool has multiple routes (like CRM)
              tool.config.routes.forEach(route => {
                navItems.push({
                  id: route.id,
                  label: route.label,
                  icon: getIconComponent(route.icon),
                  toolId: tool.id,
                  component: route.component
                })
              })
            } else {
              // Tool is single component (like MediaTrader)
              navItems.push({
                id: tool.id,
                label: tool.name,
                icon: getIconComponent(tool.config.icon || 'Package'),
                toolId: tool.id,
                component: null
              })
            }
          })

          console.log('📊 Loaded tool nav items:', navItems)
          setToolNavItems(navItems)
        }
      }
    } catch (err) {
      console.error('Failed to load tool nav items:', err)
    }
  }

  useEffect(() => {
    loadWorkspace()
    loadToolNavItems()
  }, [])

  // Reload tools when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      console.log('🔄 Workspace changed, reloading tools:', currentWorkspace)
      loadToolNavItems()
    }
  }, [currentWorkspace])

  // Persist sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('localbase-sidebar-collapsed', sidebarCollapsed)
  }, [sidebarCollapsed])

  // Global keyboard handlers
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Command+B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        console.log('📊 App: Command+B - toggling sidebar')
        setSidebarCollapsed(prev => !prev)
        return
      }

      // Command+R: Refresh current view instead of reloading app
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()

        if (selectedView === 'live') {
          console.log('🔄 App: Command+R on Live Workspace - dispatching refresh event')
          window.dispatchEvent(new CustomEvent('liveWorkspace:refresh'))
        } else if (selectedView === 'visualizations') {
          console.log('🔄 App: Command+R on Visualizations - dispatching refresh event')
          window.dispatchEvent(new CustomEvent('visualizations:refresh'))
        } else {
          console.log('🔄 App: Command+R on', selectedView, '- refreshing viz key')
          setVizKey(prev => prev + 1)
        }
        return
      }

      // Escape: Go home (unless vim hints are active or in input field)
      if (e.key === 'Escape') {
        // Don't interfere with vim hints (they handle Escape themselves)
        if (window.vimHintsActive) {
          return
        }

        // Don't interfere when typing in input fields
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) {
          return
        }

        // Don't navigate away from CRM views - let them handle Escape
        if (selectedView === 'pipeline' || selectedView === 'customers') {
          return
        }

        // Go home if not already there
        if (selectedView !== 'home') {
          console.log('🏠 App: Escape pressed - going home')
          setSelectedView('home')
          e.preventDefault()
        }
      }
    }

    // Listen for goHome event (from Terminal component)
    const handleGoHome = () => {
      if (selectedView !== 'home') {
        console.log('🏠 App: Received goHome event - going home')
        setSelectedView('home')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    window.addEventListener('app:goHome', handleGoHome)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      window.removeEventListener('app:goHome', handleGoHome)
    }
  }, [selectedView])

  const handleSwitchWorkspace = () => {
    setSelectedView('home')
  }

  // Build combined navigation: core items + tool items + settings
  // Note: Live Workspace hidden in browser mode (no terminal support)
  const coreNavItems = [
    // { id: 'live', label: 'Live Workspace', icon: Layout },
    { id: 'visualizations', label: 'Visualizations', icon: LineChart },
  ]

  const settingsNavItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const navItems = [...coreNavItems, ...toolNavItems, ...settingsNavItems]

  return (
    <div className="flex h-screen bg-background text-foreground dark flex-col">
      {/* Top Bar */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setSelectedView('home')}
        >
          <Bot className="h-5 w-5 text-green-400" />
          <span className="text-sm font-mono text-muted-foreground">LocalBase</span>
        </div>
        <div className="flex items-center gap-2">
          {forceSingleWorkspace ? (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span>{currentWorkspace || 'workspace'}</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchWorkspace}
              className="text-xs font-mono"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {currentWorkspace || 'workspace'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-64'
          } bg-card border-r border-border transition-all duration-300 flex flex-col`}
        >
        {/* Navigation */}
        <nav className="flex-1 p-2 pt-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const handleClick = () => {
              if (item.id === 'visualizations') {
                setVizKey(prev => prev + 1) // Force remount
              }
              setSelectedView(item.id)
            }

            return (
              <Button
                key={item.id}
                variant={selectedView === item.id ? 'secondary' : 'ghost'}
                className={`w-full mb-1 ${
                  sidebarCollapsed ? 'justify-center px-2' : 'justify-start'
                }`}
                onClick={handleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleClick()
                  }
                }}
              >
                <Icon className="h-4 w-4" />
                {!sidebarCollapsed && (
                  <span className="ml-2">{item.label}</span>
                )}
              </Button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border flex items-center justify-between">
          {!sidebarCollapsed ? (
            <>
              <p className="text-xs text-muted-foreground font-mono">
                <span className="text-primary">&gt;&gt;</span> LocalBase v1.0
              </p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-6 w-6"
              >
                <Menu className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-6 w-6 mx-auto"
            >
              <Menu className="h-3 w-3" />
            </Button>
          )}
        </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
        <div className="h-full">
          {selectedView === 'home' ? (
            <Home
              onWorkspaceSelected={() => {
                loadWorkspace()
                // In browser mode (no terminal), go to visualizations instead of live
                const isBrowserMode = !window.electronAPI?.terminal
                setSelectedView(isBrowserMode ? 'visualizations' : 'live')
              }}
            />
          ) : selectedView === 'visualizations' ? (
            <VisualizationViewer key={vizKey} />
          ) : selectedView === 'live' ? (
            <LiveWorkspace />
          ) : selectedView === 'settings' ? (
            <Overview onNavigateHome={() => setSelectedView('home')} />
          ) : (() => {
            // Check if this is a tool view
            const ToolComponent = toolComponentMap[selectedView]
            if (ToolComponent) {
              // Force remount when workspace changes by using workspace as key
              return <ToolComponent key={currentWorkspace} />
            }
            return null
          })()}
        </div>
        </div>
      </div>
    </div>
  )
}

export default App
