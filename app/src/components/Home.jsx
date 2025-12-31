import { Bot, Database, Check, CornerDownLeft, Plus, FolderPlus } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function Home({ onWorkspaceSelected }) {
  const canvasRef = useRef(null)
  const [availableProjects, setAvailableProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [currentWorkspace, setCurrentWorkspace] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [creating, setCreating] = useState(false)
  const [forceSingleWorkspace, setForceSingleWorkspace] = useState(() => {
    return localStorage.getItem('localbase-force-single-workspace') === 'true'
  })

  // Listen for single workspace mode changes
  useEffect(() => {
    const handler = (e) => setForceSingleWorkspace(e.detail)
    window.addEventListener('single-workspace-mode-changed', handler)
    return () => window.removeEventListener('single-workspace-mode-changed', handler)
  }, [])

  // Load current workspace name and scan for projects
  useEffect(() => {
    const loadWorkspace = async () => {
      if (window.electronAPI?.config) {
        const projectRoot = await window.electronAPI.config.getProjectRoot()
        if (projectRoot) {
          const workspaceName = projectRoot.split('/').pop()
          setCurrentWorkspace(workspaceName)
        } else {
          setCurrentWorkspace('')
        }
      }
    }
    loadWorkspace()
    scanForProjects()
  }, [])

  // Scan for available projects
  const scanForProjects = async () => {
    setScanning(true)
    const projects = []

    try {
      // Browser mode: use workspaces API
      if (window.electronAPI?.workspaces) {
        const result = await window.electronAPI.workspaces.list()
        if (result.success && result.workspaces) {
          setAvailableProjects(result.workspaces.map(ws => ({
            name: ws.name,
            path: ws.path,
            active: ws.active
          })))
          setScanning(false)
          return
        }
      }

      // Electron mode: scan filesystem
      if (!window.electronAPI?.files) {
        setScanning(false)
        return
      }

      const home = await window.electronAPI.files.getHome()
      if (!home) {
        // Browser mode fallback - no home directory available
        setScanning(false)
        return
      }

      const locationsToScan = [`${home}/Work`, home]

      for (const location of locationsToScan) {
        try {
          const entries = await window.electronAPI.files.listDirectory(location)
          for (const entry of entries) {
            if (entry.isDirectory) {
              const fullPath = `${location}/${entry.name}`
              const isLocalBase = await checkIfLocalBaseProject(fullPath)
              if (isLocalBase) {
                projects.push({
                  name: entry.name,
                  path: fullPath,
                  modified: entry.modified
                })
              }
            }
          }
        } catch (err) {
          console.error(`Failed to scan ${location}:`, err)
        }
      }

      const filteredProjects = projects.filter(p => p.name !== 'localbase.ai')
      setAvailableProjects(filteredProjects)
    } catch (err) {
      console.error('Scan error:', err)
    } finally {
      setScanning(false)
    }
  }

  const checkIfLocalBaseProject = async (dirPath) => {
    try {
      const entries = await window.electronAPI.files.listDirectory(dirPath)
      const entryNames = entries.map(e => e.name)
      const hasConnectors = entryNames.includes('connectors')
      const hasTools = entryNames.includes('tools')
      const hasPackageJson = entryNames.includes('package.json')
      return hasConnectors && hasTools && hasPackageJson
    } catch {
      return false
    }
  }

  const handleProjectSelect = async () => {
    if (!selectedProject || !window.electronAPI?.config) return

    try {
      await window.electronAPI.config.setProjectRoot(selectedProject.path)
      localStorage.setItem('localbase-workspace-selected', 'true')
      localStorage.setItem('localbase-selected-view', 'live')
      onWorkspaceSelected()
    } catch (err) {
      console.error('Failed to save project root:', err)
    }
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !window.electronAPI?.workspace) return

    setCreating(true)
    try {
      // In browser mode, files.getHome() returns null - server defaults to ~/Work
      const home = await window.electronAPI.files?.getHome?.()
      const parentDir = home ? `${home}/Work` : null

      const result = await window.electronAPI.workspace.create({
        workspaceName: newWorkspaceName.trim(),
        parentDir
      })

      if (result.success) {
        // Auto-select the new workspace
        await window.electronAPI.config.setProjectRoot(result.workspacePath)
        localStorage.setItem('localbase-workspace-selected', 'true')
        localStorage.setItem('localbase-selected-view', 'live')
        onWorkspaceSelected()
      } else {
        alert(`Failed to create workspace: ${result.error}`)
      }
    } catch (err) {
      console.error('Failed to create workspace:', err)
      alert(`Failed to create workspace: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // Create stars flying from center - WIDE VIEW
    const stars = Array.from({ length: 800 }, () => {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * 2000
      return {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        z: Math.random() * 3000,
        angle: angle,
        speed: Math.random() * 6 + 2
      }
    })

    let animationId
    const animate = () => {
      // Fade effect instead of clear for motion blur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      stars.forEach(star => {
        // Move star towards camera
        star.z -= star.speed

        // Reset star when it goes past camera
        if (star.z <= 0) {
          star.z = 3000
          star.angle = Math.random() * Math.PI * 2
          const distance = Math.random() * 2000
          star.x = centerX + Math.cos(star.angle) * distance
          star.y = centerY + Math.sin(star.angle) * distance
        }

        // 3D projection
        const k = 128 / star.z
        const px = (star.x - centerX) * k + centerX
        const py = (star.y - centerY) * k + centerY

        // Star size based on depth (closer = bigger)
        const size = (1 - star.z / 3000) * 0.8

        // Brightness based on depth
        const opacity = (1 - star.z / 3000) * 0.7

        // Draw star with motion trail
        const prevZ = star.z + star.speed
        const prevK = 128 / prevZ
        const prevPx = (star.x - centerX) * prevK + centerX
        const prevPy = (star.y - centerY) * prevK + centerY

        // Draw line from previous position for streak effect
        ctx.beginPath()
        ctx.moveTo(prevPx, prevPy)
        ctx.lineTo(px, py)
        ctx.strokeStyle = `rgba(134, 239, 172, ${opacity * 0.6})`
        ctx.lineWidth = size * 0.5
        ctx.stroke()

        // Draw star point
        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(134, 239, 172, ${opacity})`
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    // Handle window resize
    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div className="h-full flex items-center justify-center relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
      />
      <div className="relative z-10 text-center space-y-8 max-w-2xl px-8">
        <div className="space-y-6">
          <Bot className="h-24 w-24 mx-auto text-green-400 opacity-80" strokeWidth={1} />

          <div className="space-y-2">
            <h1 className="text-2xl font-medium tracking-tight text-muted-foreground">
              welcome to
            </h1>
            <h2 className="text-5xl font-bold tracking-tight text-green-400 font-mono">
              localbase
            </h2>
          </div>

          <p className="text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            your local-first analytics workspace
          </p>
        </div>

        {/* Workspace Section */}
        <div className="mt-8 space-y-6">
          {/* Single Workspace Mode */}
          {forceSingleWorkspace ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">current workspace</p>
              <Card className="max-w-md mx-auto border-border bg-muted/30">
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-foreground">{currentWorkspace || 'loading...'}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          ) : (
            /* Available Workspaces */
            scanning ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-green-400 mb-2"></div>
                <p className="text-xs text-muted-foreground">scanning...</p>
              </div>
            ) : availableProjects.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">select workspace</p>
                <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
                    {availableProjects.map((project) => (
                    <Card
                      key={project.path}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-all hover:scale-[1.02] border-border hover:border-green-400/50"
                      onClick={async () => {
                        // Auto-open workspace on click
                        if (!window.electronAPI?.config) return
                        try {
                          await window.electronAPI.config.setProjectRoot(project.path)
                          localStorage.setItem('localbase-workspace-selected', 'true')
                          // In browser mode (no terminal), go to visualizations instead of live
                          const isBrowserMode = !window.electronAPI?.terminal
                          localStorage.setItem('localbase-selected-view', isBrowserMode ? 'visualizations' : 'live')
                          onWorkspaceSelected()
                        } catch (err) {
                          console.error('Failed to save project root:', err)
                        }
                      }}
                    >
                      <CardHeader className="pb-2 px-3 pt-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{project.name}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2 px-3">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {project.path}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">No workspaces found</p>
              </div>
            )
          )}
        </div>

        {/* Create New Workspace - Bottom Right */}
        <div className="fixed bottom-8 right-8 z-20">
          {!showCreateForm ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateForm(true)}
              className="border-green-400/50 text-green-400 hover:bg-green-400/10 font-mono shadow-lg"
            >
              <Plus className="h-3 w-3 mr-2" />
              create new workspace
            </Button>
          ) : (
            <Card className="border-green-400/50 bg-card shadow-2xl w-80">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-green-400">
                  <FolderPlus className="h-4 w-4" />
                  New Workspace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Workspace name..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateWorkspace()
                    if (e.key === 'Escape') {
                      setShowCreateForm(false)
                      setNewWorkspaceName('')
                    }
                  }}
                  className="bg-background border-green-400/30 focus:border-green-400 font-mono text-sm"
                  autoFocus
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">
                  Will be created in ~/Work/{newWorkspaceName || '...'}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateWorkspace}
                    disabled={!newWorkspaceName.trim() || creating}
                    className="flex-1 bg-green-400 text-black hover:bg-green-500 font-mono disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewWorkspaceName('')
                    }}
                    disabled={creating}
                    className="border-border hover:bg-muted font-mono"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
