import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, RefreshCw, X, Search, Plus, ChevronDown, Save, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConversationSearch from './ConversationSearch'

const CHAT_STORAGE_KEY = 'chatWorkspace_messages'
const MODEL_STORAGE_KEY = 'chatWorkspace_model'
const CONVERSATION_STORAGE_KEY = 'chatWorkspace_conversationId'

/**
 * ChatWorkspace - Chat + Live Visualization Preview (Browser Mode)
 *
 * Split view with chat on left, viz preview on right.
 * When Claude creates a visualization, it auto-loads in the preview.
 */
export default function ChatWorkspace() {
  // Chat state - load from localStorage on init
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Viz preview state
  const [currentViz, setCurrentViz] = useState(null)
  const [iframeKey, setIframeKey] = useState(0)

  // Split layout state
  const [splitPosition, setSplitPosition] = useState(35)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  // Search state for when no viz is loaded
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allVisualizations, setAllVisualizations] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef(null)

  // Model configuration state
  const [chatConfig, setChatConfig] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY)
      return saved ? JSON.parse(saved).provider : 'openai'
    } catch { return 'openai' }
  })
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY)
      return saved ? JSON.parse(saved).model : 'gpt-4o'
    } catch { return 'gpt-4o' }
  })
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Conversation search state
  const [showConversationSearch, setShowConversationSearch] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState(() => {
    try {
      return localStorage.getItem(CONVERSATION_STORAGE_KEY) || null
    } catch { return null }
  })

  // Save confirmation state
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'saved' | 'error'

  // Load chat config from API
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/chat/config')
        const data = await response.json()
        if (data.success) {
          setChatConfig(data)
        }
      } catch (err) {
        console.error('Failed to fetch chat config:', err)
      }
    }
    fetchConfig()
  }, [])

  // Save model selection to localStorage
  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify({ provider: selectedProvider, model: selectedModel }))
  }, [selectedProvider, selectedModel])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-scroll chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  // Clear chat / new conversation
  const handleNewChat = () => {
    setMessages([])
    setCurrentConversationId(null)
    localStorage.removeItem(CHAT_STORAGE_KEY)
    localStorage.removeItem(CONVERSATION_STORAGE_KEY)
  }

  // Load a conversation from the database
  const loadConversation = async (conv) => {
    try {
      const response = await fetch(`http://localhost:3000/api/conversations/${conv.id}`)
      const data = await response.json()
      if (data.success && data.conversation) {
        const msgs = data.conversation.messages.map(m => ({
          role: m.role,
          content: m.content
        }))
        setMessages(msgs)
        setCurrentConversationId(conv.id)
        localStorage.setItem(CONVERSATION_STORAGE_KEY, conv.id)
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs))
      }
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }

  // Save current conversation to database (for unsaved chats)
  const saveConversation = async () => {
    if (messages.length === 0) return

    // Already saved
    if (currentConversationId) {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
      return
    }

    setSaveStatus('saving')
    try {
      // Create conversation with first message
      const firstUserMsg = messages.find(m => m.role === 'user')
      if (!firstUserMsg) {
        setSaveStatus('error')
        return
      }

      const createRes = await fetch('http://localhost:3000/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: firstUserMsg,
          model: selectedModel,
          provider: selectedProvider
        })
      })
      const createData = await createRes.json()

      if (createData.success) {
        const convId = createData.conversation.id
        setCurrentConversationId(convId)

        // Add remaining messages
        for (const msg of messages.slice(1)) {
          await fetch(`http://localhost:3000/api/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: msg,
              model: selectedModel,
              provider: selectedProvider
            })
          })
        }

        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
        // Notify sidebar to refresh
        window.dispatchEvent(new CustomEvent('conversations:refresh'))
      } else {
        setSaveStatus('error')
      }
    } catch (err) {
      console.error('Failed to save conversation:', err)
      setSaveStatus('error')
    }
  }

  // Save conversation ID to localStorage
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(CONVERSATION_STORAGE_KEY, currentConversationId)
    }
  }, [currentConversationId])

  // Listen for sidebar chat selection
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        loadConversation(e.detail)
      }
    }
    window.addEventListener('chat:loadConversation', handler)
    return () => window.removeEventListener('chat:loadConversation', handler)
  }, [])

  // Listen for conversation deletion from sidebar
  useEffect(() => {
    const handler = (e) => {
      if (e.detail === currentConversationId) {
        handleNewChat()
      }
    }
    window.addEventListener('conversation:deleted', handler)
    return () => window.removeEventListener('conversation:deleted', handler)
  }, [currentConversationId])

  // Focus chat input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cmd+K - context-aware: focus input OR open conversation search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()

        // If input is focused AND empty, open conversation search
        if (document.activeElement === inputRef.current && !input.trim()) {
          setShowConversationSearch(true)
        } else {
          // Otherwise, focus the input
          inputRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input])

  // Load visualizations for search
  useEffect(() => {
    const fetchVisualizations = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/viz')
        const data = await response.json()
        setAllVisualizations(data.visualizations || [])
        setSearchResults((data.visualizations || []).slice(0, 3))
      } catch (err) {
        console.error('Failed to fetch visualizations:', err)
      }
    }
    fetchVisualizations()
  }, [])

  // Filter search results
  useEffect(() => {
    let results
    if (!searchQuery.trim()) {
      results = [...allVisualizations]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 3)
    } else {
      const query = searchQuery.toLowerCase()
      results = allVisualizations.filter(viz => {
        const title = (viz.title || '').toLowerCase()
        const filename = (viz.filename || '').toLowerCase()
        return title.includes(query) || filename.includes(query)
      })
    }
    setSearchResults(results)
    setSelectedIndex(0)
  }, [searchQuery, allVisualizations])

  // Load last session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chatWorkspace_viz')
    if (saved) {
      try {
        setCurrentViz(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved viz:', e)
      }
    }
  }, [])

  // Save viz to localStorage
  useEffect(() => {
    if (currentViz) {
      localStorage.setItem('chatWorkspace_viz', JSON.stringify(currentViz))
    }
  }, [currentViz])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    // Handle /commands
    const trimmedInput = input.trim().toLowerCase()
    if (trimmedInput === '/clear') {
      setInput('')
      handleNewChat()
      return
    }

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // Save user message to database
    let convId = currentConversationId
    try {
      if (!convId) {
        // Create new conversation
        const createRes = await fetch('http://localhost:3000/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            model: selectedModel,
            provider: selectedProvider
          })
        })
        const createData = await createRes.json()
        if (createData.success) {
          convId = createData.conversation.id
          setCurrentConversationId(convId)
          // Notify sidebar to refresh
          window.dispatchEvent(new CustomEvent('conversations:refresh'))
        }
      } else {
        // Add to existing conversation
        await fetch(`http://localhost:3000/api/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            model: selectedModel,
            provider: selectedProvider
          })
        })
      }
    } catch (err) {
      console.error('Failed to save user message:', err)
    }

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          provider: selectedProvider,
          model: selectedModel,
          currentViz: currentViz ? {
            filename: currentViz.filename,
            title: currentViz.title,
            id: currentViz.id
          } : null
        })
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage = { role: 'assistant', content: data.response }
        setMessages(prev => [...prev, assistantMessage])

        // Save assistant message to database
        if (convId) {
          try {
            await fetch(`http://localhost:3000/api/conversations/${convId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: assistantMessage,
                model: selectedModel,
                provider: selectedProvider
              })
            })
          } catch (err) {
            console.error('Failed to save assistant message:', err)
          }
        }

        // Check if a visualization was created (look for toolsUsed containing create_visualization)
        if (data.toolsUsed?.includes('create_visualization')) {
          // Refresh viz list and load the newest one
          setTimeout(async () => {
            try {
              const vizResponse = await fetch('http://localhost:3000/api/viz')
              const vizData = await vizResponse.json()
              const vizList = vizData.visualizations || []
              setAllVisualizations(vizList)

              if (vizList.length > 0) {
                // Sort by createdAt and get the newest
                const sorted = [...vizList].sort((a, b) =>
                  new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)
                )
                const newest = sorted[0]
                console.log('🎨 ChatWorkspace: Auto-loading new viz:', newest.title)
                setCurrentViz({
                  id: newest.id,
                  title: newest.title,
                  filename: newest.filename,
                  url: `http://localhost:3000/viz/${newest.filename}?t=${Date.now()}`
                })
                setIframeKey(prev => prev + 1)
              }
            } catch (err) {
              console.error('Failed to refresh viz list:', err)
            }
          }, 500) // Small delay to ensure file is written
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }])
    }

    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()

      // Handle /save command
      if (input.trim().toLowerCase() === '/save') {
        setInput('')
        if (currentConversationId) {
          // Already saved, show inline message
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'This conversation is already saved.'
          }])
        } else if (messages.length === 0) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Nothing to save yet. Start a conversation first.'
          }])
        } else {
          setShowSaveConfirm(true)
        }
        return
      }

      sendMessage()
    }
  }

  // Handle save confirmation
  const handleSaveConfirm = async (confirmed) => {
    setShowSaveConfirm(false)
    if (confirmed) {
      await saveConversation()
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Conversation saved!'
      }])
    }
  }

  const handleRefresh = () => {
    if (currentViz) {
      setCurrentViz({
        ...currentViz,
        url: currentViz.url.replace(/t=\d+/, `t=${Date.now()}`)
      })
      setIframeKey(prev => prev + 1)
    }
  }

  const handleClearViz = () => {
    setCurrentViz(null)
    localStorage.removeItem('chatWorkspace_viz')
  }

  // Dragging handlers
  const handleMouseDown = () => setIsDragging(true)
  const handleMouseUp = () => setIsDragging(false)

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    let newPosition = (x / rect.width) * 100
    newPosition = Math.max(25, Math.min(50, newPosition))
    setSplitPosition(newPosition)
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
  }, [isDragging])

  const loadViz = (viz) => {
    setCurrentViz({
      id: viz.id,
      title: viz.title,
      filename: viz.filename,
      url: `http://localhost:3000/viz/${viz.filename}?t=${Date.now()}`
    })
    setSearchQuery('')
    setIframeKey(prev => prev + 1)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Split View */}
      <div ref={containerRef} className="flex-1 flex relative overflow-hidden">
        {/* Chat Pane */}
        <div
          className="flex flex-col bg-background border-r border-border min-w-0 overflow-hidden"
          style={{ width: `${splitPosition}%` }}
        >
          {/* Chat Header */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-green-400">Chat</h3>
            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center gap-1 h-6 px-2 text-xs text-muted-foreground hover:text-foreground bg-muted rounded transition-colors"
                >
                  <span className="truncate max-w-[100px]">{selectedModel}</span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                </button>
                {showModelDropdown && chatConfig && (
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                    {chatConfig.availableProviders.map(provider => (
                      <div key={provider.id}>
                        <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {provider.name}
                        </div>
                        {provider.models.map(model => (
                          <button
                            key={model}
                            onClick={() => {
                              setSelectedProvider(provider.id)
                              setSelectedModel(model)
                              setShowModelDropdown(false)
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors ${
                              selectedModel === model && selectedProvider === provider.id
                                ? 'text-green-400 bg-muted/50'
                                : 'text-foreground'
                            }`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Save Button */}
              {messages.length > 0 && !currentConversationId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveConversation}
                  disabled={saveStatus === 'saving'}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Save Conversation"
                >
                  {saveStatus === 'saving' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : saveStatus === 'saved' ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              )}
              {/* Saved indicator */}
              {currentConversationId && messages.length > 0 && (
                <span className="text-xs text-green-400/70 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewChat}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="New Chat"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 min-w-0">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center px-4">
                  <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">LocalBase Assistant</p>
                  <p className="text-xs mt-1">Ask me to create visualizations from your data.</p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              msg.role === 'system' ? (
                // System message (inline notifications)
                <div key={i} className="flex justify-center">
                  <div className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    <div className="whitespace-pre-wrap text-xs" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{msg.content}</div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              )
            ))}

            {/* Save Confirmation Inline */}
            {showSaveConfirm && (
              <div className="flex justify-center">
                <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm shadow-lg">
                  <p className="text-foreground mb-2">Save this conversation?</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => handleSaveConfirm(true)}
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                    >
                      Yes, save
                    </button>
                    <button
                      onClick={() => handleSaveConfirm(false)}
                      className="px-3 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything... (Shift+Enter for new line)"
                className="flex-1 bg-muted rounded-lg px-3 py-[9px] text-xs leading-[18px] focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[36px] max-h-[120px]"
                disabled={loading}
                rows={1}
                style={{ height: Math.min(120, Math.max(36, input.split('\n').length * 20)) + 'px' }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-3 h-[36px] bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-px cursor-col-resize hover:w-0.5 bg-border/50 hover:bg-green-400/50 transition-all ${isDragging ? 'bg-green-400' : ''}`}
          style={{ flexShrink: 0 }}
        />

        {/* Preview Pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview Header */}
          {currentViz && (
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Store viz for VisualizationViewer to pick up
                    localStorage.setItem('vizViewer_openOnMount', JSON.stringify({
                      id: currentViz.id,
                      title: currentViz.title,
                      filename: currentViz.filename,
                      url: `/viz/${currentViz.filename}`
                    }))
                    // Switch to visualizations tab
                    window.dispatchEvent(new CustomEvent('app:switchTab', { detail: 'visualizations' }))
                    // Also dispatch viz:select in case VisualizationViewer is already mounted
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('viz:select', { detail: currentViz.id }))
                    }, 50)
                  }}
                  className="text-sm font-medium text-foreground hover:text-green-400 transition-colors cursor-pointer"
                  title="View in Visualizations"
                >
                  {currentViz.title}
                </button>
                <span className="text-xs text-muted-foreground">• {currentViz.filename}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearViz}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}

          {/* Preview Content */}
          {currentViz ? (
            <div className="flex-1 overflow-auto bg-background">
              <iframe
                key={iframeKey}
                src={currentViz.url}
                className="w-full h-full border-0"
                title="Visualization Preview"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
              <div className="w-full max-w-lg">
                {/* Search Box */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1))
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSelectedIndex(prev => Math.max(prev - 1, 0))
                      } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
                        e.preventDefault()
                        loadViz(searchResults[selectedIndex])
                      }
                    }}
                    placeholder="Search visualizations..."
                    className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-green-400"
                  />
                </div>

                {/* Results */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  {searchResults.length > 0 ? (
                    searchResults.map((viz, idx) => (
                      <button
                        key={viz.id}
                        onClick={() => loadViz(viz)}
                        className={`w-full px-4 py-3 text-left hover:bg-background/50 transition-colors border-b border-border last:border-b-0 ${
                          idx === selectedIndex ? 'bg-background/50 ring-1 ring-inset ring-green-400/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{viz.title}</div>
                            <div className="text-xs text-muted-foreground font-mono">{viz.filename}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                      {searchQuery ? `No results for "${searchQuery}"` : 'No visualizations yet'}
                    </div>
                  )}
                </div>

                <p className="text-center mt-4 text-xs text-muted-foreground">
                  Ask LocalBase to create a visualization, or select one above
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Search Modal */}
      <ConversationSearch
        isOpen={showConversationSearch}
        onClose={() => setShowConversationSearch(false)}
        onSelect={loadConversation}
        onNew={handleNewChat}
        onDelete={(id) => {
          if (currentConversationId === id) {
            handleNewChat()
          }
        }}
      />
    </div>
  )
}
