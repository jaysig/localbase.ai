import { useState, useEffect, useRef } from 'react'
import { Search, MessageSquare, Plus, Trash2, X } from 'lucide-react'

/**
 * ConversationSearch - Modal for searching and selecting saved conversations
 *
 * Opens via Cmd+K when chat input is focused and empty.
 * Shows recent conversations and allows search.
 */
export default function ConversationSearch({ isOpen, onClose, onSelect, onNew, onDelete }) {
  const [query, setQuery] = useState('')
  const [conversations, setConversations] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      inputRef.current?.focus()
      fetchConversations()
    }
  }, [isOpen])

  // Fetch conversations (search or recent)
  const fetchConversations = async (searchQuery = '') => {
    setLoading(true)
    try {
      const url = searchQuery
        ? `http://localhost:3000/api/conversations/search?q=${encodeURIComponent(searchQuery)}&limit=10`
        : 'http://localhost:3000/api/conversations?limit=10'

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
    setLoading(false)
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const totalItems = conversations.length + 1 // +1 for "New Chat" option

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex === 0) {
        onNew()
        onClose()
      } else {
        const conv = conversations[selectedIndex - 1]
        if (conv) {
          onSelect(conv)
          onClose()
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Backspace' && e.metaKey && selectedIndex > 0) {
      // Cmd+Backspace to delete
      e.preventDefault()
      const conv = conversations[selectedIndex - 1]
      if (conv) {
        handleDelete(conv.id)
      }
    }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:3000/api/conversations/${id}`, { method: 'DELETE' })
      fetchConversations(query)
      onDelete?.(id)
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* New Chat Option */}
          <button
            onClick={() => { onNew(); onClose(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              selectedIndex === 0
                ? 'bg-green-500/10 text-green-400'
                : 'text-foreground hover:bg-muted/50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              selectedIndex === 0 ? 'bg-green-500/20' : 'bg-muted'
            }`}>
              <Plus className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">New Chat</div>
              <div className="text-xs text-muted-foreground">Start a fresh conversation</div>
            </div>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">
              enter
            </kbd>
          </button>

          {/* Divider */}
          {conversations.length > 0 && (
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
              {query ? 'Search Results' : 'Recent'}
            </div>
          )}

          {/* Conversations */}
          {conversations.map((conv, idx) => (
            <button
              key={conv.id}
              onClick={() => { onSelect(conv); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group ${
                selectedIndex === idx + 1
                  ? 'bg-green-500/10 text-green-400'
                  : 'text-foreground hover:bg-muted/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                selectedIndex === idx + 1 ? 'bg-green-500/20' : 'bg-muted'
              }`}>
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{conv.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {conv.preview}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatDate(conv.updated_at)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </button>
          ))}

          {/* Empty State */}
          {!loading && conversations.length === 0 && query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No conversations found for "{query}"
            </div>
          )}

          {!loading && conversations.length === 0 && !query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No saved conversations yet
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-border bg-muted">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-border bg-muted">enter</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-border bg-muted">⌘⌫</kbd> delete
          </span>
        </div>
      </div>
    </div>
  )
}
