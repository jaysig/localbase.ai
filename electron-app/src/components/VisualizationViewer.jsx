import { useState, useEffect, useRef } from 'react'
import { X, BarChart3, Trash2, LayoutGrid, List, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CallMetricsChart from '@/components/charts/CallMetricsChart'

// Helper to build viz URLs - uses HTTP in browser mode, localbase:// in Electron
const buildVizUrl = (vizPath) => {
  const isBrowserMode = !window.electronAPI?.terminal
  const path = vizPath.replace(/^\//, '')
  const timestamp = Date.now()
  if (isBrowserMode) {
    return `http://localhost:3000/${path}?t=${timestamp}`
  }
  return `localbase://${path}?t=${timestamp}`
}

export default function VisualizationViewer() {
  const [visualizations, setVisualizations] = useState([])
  const [selectedViz, setSelectedViz] = useState(null)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viz-view-mode') || 'grid'
  })
  const [typeFilter, setTypeFilter] = useState(() => {
    return localStorage.getItem('viz-type-filter') || 'all'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [iframeKey, setIframeKey] = useState(0)
  const searchInputRef = useRef(null)

  useEffect(() => {
    // Fetch visualizations via IPC
    const fetchVisualizations = async () => {
      try {
        const data = await window.electronAPI.api.getVisualizations()
        setVisualizations(data.visualizations || [])
      } catch (err) {
        console.error('Failed to fetch visualizations:', err)
      }
    }

    // Initial fetch
    fetchVisualizations()

    // DISABLED: 3-second polling causes iframe reloads
    // Poll every 30 seconds for new visualizations (reduced frequency)
    const interval = setInterval(fetchVisualizations, 30000)

    return () => clearInterval(interval)
  }, [])

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('viz-view-mode', viewMode)
  }, [viewMode])

  // Save type filter to localStorage
  useEffect(() => {
    localStorage.setItem('viz-type-filter', typeFilter)
  }, [typeFilter])

  // Listen for refresh event from App.jsx
  useEffect(() => {
    const handleRefresh = () => {
      console.log('🔄 VisualizationViewer: Received refresh event')
      setIframeKey(prev => prev + 1)
    }

    window.addEventListener('visualizations:refresh', handleRefresh)
    return () => window.removeEventListener('visualizations:refresh', handleRefresh)
  }, [])

  // Command+L keyboard shortcut to focus search, Escape to clear and blur
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
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

  // Check localStorage on mount for viz to open from LiveWorkspace
  useEffect(() => {
    const vizToOpen = localStorage.getItem('vizViewer_openOnMount')
    if (vizToOpen && visualizations.length > 0) {
      localStorage.removeItem('vizViewer_openOnMount')

      try {
        const vizFromLiveWorkspace = JSON.parse(vizToOpen)

        // Try to find matching viz in visualizations list by id or filename
        const matchingViz = visualizations.find(v =>
          v.id === vizFromLiveWorkspace.id ||
          v.filename === vizFromLiveWorkspace.filename
        )

        if (matchingViz) {
          setSelectedViz(matchingViz)
        } else {
          // Construct a proper viz object with the right url format
          const constructedViz = {
            ...vizFromLiveWorkspace,
            url: vizFromLiveWorkspace.filename ? `app/viz/${vizFromLiveWorkspace.filename}` : vizFromLiveWorkspace.url.replace(/^localbase:\/\//, '').replace(/\?t=\d+$/, '')
          }
          setSelectedViz(constructedViz)
        }
      } catch (err) {
        console.error('Failed to parse viz from localStorage:', err)
      }
    }
  }, [visualizations])

  const handleDelete = async (e, viz) => {
    e.stopPropagation() // Prevent card click

    if (!confirm(`Delete "${viz.title}"?\n\nThis will permanently delete the visualization file and cannot be undone.`)) {
      return
    }

    setDeletingId(viz.id)
    try {
      const result = await window.electronAPI.api.deleteVisualization(viz.id)
      if (result.success) {
        // Remove from local state immediately
        setVisualizations(prev => prev.filter(v => v.id !== viz.id))
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (err) {
      alert(`Error deleting visualization: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handlePin = async (e, viz) => {
    e.stopPropagation() // Prevent card click

    try {
      const newPinnedState = !viz.pinned
      const result = await window.electronAPI.api.toggleVizPin(viz.id, newPinnedState)

      if (result.success) {
        // Update local state immediately
        setVisualizations(prev => prev.map(v =>
          v.id === viz.id ? { ...v, pinned: newPinnedState } : v
        ))
      } else {
        alert(`Failed to ${newPinnedState ? 'pin' : 'unpin'}: ${result.error}`)
      }
    } catch (err) {
      alert(`Error ${viz.pinned ? 'unpinning' : 'pinning'} visualization: ${err.message}`)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Memoize iframe URL to prevent unnecessary reloads
  const [iframeUrl, setIframeUrl] = useState('')

  useEffect(() => {
    if (selectedViz) {
      // Only update URL when selectedViz ID changes or iframeKey changes (manual refresh)
      const url = buildVizUrl(selectedViz.url)
      console.log('🔄 VisualizationViewer: Setting iframe URL:', { id: selectedViz.id, iframeKey })
      setIframeUrl(url)
    }
  }, [selectedViz?.id, iframeKey])

  // Show selected viz full-screen
  if (selectedViz) {
    console.log('🖼️ VisualizationViewer: Rendering full-screen view, iframeUrl:', iframeUrl, 'iframeKey:', iframeKey)
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-green-400">{selectedViz.title}</h3>
            <p className="text-xs text-muted-foreground">
              {selectedViz.library} • {selectedViz.type} • {formatDate(selectedViz.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground/60 font-mono mt-1 select-all cursor-text">
              ID: {selectedViz.id} • app/viz/{selectedViz.filename}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedViz(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Back to Gallery
          </Button>
        </div>
        <div className="flex-1 bg-background overflow-auto">
          {/* Render native React charts for specific IDs */}
          {selectedViz.id === 'kpi002' || selectedViz.id === 'call-kpi-dashboard' ? (
            <CallMetricsChart />
          ) : (
            <iframe
              key={iframeKey}
              src={iframeUrl}
              className="w-full h-full border-0"
              title={selectedViz.title}
              onLoad={() => console.log('✅ VisualizationViewer: Iframe loaded')}
            />
          )}
        </div>
      </div>
    )
  }

  // Get unique types from visualizations
  const vizTypes = [...new Set(visualizations.map(v => v.type))].sort()

  // Filter visualizations by type and search query, then sort by most recent first
  let filteredVisualizations = visualizations

  // Apply type filter
  if (typeFilter !== 'all') {
    filteredVisualizations = filteredVisualizations.filter(v => v.type === typeFilter)
  }

  // Apply search filter (search in title, filename, and id)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filteredVisualizations = filteredVisualizations.filter(v =>
      v.title?.toLowerCase().includes(query) ||
      v.filename?.toLowerCase().includes(query) ||
      v.id?.toLowerCase().includes(query)
    )
  }

  // Sort by createdAt date (most recent first)
  filteredVisualizations = [...filteredVisualizations].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created || 0)
    const dateB = new Date(b.createdAt || b.created || 0)
    return dateB - dateA // Newest first
  })

  // Separate pinned and unpinned visualizations
  const pinnedViz = filteredVisualizations.filter(v => v.pinned)
  const unpinnedViz = filteredVisualizations.filter(v => !v.pinned)

  // Show visualization gallery
  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-400">Visualizations</h2>
          <p className="text-muted-foreground text-sm">Browse and view your LocalBase visualizations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search visualizations by title, filename, or ID... (⌘L)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-green-400 focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type Filter Pills */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Button
          variant={typeFilter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setTypeFilter('all')}
          className="h-8 px-3 text-xs"
        >
          All ({visualizations.length})
        </Button>
        {vizTypes.map(type => {
          const count = visualizations.filter(v => v.type === type).length
          return (
            <Button
              key={type}
              variant={typeFilter === type ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter(type)}
              className="h-8 px-3 text-xs capitalize"
            >
              {type} ({count})
            </Button>
          )
        })}
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          {/* Pinned Section */}
          {pinnedViz.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400" />
                Pinned ({pinnedViz.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedViz.map((viz) => (
          <Card
            key={viz.id}
            className="group cursor-pointer transition-all hover:border-green-400/50 overflow-hidden"
            onClick={() => {
              console.log('🖱️ VisualizationViewer: Card clicked:', viz.title)

              // Prepare viz data for LiveWorkspace
              const vizData = {
                id: viz.id,
                title: viz.title,
                filename: viz.filename,
                url: buildVizUrl(`viz/${viz.filename}`)
              }

              // Save to localStorage (for when LiveWorkspace isn't mounted yet)
              console.log('💾 VisualizationViewer: Saving to localStorage for LiveWorkspace')
              localStorage.setItem('liveWorkspace_lastSession', JSON.stringify(vizData))

              // Also dispatch event (for when LiveWorkspace IS already mounted)
              console.log('📤 VisualizationViewer: Dispatching event to LiveWorkspace')
              window.dispatchEvent(new CustomEvent('liveWorkspace:loadViz', { detail: viz }))

              // Show in full-screen viewer
              console.log('🖼️ VisualizationViewer: Opening full-screen view')
              setSelectedViz(viz)
            }}
          >
            <div className="flex gap-3 p-3">
              {/* Icon placeholder (no iframe preview to avoid loading all visualizations) */}
              <div className="w-20 h-20 flex-shrink-0 bg-background/50 relative overflow-hidden rounded border border-border/50 flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-green-400/30" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-start gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <h3 className="text-sm font-semibold leading-tight">{viz.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {viz.description || `Created ${formatDate(viz.createdAt)}`}
                </p>
                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="capitalize">{viz.type}</span>
                  <span>•</span>
                  <span>{viz.library}</span>
                </div>
              </div>
              {/* Pin button */}
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 transition-opacity ${viz.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => handlePin(e, viz)}
              >
                <Star className={`h-4 w-4 ${viz.pinned ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`} />
              </Button>
              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => handleDelete(e, viz)}
                disabled={deletingId === viz.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
                ))}
              </div>
            </div>
          )}

          {/* All/Unpinned Section */}
          {unpinnedViz.length > 0 && (
            <div>
              {pinnedViz.length > 0 && (
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  All Visualizations ({unpinnedViz.length})
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinnedViz.map((viz) => (
          <Card
            key={viz.id}
            className="group cursor-pointer transition-all hover:border-green-400/50 overflow-hidden"
            onClick={() => {
              console.log('🖱️ VisualizationViewer: Card clicked:', viz.title)

              // Prepare viz data for LiveWorkspace
              const vizData = {
                id: viz.id,
                title: viz.title,
                filename: viz.filename,
                url: buildVizUrl(`viz/${viz.filename}`)
              }

              // Save to localStorage (for when LiveWorkspace isn't mounted yet)
              console.log('💾 VisualizationViewer: Saving to localStorage for LiveWorkspace')
              localStorage.setItem('liveWorkspace_lastSession', JSON.stringify(vizData))

              // Also dispatch event (for when LiveWorkspace IS already mounted)
              console.log('📤 VisualizationViewer: Dispatching event to LiveWorkspace')
              window.dispatchEvent(new CustomEvent('liveWorkspace:loadViz', { detail: viz }))

              // Show in full-screen viewer
              console.log('🖼️ VisualizationViewer: Opening full-screen view')
              setSelectedViz(viz)
            }}
          >
            <div className="flex gap-3 p-3">
              {/* Icon placeholder (no iframe preview to avoid loading all visualizations) */}
              <div className="w-20 h-20 flex-shrink-0 bg-background/50 relative overflow-hidden rounded border border-border/50 flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-green-400/30" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-start gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <h3 className="text-sm font-semibold leading-tight">{viz.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {viz.description || `Created ${formatDate(viz.createdAt)}`}
                </p>
                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="capitalize">{viz.type}</span>
                  <span>•</span>
                  <span>{viz.library}</span>
                </div>
              </div>
              {/* Pin button */}
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 transition-opacity ${viz.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => handlePin(e, viz)}
              >
                <Star className={`h-4 w-4 ${viz.pinned ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`} />
              </Button>
              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => handleDelete(e, viz)}
                disabled={deletingId === viz.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredVisualizations.map((viz) => (
            <Card
              key={viz.id}
              className="group cursor-pointer transition-all hover:border-green-400/50"
              onClick={() => {
                console.log('🖱️ VisualizationViewer: Card clicked:', viz.title)

                // Prepare viz data for LiveWorkspace
                const vizData = {
                  id: viz.id,
                  title: viz.title,
                  filename: viz.filename,
                  url: buildVizUrl(`viz/${viz.filename}`)
                }

                // Save to localStorage (for when LiveWorkspace isn't mounted yet)
                console.log('💾 VisualizationViewer: Saving to localStorage for LiveWorkspace')
                localStorage.setItem('liveWorkspace_lastSession', JSON.stringify(vizData))

                // Also dispatch event (for when LiveWorkspace IS already mounted)
                console.log('📤 VisualizationViewer: Dispatching event to LiveWorkspace')
                window.dispatchEvent(new CustomEvent('liveWorkspace:loadViz', { detail: viz }))

                // Show in full-screen viewer
                console.log('🖼️ VisualizationViewer: Opening full-screen view')
                setSelectedViz(viz)
              }}
            >
              <div className="flex items-center gap-4 p-4">
                <BarChart3 className="h-5 w-5 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{viz.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {viz.description || `Created ${formatDate(viz.createdAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="capitalize">{viz.type}</span>
                  <span>{viz.library}</span>
                  <span>{formatDate(viz.createdAt)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={(e) => handleDelete(e, viz)}
                  disabled={deletingId === viz.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {visualizations.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No visualizations found</p>
          <p className="text-xs mt-2">Create visualizations in LocalBase to see them here</p>
        </div>
      )}

      {visualizations.length > 0 && filteredVisualizations.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No {typeFilter} visualizations found</p>
          <p className="text-xs mt-2">Try selecting a different filter</p>
        </div>
      )}
    </div>
  )
}
