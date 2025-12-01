import { useState, useEffect } from 'react'
import { Folder, File, ChevronRight, ChevronDown, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function FileBrowser({ onSelect }) {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [expandedDirs, setExpandedDirs] = useState(new Set())

  useEffect(() => {
    // Load home directory on mount
    if (window.electronAPI?.files) {
      window.electronAPI.files.getHome().then(home => {
        setCurrentPath(home)
        loadDirectory(home)
      })
    }
  }, [])

  const loadDirectory = async (path) => {
    if (window.electronAPI?.files) {
      const dirItems = await window.electronAPI.files.listDirectory(path)
      // Filter out hidden files (starting with .)
      const visibleItems = dirItems.filter(item => !item.name.startsWith('.'))
      setItems(visibleItems)
    }
  }

  const navigateUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    setCurrentPath(parent)
    loadDirectory(parent)
  }

  const navigateToHome = async () => {
    const home = await window.electronAPI.files.getHome()
    setCurrentPath(home)
    loadDirectory(home)
  }

  const handleItemClick = async (item) => {
    if (item.isDirectory) {
      const newPath = `${currentPath}/${item.name}`.replace('//', '/')
      setCurrentPath(newPath)
      loadDirectory(newPath)
    } else {
      // Toggle file selection
      const filePath = `${currentPath}/${item.name}`.replace('//', '/')
      setSelectedFiles(prev => {
        const exists = prev.find(f => f.path === filePath)
        if (exists) {
          return prev.filter(f => f.path !== filePath)
        } else {
          return [...prev, { path: filePath, name: item.name }]
        }
      })
    }
  }

  const isSelected = (itemName) => {
    const filePath = `${currentPath}/${itemName}`.replace('//', '/')
    return selectedFiles.some(f => f.path === filePath)
  }

  const handleConfirm = () => {
    onSelect && onSelect(selectedFiles)
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="border-b border-border p-3 flex items-center gap-2 bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={navigateUp}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={navigateToHome}
          className="h-8 w-8"
        >
          <Home className="h-4 w-4" />
        </Button>
        <div className="flex-1 font-mono text-sm text-green-400 truncate">
          {currentPath}
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-auto p-2">
        {items.map((item, i) => {
          const selected = !item.isDirectory && isSelected(item.name)
          return (
            <div
              key={i}
              onClick={() => handleItemClick(item)}
              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer font-mono text-sm transition-colors ${
                selected
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'hover:bg-accent text-foreground'
              }`}
            >
              {item.isDirectory ? (
                <Folder className="h-4 w-4 text-blue-400" />
              ) : (
                <File className={`h-4 w-4 ${selected ? 'text-green-400' : 'text-muted-foreground'}`} />
              )}
              <span className="flex-1 truncate">{item.name}</span>
              {item.isDirectory && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {selectedFiles.length > 0 && (
        <div className="border-t border-border p-3 bg-card">
          <div className="text-xs font-mono text-green-400 mb-2">
            SELECTED: {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
          </div>
          <Button
            onClick={handleConfirm}
            className="w-full bg-green-400/10 border border-green-400 text-green-400 hover:bg-green-400/20 font-mono"
          >
            CONFIRM SELECTION
          </Button>
        </div>
      )}
    </div>
  )
}
