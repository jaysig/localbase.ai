import { useState, useEffect, lazy, Suspense } from 'react'
import { Wrench, ArrowLeft, Package, Layout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Dynamic tool component loader
const toolComponents = {
  mediatrader: lazy(() => import('./tools/MediaTrader'))
}

export default function Tools() {
  const [activeTool, setActiveTool] = useState(null)
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const data = await window.electronAPI.api.getTools()
        setTools(data.tools || [])
      } catch (err) {
        console.error('Failed to fetch tools:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTools()
  }, [])

  // If a tool is active, show that tool
  if (activeTool) {
    const tool = tools.find(t => t.id === activeTool)
    const ToolComponent = toolComponents[tool.id]

    return (
      <div className="h-full flex flex-col">
        {/* Tool Header */}
        <div className="border-b border-border bg-card/50 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTool(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{tool.name}</h1>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Tool Content */}
        <div className="flex-1 overflow-auto">
          {ToolComponent ? (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Loading {tool.name}...</p>
              </div>
            }>
              <ToolComponent />
            </Suspense>
          ) : (
            <div className="p-8">
              <div className="max-w-6xl mx-auto">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Tool Configuration</h3>
                  <pre className="text-xs bg-background p-4 rounded border border-border overflow-auto">
                    {JSON.stringify(tool.config, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="h-full p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Tools</h1>
            <p className="text-muted-foreground">
              Specialized analysis and optimization tools
            </p>
          </div>
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">Loading tools...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show empty state when no tools installed
  if (tools.length === 0) {
    return (
      <div className="h-full p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Tools</h1>
            <p className="text-muted-foreground">
              Specialized analysis and optimization tools
            </p>
          </div>

          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <Wrench className="h-16 w-16 mx-auto mb-6 opacity-30 text-green-400" />
              <h2 className="text-2xl font-bold text-foreground mb-3">No Tools Installed</h2>
              <p className="text-muted-foreground mb-6">
                Tools are modular plugins that extend LocalBase with specialized functionality.
              </p>
              <div className="bg-card border border-border rounded-lg p-4 text-left">
                <p className="text-xs text-muted-foreground mb-2">To create a tool:</p>
                <code className="text-sm text-green-400 font-mono block">
                  mkdir tools/my-tool && echo '&#123;&#125;' &gt; tools/my-tool/config.json
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show tools grid
  return (
    <div className="h-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Tools</h1>
          <p className="text-muted-foreground">
            {tools.length} {tools.length === 1 ? 'tool' : 'tools'} available in this workspace
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const isEnabled = tool.config?.presentation === 'sidebar'

            return (
              <Card
                key={tool.id}
                className="cursor-pointer transition-all hover:border-green-400/50"
                onClick={() => setActiveTool(tool.id)}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-400/10 rounded-lg">
                      <Package className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{tool.name}</CardTitle>
                        {isEnabled && (
                          <Badge variant="secondary" className="text-xs">
                            <Layout className="h-3 w-3 mr-1" />
                            Sidebar
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        v{tool.version}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
