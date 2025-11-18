import { useState, useEffect, useRef } from 'react'
import { Split, RefreshCw, Maximize2, Minimize2, X, Bot, Search, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Terminal from '@/components/Terminal'

/**
 * LiveWorkspace - Terminal + 2-Tab Visualization Preview
 *
 * Tab 1: Last Session (persists to localStorage)
 * Tab 2: New File (session only)
 */
export default function LiveWorkspace() {
  const [layoutMode, setLayoutMode] = useState('horizontal') // 'horizontal' | 'vertical'
  const [iframeKey, setIframeKey] = useState(0)
  const terminalRef = useRef(null)

  // Single session state - stores { id, title, filename, url }
  const [currentViz, setCurrentViz] = useState(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allVisualizations, setAllVisualizations] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef(null)

  // Draggable divider state
  const [splitPosition, setSplitPosition] = useState(35) // percentage - terminal gets 35%, preview gets 65%
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  // Load last session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('liveWorkspace_session')
    console.log('🔄 LiveWorkspace: Loading from localStorage:', saved ? 'Found' : 'Empty')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        console.log('✅ LiveWorkspace: Loaded session:', parsed.title)
        setCurrentViz(parsed)
      } catch (e) {
        console.error('❌ LiveWorkspace: Failed to parse saved session:', e)
      }
    } else {
      console.log('💡 LiveWorkspace: No saved session - use search to find a visualization')
    }
  }, [])

  // Load visualizations for search
  useEffect(() => {
    const fetchVisualizations = async () => {
      try {
        const data = await window.electronAPI.api.getVisualizations()
        setAllVisualizations(data.visualizations || [])
        setSearchResults(data.visualizations || [])
      } catch (err) {
        console.error('Failed to fetch visualizations:', err)
      }
    }
    fetchVisualizations()
  }, [])

  // Fuzzy search - show recent or filtered + "Create New" option
  useEffect(() => {
    let results
    if (!searchQuery.trim()) {
      // Show 3 most recent when not searching
      results = [...allVisualizations]
        .sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created || 0)
          const dateB = new Date(b.createdAt || b.created || 0)
          return dateB - dateA
        })
        .slice(0, 3)
    } else {
      // Filter when searching
      const query = searchQuery.toLowerCase()
      results = allVisualizations.filter(viz => {
        const title = (viz.title || '').toLowerCase()
        const filename = (viz.filename || '').toLowerCase()
        const type = (viz.type || '').toLowerCase()
        return title.includes(query) || filename.includes(query) || type.includes(query)
      })
    }

    setSearchResults(results)
    setSelectedIndex(0)
  }, [searchQuery, allVisualizations])

  // Cmd+K or Cmd+L shortcut to focus, Escape to clear and blur
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'l')) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (currentViz) {
      console.log('💾 LiveWorkspace: Saving to localStorage:', currentViz.title)
      localStorage.setItem('liveWorkspace_session', JSON.stringify(currentViz))
    }
  }, [currentViz])

  // Listen for viz selection from grid (via custom event)
  useEffect(() => {
    const handleVizSelect = (event) => {
      const viz = event.detail
      console.log('📥 LiveWorkspace: Received viz selection:', viz.title)

      setCurrentViz({
        id: viz.id,
        title: viz.title,
        filename: viz.filename,
        url: `localbase://viz/${viz.filename}?t=${Date.now()}`
      })
    }

    console.log('👂 LiveWorkspace: Event listener attached')
    window.addEventListener('liveWorkspace:loadViz', handleVizSelect)
    return () => {
      console.log('🔇 LiveWorkspace: Event listener removed')
      window.removeEventListener('liveWorkspace:loadViz', handleVizSelect)
    }
  }, [])

  // Listen for new viz files being created
  useEffect(() => {
    if (!window.electronAPI?.viz?.onNewFile) return

    const handleNewFile = async (filename) => {
      console.log('✨ LiveWorkspace: New viz file detected:', filename)

      // Create a viz object from the filename
      const title = filename.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      const viz = {
        id: `temp-${Date.now()}`,
        title: title,
        filename: filename,
        url: `app/viz/${filename}`
      }

      console.log('🚀 LiveWorkspace: Auto-loading new viz:', title)

      setCurrentViz({
        id: viz.id,
        title: viz.title,
        filename: viz.filename,
        url: `localbase://viz/${viz.filename}?t=${Date.now()}`
      })
    }

    console.log('👁️ LiveWorkspace: Watching for new viz files')
    const cleanup = window.electronAPI.viz.onNewFile(handleNewFile)

    return () => {
      console.log('👁️ LiveWorkspace: Stopped watching for new viz files')
      if (cleanup) cleanup()
    }
  }, [])

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1)
    if (currentViz) {
      const updated = {
        ...currentViz,
        url: currentViz.url.replace(/t=\d+/, `t=${Date.now()}`)
      }
      setCurrentViz(updated)
    }
  }

  const handleClearSession = () => {
    setCurrentViz(null)
    localStorage.removeItem('liveWorkspace_session')
    setSearchQuery('')
  }

  const handleOpenInViewer = () => {
    if (!currentViz) return

    // Store viz to open in localStorage for VisualizationViewer to pick up
    localStorage.setItem('vizViewer_openOnMount', JSON.stringify(currentViz))

    // Switch to Visualizations tab
    window.dispatchEvent(new CustomEvent('app:switchTab', {
      detail: 'visualizations'
    }))
  }

  // Listen for refresh event from App.jsx
  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('🔄 LiveWorkspace: Received refresh event')
      handleRefresh()
    }

    console.log('⌨️  LiveWorkspace: Refresh listener attached')
    window.addEventListener('liveWorkspace:refresh', handleRefreshEvent)
    return () => {
      console.log('⌨️  LiveWorkspace: Refresh listener removed')
      window.removeEventListener('liveWorkspace:refresh', handleRefreshEvent)
    }
  }, [currentViz]) // Include deps so handleRefresh has current state

  // Watch current viz file for changes and auto-reload
  useEffect(() => {
    if (!currentViz || !currentViz.filename || !window.electronAPI?.viz) return

    console.log('👁️ LiveWorkspace: Starting file watch for:', currentViz.filename)

    // Start watching the file
    window.electronAPI.viz.watchFile(currentViz.filename)

    // Listen for file changes
    const handleFileChange = (filename) => {
      if (filename === currentViz.filename) {
        console.log('🔄 LiveWorkspace: File changed, auto-reloading:', filename)
        handleRefresh()
      }
    }

    window.electronAPI.viz.onFileChanged(handleFileChange)

    // Cleanup: stop watching when viz changes
    return () => {
      console.log('👁️ LiveWorkspace: Stopping file watch for:', currentViz.filename)
      window.electronAPI.viz.unwatchFile(currentViz.filename)
    }
  }, [currentViz])

  const toggleLayout = () => {
    setLayoutMode(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')
  }

  const handleGetStarted = () => {
    if (terminalRef.current) {
      terminalRef.current.focus()
    }
  }

  // Dragging handlers
  const handleMouseDown = () => {
    setIsDragging(true)
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()

    let newPosition
    if (layoutMode === 'horizontal') {
      const x = e.clientX - rect.left
      newPosition = (x / rect.width) * 100
    } else {
      const y = e.clientY - rect.top
      newPosition = (y / rect.height) * 100
    }

    // Clamp between 20% and 80%
    newPosition = Math.max(20, Math.min(80, newPosition))
    setSplitPosition(newPosition)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, layoutMode])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-green-400">Live Workspace</h3>
          <span className="text-[10px] text-muted-foreground">
            Terminal + Live Preview • Changes auto-refresh
          </span>
        </div>
        <div className="flex gap-1">
          {currentViz && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInViewer}
              className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
              title="Open in Visualizations Viewer"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
            title="Refresh Preview (⌘R)"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Split View */}
      <div
        ref={containerRef}
        className={`flex-1 flex ${layoutMode === 'horizontal' ? 'flex-row' : 'flex-col'} relative`}
      >
        {/* Terminal Pane */}
        <div
          className="overflow-hidden"
          style={{
            [layoutMode === 'horizontal' ? 'width' : 'height']: `${splitPosition}%`
          }}
        >
          <div className="h-full">
            <Terminal ref={terminalRef} />
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className={`
            ${layoutMode === 'horizontal' ? 'w-1 cursor-col-resize hover:w-1.5' : 'h-1 cursor-row-resize hover:h-1.5'}
            bg-border hover:bg-green-400/50 transition-all
            ${isDragging ? 'bg-green-400' : ''}
          `}
          style={{ flexShrink: 0 }}
        />

        {/* Preview Pane */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            [layoutMode === 'horizontal' ? 'width' : 'height']: `${100 - splitPosition}%`
          }}
        >
          {/* Tab Bar */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {currentViz?.title || 'Live Session'}
              </span>
              {currentViz && (
                <span className="text-xs text-muted-foreground">
                  • {currentViz.filename}
                </span>
              )}
            </div>
            {currentViz && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Content Area */}
          {currentViz ? (
            <div className="flex-1 overflow-auto bg-background">
              <iframe
                key={`${iframeKey}-${currentViz.url}`}
                src={currentViz.url}
                className="w-full h-full border-0"
                title="Live Preview"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
              <div className="w-full max-w-2xl">
                {/* Search Box */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      const totalOptions = searchResults.length + 1 // +1 for "Create New"

                      if (e.key === 'ArrowDown' || e.key === 'Tab') {
                        e.preventDefault()
                        setSelectedIndex(prev => (prev + 1) % totalOptions)
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions)
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        // "Create New" is the last option
                        if (selectedIndex === searchResults.length) {
                          // Focus terminal
                          terminalRef.current?.focus()
                          setSearchQuery('')
                        } else if (searchResults[selectedIndex]) {
                          // Load viz
                          const viz = searchResults[selectedIndex]
                          setCurrentViz({
                            id: viz.id,
                            title: viz.title,
                            filename: viz.filename,
                            url: `localbase://viz/${viz.filename}?t=${Date.now()}`
                          })
                          setSearchQuery('')
                        }
                      } else if (e.key === 'Escape') {
                        setSearchQuery('')
                        searchInputRef.current?.blur()
                      }
                    }}
                    placeholder="Search visualizations... (⌘K)"
                    className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400"
                    autoFocus
                  />
                </div>

                {/* Results - Recent or Filtered */}
                <div className="bg-card border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <>
                      {/* Viz Results */}
                      {searchResults.map((viz, idx) => (
                        <button
                          key={viz.id}
                          onClick={() => {
                            setCurrentViz({
                              id: viz.id,
                              title: viz.title,
                              filename: viz.filename,
                              url: `localbase://viz/${viz.filename}?t=${Date.now()}`
                            })
                            setSearchQuery('')
                          }}
                          className={`
                            w-full px-4 py-3 text-left hover:bg-background/50 transition-colors border-b border-border
                            ${idx === selectedIndex ? 'bg-background/50 ring-2 ring-inset ring-green-400/50' : ''}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {viz.title}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                <span className="capitalize">{viz.type}</span>
                                <span className="mx-2">•</span>
                                <span className="font-mono">{viz.filename}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}

                      {/* Create New Option */}
                      <button
                        onClick={() => {
                          terminalRef.current?.focus()
                          setSearchQuery('')
                        }}
                        className={`
                          w-full px-4 py-3 text-left hover:bg-background/50 transition-colors
                          ${selectedIndex === searchResults.length ? 'bg-background/50 ring-2 ring-inset ring-green-400/50' : ''}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Bot className="h-4 w-4 text-green-400 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-medium text-foreground">Create New</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Start fresh with Claude in the terminal
                            </div>
                          </div>
                        </div>
                      </button>
                    </>
                  ) : (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      {searchQuery ? (
                        <>No visualizations found for "{searchQuery}"</>
                      ) : (
                        <>No visualizations yet. Create your first one!</>
                      )}
                    </div>
                  )}
                </div>

                {/* Helper Text */}
                <div className="text-center mt-4 text-muted-foreground">
                  <p className="text-xs">
                    {!searchQuery ? 'Recent visualizations' : 'Search results'} • Use{' '}
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono ml-0.5">↓</kbd>
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono ml-1">Tab</kbd>
                    {' '}to navigate • Press{' '}
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd>
                    {' '}to focus
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
