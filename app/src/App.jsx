import { useState, useEffect, lazy, Suspense } from 'react'
import { initBrowserAPI } from '@/lib/browserAPI'

// Initialize browser API shim if not in Electron
initBrowserAPI()
import {
  Settings,
  Menu,
  Bot,
  LineChart,
  Home as HomeIcon,
  FolderOpen,
  FolderKanban,
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Home from '@/components/Home'
import Overview from '@/components/Overview'
import VisualizationViewer from '@/components/VisualizationViewer'
import ProjectsViewer from '@/components/ProjectsViewer'
import ChatWorkspace from '@/components/ChatWorkspace'
import SidebarChats from '@/components/SidebarChats'
import { useVimiumShortcuts } from '@/hooks/useVimiumShortcuts'
import { MessageSquare } from 'lucide-react'

// Browser-only mode (no Electron)
const isBrowserMode = true

// Dynamic component loader - loads extension components on demand
// Components are mapped by ID to their path in @/components/
// Add instance-specific components here (e.g., 'customers': () => import('@/components/crm/Customers'))
const componentLoaders = {
  'mediatrader': () => import('@/components/tools/MediaTrader'),
}

// Cache for loaded components
const loadedComponents = {}

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
  // Default to chat view, but restore from localStorage if available
  // If ?viz= param is present, go straight to visualizations view
  const [selectedView, setSelectedView] = useState(() => {
    // Use URL captured in index.html before React loads (handles direct URL navigation)
    const initialSearch = window.__INITIAL_SEARCH__ || window.location.search
    console.log('🔍 App.jsx init - initialSearch:', initialSearch, '__INITIAL_SEARCH__:', window.__INITIAL_SEARCH__)
    const params = new URLSearchParams(initialSearch)
    if (params.get('viz') || params.get('project')) {
      console.log('🔍 App.jsx - detected viz/project param, going to visualizations')
      return 'visualizations'
    }
    return localStorage.getItem('localbase-selected-view') || 'chat'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('localbase-sidebar-collapsed') === 'true'
  })
  const [vizKey, setVizKey] = useState(0)
  const [toolNavItems, setToolNavItems] = useState([])
  const [extensionComponents, setExtensionComponents] = useState({})
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

  // Listen for navigate:project events (from viz detail to project tab)
  useEffect(() => {
    const handler = (e) => {
      setSelectedView('projects')
      // Dispatch to ProjectsViewer to open specific project
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('projects:open', { detail: e.detail }))
      }, 50)
    }
    window.addEventListener('navigate:project', handler)
    return () => window.removeEventListener('navigate:project', handler)
  }, [])

  // Browser history management - prevent back button from exiting app
  useEffect(() => {
    // Push initial state on mount
    if (!window.history.state?.view) {
      window.history.replaceState({ view: selectedView }, '', window.location.href)
    }

    const handlePopState = (e) => {
      if (e.state?.view) {
        setSelectedView(e.state.view)
      } else {
        // No previous state - stay on current view (don't exit)
        window.history.pushState({ view: selectedView }, '', window.location.href)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedView])

  // Push to history when view changes (for back button navigation)
  useEffect(() => {
    // Only push if the current state is different
    if (window.history.state?.view !== selectedView) {
      // Preserve query params when changing views
      window.history.pushState({ view: selectedView }, '', window.location.href)
    }
  }, [selectedView])

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

  // Load an extension component dynamically
  const loadExtensionComponent = async (componentId) => {
    if (extensionComponents[componentId]) return // Already loaded
    if (!componentLoaders[componentId]) {
      console.warn(`No loader found for component: ${componentId}`)
      return
    }

    try {
      const module = await componentLoaders[componentId]()
      setExtensionComponents(prev => ({
        ...prev,
        [componentId]: module.default
      }))
    } catch (err) {
      console.error(`Failed to load component ${componentId}:`, err)
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

  // Load extension component when selectedView changes to a tool view
  useEffect(() => {
    if (componentLoaders[selectedView] && !extensionComponents[selectedView]) {
      loadExtensionComponent(selectedView)
    }
  }, [selectedView, extensionComponents])

  // Persist sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('localbase-sidebar-collapsed', sidebarCollapsed)
  }, [sidebarCollapsed])

  // Persist selected view to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('localbase-selected-view', selectedView)
  }, [selectedView])

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

        if (selectedView === 'visualizations') {
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
    // Chat only in browser mode (replaces Terminal/Claude CLI workflow)
    ...(isBrowserMode ? [{ id: 'chat', label: 'Chat', icon: MessageSquare }] : []),
    { id: 'visualizations', label: 'Visualizations', icon: LineChart },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
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
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>{currentWorkspace || 'workspace'}</span>
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
                // Dispatch event to reset viz viewer to gallery (don't remount, just reset state)
                window.dispatchEvent(new CustomEvent('viz:showGallery'))
              }
              setSelectedView(item.id)
            }

            return (
              <div key={item.id} className={item.id === 'chat' ? 'relative' : ''}>
                <Button
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
                {/* Nested Chats list under Chat nav item */}
                {item.id === 'chat' && (
                  <SidebarChats
                    collapsed={sidebarCollapsed}
                    onSelectChat={(conv) => {
                      window.dispatchEvent(new CustomEvent('chat:loadConversation', { detail: conv }))
                    }}
                  />
                )}
              </div>
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
                // In browser mode (no terminal), go to chat instead of live
                setSelectedView(isBrowserMode ? 'chat' : 'live')
              }}
            />
          ) : selectedView === 'visualizations' ? (
            <VisualizationViewer key={vizKey} />
          ) : selectedView === 'projects' ? (
            <ProjectsViewer />
          ) : selectedView === 'settings' ? (
            <Overview onNavigateHome={() => setSelectedView('home')} />
          ) : selectedView === 'chat' ? (
            <ChatWorkspace />
          ) : (() => {
            // Check if this is a dynamically loaded extension component
            const ExtensionComponent = extensionComponents[selectedView]
            if (ExtensionComponent) {
              // Force remount when workspace changes by using workspace as key
              return <ExtensionComponent key={currentWorkspace} />
            }
            // Show loading state while component loads
            if (componentLoaders[selectedView]) {
              return (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading...
                </div>
              )
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
