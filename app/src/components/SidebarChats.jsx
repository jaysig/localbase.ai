import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Check, X, Trash2 } from 'lucide-react'

/**
 * SidebarChats - List of saved conversations in the sidebar
 * Single click: load conversation
 * Double click: edit title
 */
export default function SidebarChats({ collapsed, onSelectChat }) {
  const [conversations, setConversations] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef(null)

  // Load conversations
  const loadConversations = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/conversations?limit=10')
      const data = await response.json()
      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }

  // Load on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Refresh when a conversation is saved
  useEffect(() => {
    const handler = () => loadConversations()
    window.addEventListener('conversations:refresh', handler)
    return () => window.removeEventListener('conversations:refresh', handler)
  }, [])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const startEditing = (conv) => {
    setEditingId(conv.id)
    setEditValue(conv.title)
  }

  const saveEdit = async (convId) => {
    // Guard against double-calls
    if (!editingId) return

    const newTitle = editValue.trim()
    if (!newTitle) {
      setEditingId(null)
      return
    }

    // Clear editing state first to prevent double-calls from onBlur
    setEditingId(null)

    try {
      const response = await fetch(`http://localhost:3000/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      })
      const data = await response.json()
      if (data.success) {
        await loadConversations()
      } else {
        console.error('Failed to update title:', data.error)
      }
    } catch (err) {
      console.error('Failed to update title:', err)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const deleteConversation = async (convId, e) => {
    e.stopPropagation()
    try {
      await fetch(`http://localhost:3000/api/conversations/${convId}`, { method: 'DELETE' })
      loadConversations()
      window.dispatchEvent(new CustomEvent('conversation:deleted', { detail: convId }))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleKeyDown = (e, convId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(convId)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // Don't render if sidebar is collapsed or no conversations
  if (collapsed || conversations.length === 0) return null

  return (
    <div className="pl-4 pr-2 py-1 space-y-0.5">
      {conversations.map(conv => (
        <div
          key={conv.id}
          className="group flex items-center gap-1 rounded hover:bg-muted/50 transition-colors"
        >
          {editingId === conv.id ? (
            // Edit mode
            <div className="flex-1 flex items-center gap-1 px-1 py-0.5">
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, conv.id)}
                onBlur={() => saveEdit(conv.id)}
                className="flex-1 bg-muted text-xs px-1.5 py-0.5 rounded border border-border focus:outline-none focus:border-green-400 min-w-0"
              />
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  saveEdit(conv.id)
                }}
                className="p-0.5 hover:bg-green-500/20 rounded"
              >
                <Check className="h-3 w-3 text-green-400" />
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  cancelEdit()
                }}
                className="p-0.5 hover:bg-red-500/20 rounded"
              >
                <X className="h-3 w-3 text-red-400" />
              </button>
            </div>
          ) : (
            // View mode - single click loads, double click edits
            <>
              <button
                onClick={() => {
                  onSelectChat(conv)
                  window.dispatchEvent(new CustomEvent('app:switchTab', { detail: 'chat' }))
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startEditing(conv)
                }}
                className="flex-1 flex items-center gap-1.5 px-2 py-1 text-left min-w-0"
              >
                <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs truncate">{conv.title}</span>
              </button>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-red-400" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
