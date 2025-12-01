import { Database, FolderOpen, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WorkspaceView({ workspace }) {
  const { workspaceName, dataSourceType, files = [], connectors = [] } = workspace

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-mono text-green-400">
          {workspaceName}
        </h1>
        <p className="text-muted-foreground">
          Workspace dashboard - manage your data sources and visualizations
        </p>
      </div>

      {/* Data Sources */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <Button
            variant="outline"
            size="sm"
            className="border-green-400/50 text-green-400 hover:bg-green-400/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Files */}
          {dataSourceType === 'files' && files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-green-400" />
                  Local Files
                </CardTitle>
                <CardDescription>{files.length} file(s) imported</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="text-sm font-mono truncate text-muted-foreground">
                      {file.name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Connectors */}
          {dataSourceType === 'connectors' && connectors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-green-400" />
                  Connectors
                </CardTitle>
                <CardDescription>{connectors.length} connector(s) installed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {connectors.map((connector, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-mono capitalize">{connector}</span>
                      <Button variant="ghost" size="sm">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {(!dataSourceType || (files.length === 0 && connectors.length === 0)) && (
            <Card className="md:col-span-2">
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="text-muted-foreground">
                    No data sources configured yet
                  </div>
                  <Button
                    variant="outline"
                    className="border-green-400/50 text-green-400 hover:bg-green-400/10"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Data Source
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:border-green-400/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Create Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Build charts and dashboards from your data
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-green-400/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Run Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Query and explore your datasets
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-green-400/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Export Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Export to CSV, JSON, or other formats
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
