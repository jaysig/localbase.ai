import { useState, useEffect } from 'react'
import { FolderKanban, Presentation, BarChart3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Helper to build viz URLs
const buildVizUrl = (vizPath) => {
  const isBrowserMode = !window.electronAPI?.terminal
  const path = vizPath.replace(/^\//, '')
  const timestamp = Date.now()
  if (isBrowserMode) {
    return `http://localhost:3000/${path}?t=${timestamp}`
  }
  return `localbase://${path}?t=${timestamp}`
}

export default function ProjectsViewer() {
  const [projects, setProjects] = useState([])
  const [projectCounts, setProjectCounts] = useState({})
  const [selectedProject, setSelectedProject] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await window.electronAPI.api.getVisualizations()
        const vizzes = data.visualizations || []
        const projectsWithPres = data.projectsWithPresentation || []

        // Build project list with counts
        const counts = {}
        vizzes.forEach(v => {
          if (v.project) {
            counts[v.project] = (counts[v.project] || 0) + 1
          }
        })

        setProjectCounts(counts)
        setProjects(projectsWithPres)
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch projects:', err)
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  // Listen for viz:select from project iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'viz:select' && e.data?.vizId) {
        // Navigate to visualization viewer with this viz
        window.dispatchEvent(new CustomEvent('app:switchTab', { detail: 'visualizations' }))
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('viz:select', { detail: e.data.vizId }))
        }, 50)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Listen for projects:open events (from viz detail project link)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail && projects.includes(e.detail)) {
        setSelectedProject(e.detail)
      }
    }
    window.addEventListener('projects:open', handler)
    return () => window.removeEventListener('projects:open', handler)
  }, [projects])

  // Project presentation view
  if (selectedProject) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-green-400">{selectedProject}</h3>
            <p className="text-xs text-muted-foreground">
              {projectCounts[selectedProject]} visualizations
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
        </div>
        <div className="flex-1">
          <iframe
            src={buildVizUrl(`viz/projects/${selectedProject}/index.html`)}
            className="w-full h-full border-0"
            title={selectedProject}
          />
        </div>
      </div>
    )
  }

  // Projects list view
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-green-400">Projects</h2>
        <p className="text-muted-foreground text-sm">Visualization collections with presentation views</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">
          <p>Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No projects found</p>
          <p className="text-xs mt-2">
            Create a project by adding <code className="bg-card px-1 py-0.5 rounded">viz/projects/project-name/index.html</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Card
              key={project}
              className="group cursor-pointer transition-all hover:border-green-400/50 overflow-hidden"
              onClick={() => setSelectedProject(project)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-green-400/10 rounded-lg">
                    <FolderKanban className="h-6 w-6 text-green-400" />
                  </div>
                  <Presentation className="h-5 w-5 text-muted-foreground group-hover:text-green-400 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{project}</h3>
                <p className="text-sm text-muted-foreground">
                  {projectCounts[project] || 0} visualizations
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
