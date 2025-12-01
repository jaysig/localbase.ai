import { useState, useEffect, useMemo, useCallback } from 'react'
import { LayoutGrid, LayoutList, Search, Plus, Mail, Phone, MapPin, X, Trash2, Calendar, DollarSign, Tag, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// LocalBase status pipeline (9 stages)
const STATUSES = [
  'New',
  'Contacted',
  'Appointment Set',
  'Proposal Sent',
  'Proposal Signed',
  'Job Scheduled',
  'Job Complete',
  'Invoice Sent',
  'Payment Complete'
]

// Status colors for badges
const STATUS_COLORS = {
  'New': 'bg-blue-500',
  'Contacted': 'bg-purple-500',
  'Appointment Set': 'bg-indigo-500',
  'Proposal Sent': 'bg-yellow-500',
  'Proposal Signed': 'bg-orange-500',
  'Job Scheduled': 'bg-cyan-500',
  'Job Complete': 'bg-green-500',
  'Invoice Sent': 'bg-teal-500',
  'Payment Complete': 'bg-emerald-600'
}

// Format phone number to (XXX) XXX-XXXX
const formatPhone = (phone) => {
  if (!phone) return ''
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    // Handle +1 prefix
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  // Return as-is if not a standard format
  return phone
}

export default function Pipeline() {
  const [view, setView] = useState('kanban') // 'kanban' or 'list'
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)
  const [lastAction, setLastAction] = useState(null) // For undo functionality
  const [successColumn, setSuccessColumn] = useState(null) // For success animation
  const [collapseEmpty, setCollapseEmpty] = useState(false) // Hide empty columns

  // Vim-style keyboard navigation state
  const [selectedCardId, setSelectedCardId] = useState(null) // Currently focused card
  const [selectedColumn, setSelectedColumn] = useState(0) // Currently focused column index
  const [lastKeyPress, setLastKeyPress] = useState({ key: null, time: 0 }) // For double-tap detection
  const [sortColumn, setSortColumn] = useState('date_created')
  const [sortDirection, setSortDirection] = useState('desc')

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // Load leads from database
  useEffect(() => {
    loadLeads()
  }, [])

  // Command+Z undo and Command+D delete handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Command+Shift+C: Toggle collapse empty columns (works anywhere)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault()
        setCollapseEmpty(prev => !prev)
        console.log('🗜️ Toggled collapse empty columns:', !collapseEmpty)
        return
      }

      // Escape key - Handle BEFORE input field check (Priority 0)
      if (e.key === 'Escape') {
        // Priority 1: Close delete dialog if open
        if (showDeleteDialog) {
          e.preventDefault()
          e.stopPropagation() // Don't let App.jsx navigate away
          setShowDeleteDialog(false)
          setDeleteTarget(null)
          return
        }

        // Priority 2: Close detail panel if open
        if (showDetail) {
          e.preventDefault()
          e.stopPropagation() // Don't let App.jsx navigate away
          setShowDetail(false)
          setSelectedLead(null)
          return
        }

        // Priority 3: If search input is focused, blur it and clear search
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
          e.preventDefault()
          e.stopPropagation()
          setSearchTerm('')
          e.target.blur()
          return
        }

        // Priority 4: Clear vim selection
        if (selectedCardId) {
          e.preventDefault()
          e.stopPropagation()
          setSelectedCardId(null)
          return
        }

        // Priority 5: Let vim hints handle it, or stay in CRM
        // Don't navigate away from CRM view
        e.stopPropagation()
        return
      }

      // Don't interfere when typing in input fields (but Escape is handled above)
      if (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable) {
        return
      }

      // Enter key - Confirm delete dialog
      if (e.key === 'Enter' && showDeleteDialog) {
        e.preventDefault()
        handleDelete()
        return
      }

      // Command+R - Reload data
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        loadLeads()
        return
      }

      // Command+L - Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        document.querySelector('input[type="text"]')?.focus()
        return
      }

      // Command+Z or Ctrl+Z - Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (lastAction) {
          e.preventDefault()
          handleUndo()
        }
      }

      // Command+D or Command+Delete - Delete selected lead or card
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'Delete' || e.key === 'Backback')) {
        e.preventDefault()
        const target = selectedLead || (selectedCardId ? leads.find(l => l.id === selectedCardId) : null)
        if (target) {
          confirmDelete(target)
        }
        return
      }

      // VIM NAVIGATION - Only when NOT in modal/dialog
      if (!showDetail && !showDeleteDialog && !window.vimHintsActive) {

        // j - Move down to next card
        if (e.key === 'j') {
          e.preventDefault()
          navigateDown()
          return
        }

        // k - Move up to previous card
        if (e.key === 'k') {
          e.preventDefault()
          navigateUp()
          return
        }

        // h - Move to previous column (hh = jump to first column)
        if (e.key === 'h') {
          e.preventDefault()
          const now = Date.now()
          if (lastKeyPress.key === 'h' && now - lastKeyPress.time < 500) {
            // Double tap - jump to first column
            jumpToFirstColumn()
            setLastKeyPress({ key: null, time: 0 })
          } else {
            navigateLeft()
            setLastKeyPress({ key: 'h', time: now })
          }
          return
        }

        // l - Move to next column (ll = jump to last column)
        if (e.key === 'l') {
          e.preventDefault()
          const now = Date.now()
          if (lastKeyPress.key === 'l' && now - lastKeyPress.time < 500) {
            // Double tap - jump to last column
            jumpToLastColumn()
            setLastKeyPress({ key: null, time: 0 })
          } else {
            navigateRight()
            setLastKeyPress({ key: 'l', time: now })
          }
          return
        }

        // Enter - Open detail for selected card
        if (e.key === 'Enter' && selectedCardId) {
          e.preventDefault()
          const card = leads.find(l => l.id === selectedCardId)
          if (card) openDetail(card)
          return
        }

        // e - Edit selected card (same as Enter)
        if (e.key === 'e' && selectedCardId) {
          e.preventDefault()
          const card = leads.find(l => l.id === selectedCardId)
          if (card) openDetail(card)
          return
        }

        // d - Delete selected card (skip dialog if Shift held)
        if (e.key === 'd' && selectedCardId) {
          e.preventDefault()
          const card = leads.find(l => l.id === selectedCardId)
          if (card) {
            if (e.shiftKey) {
              // Shift+D = instant delete, no dialog
              handleDeleteCard(card)
            } else {
              confirmDelete(card)
            }
          }
          return
        }

        // 1/2/3/4 - Quick status change
        if (['1', '2', '3', '4'].includes(e.key) && selectedCardId) {
          e.preventDefault()
          const statusIndex = parseInt(e.key) - 1
          const newStatus = STATUSES[statusIndex]
          moveCardToStatus(selectedCardId, newStatus)
          return
        }

        // v - Toggle view
        if (e.key === 'v') {
          e.preventDefault()
          setView(prev => prev === 'kanban' ? 'list' : 'kanban')
          return
        }

        // g - Double tap to jump to first lead (gg)
        if (e.key === 'g' && !e.shiftKey) {
          e.preventDefault()
          const now = Date.now()
          if (lastKeyPress.key === 'g' && now - lastKeyPress.time < 500) {
            // Double tap - jump to first lead
            jumpToFirst()
            setLastKeyPress({ key: null, time: 0 })
          } else {
            setLastKeyPress({ key: 'g', time: now })
          }
          return
        }

        // G - Jump to last lead (Shift+G)
        if (e.key === 'G') {
          e.preventDefault()
          jumpToLast()
          return
        }

        // / - Focus search
        if (e.key === '/') {
          e.preventDefault()
          document.querySelector('input[type="text"]')?.focus()
          return
        }

        // Command+L - Focus search
        if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
          e.preventDefault()
          document.querySelector('input[type="text"]')?.focus()
          return
        }

        // Number keys 1-7 for sorting (list view only)
        if (view === 'list' && e.key >= '1' && e.key <= '7') {
          e.preventDefault()
          const columnMap = {
            '1': 'name',
            '2': 'primary_address',
            '3': 'phone',
            '4': 'email',
            '5': 'lead_channel',
            '6': 'computed_status',
            '7': 'date_created'
          }
          handleSort(columnMap[e.key])
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lastAction, selectedLead, showDeleteDialog, showDetail, selectedCardId, selectedColumn, leads, lastKeyPress])

  const loadLeads = async () => {
    try {
      setLoading(true)

      if (!window.electronAPI?.db) {
        console.error('Database API not available')
        setLoading(false)
        return
      }

      const query = `
        SELECT
          cr.id,
          cr.status as source_status,
          cr.localbase_status,
          cr.amount,
          cr.lead_channel,
          cr.date_created,
          cr.metadata,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.primary_address,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM customer_relationships
              WHERE customer_id = c.id AND relationship_type = 'payment'
            ) THEN 'Payment Complete'
            WHEN EXISTS (
              SELECT 1 FROM customer_relationships
              WHERE customer_id = c.id AND relationship_type = 'invoice'
            ) THEN 'Invoice Sent'
            ELSE cr.localbase_status
          END as computed_status
        FROM customer_relationships cr
        JOIN customers c ON cr.customer_id = c.id
        WHERE cr.relationship_type = 'lead'
        ORDER BY cr.date_created DESC
      `

      const result = await window.electronAPI.db.query(query, [])
      setLeads(result || [])

      // Auto-select first card on initial load (if no card selected yet)
      if (!selectedCardId && result && result.length > 0) {
        const firstStatus = STATUSES[0]
        const firstColumnCards = result.filter(l => l.computed_status === firstStatus)
        if (firstColumnCards.length > 0) {
          setSelectedCardId(firstColumnCards[0].id)
          setSelectedColumn(0)
        }
      }
    } catch (error) {
      console.error('Failed to load leads:', error)
    } finally {
      setLoading(false)
    }
  }

  // Saved search aliases (stored in localStorage)
  const getSearchAliases = () => {
    const defaults = {
      '!incomplete': 'no email',
      '!nap': 'NAP leads',
      '!direct': 'direct channels',
      '!missing': 'no phone',
      '!new': 'new leads',
      '!paid': 'payment complete',
      '!bud': 'bud-inbound'
    }

    try {
      const saved = localStorage.getItem('crm-search-aliases')
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
    } catch {
      return defaults
    }
  }

  // Natural language filter parser
  const parseFilters = (text) => {
    // Check for special commands
    if (text.toLowerCase().includes('!collapse')) {
      setCollapseEmpty(true)
      // Remove !collapse from search text for other filtering
      text = text.replace(/!collapse/gi, '').trim()
    } else {
      setCollapseEmpty(false)
    }

    // Check for alias expansion
    const aliases = getSearchAliases()
    let expandedText = text

    // Replace aliases (support multiple in one query)
    Object.keys(aliases).forEach(alias => {
      if (expandedText.toLowerCase().includes(alias)) {
        expandedText = expandedText.replace(new RegExp(alias, 'gi'), aliases[alias])
      }
    })

    const lower = expandedText.toLowerCase()
    const filters = {
      textSearch: null,
      hasEmail: null,
      hasPhone: null,
      hasAddress: null,
      channels: [],
      statuses: []
    }

    // Field presence filters
    if (lower.match(/has email|with email|have email/)) filters.hasEmail = true
    if (lower.match(/no email|without email|missing email/)) filters.hasEmail = false
    if (lower.match(/has phone|with phone|have phone/)) filters.hasPhone = true
    if (lower.match(/no phone|without phone|missing phone/)) filters.hasPhone = false
    if (lower.match(/has address|with address|have address/)) filters.hasAddress = true
    if (lower.match(/no address|without address|missing address/)) filters.hasAddress = false

    // Channel filters
    if (lower.match(/\bnap\b/i)) filters.channels.push('NAP')
    if (lower.match(/\bmicro\b/i)) filters.channels.push('micro')
    if (lower.match(/\bgrml\b/i)) filters.channels.push('GRML')
    if (lower.match(/bud-inbound|bud inbound/i)) filters.channels.push('bud-inbound')
    if (lower.match(/\bsg\b/i)) filters.channels.push('SG')
    if (lower.match(/direct channel|direct only/i)) {
      filters.channels.push('micro', 'GRML', 'bud-inbound', 'SG', 'DDSM')
    }
    if (lower.match(/third party|3rd party/i)) {
      filters.channels.push('NAP', 'NAP-L', 'NAP-S')
    }

    // Status filters
    if (lower.match(/new leads|status new/i)) filters.statuses.push('New')
    if (lower.match(/contacted/i)) filters.statuses.push('Contacted')
    if (lower.match(/appointment set|appt set/i)) filters.statuses.push('Appointment Set')
    if (lower.match(/proposal sent/i)) filters.statuses.push('Proposal Sent')
    if (lower.match(/proposal signed/i)) filters.statuses.push('Proposal Signed')
    if (lower.match(/invoice sent/i)) filters.statuses.push('Invoice Sent')
    if (lower.match(/payment complete|paid/i)) filters.statuses.push('Payment Complete')

    // If no special filters detected, treat as text search
    if (!filters.hasEmail && !filters.hasPhone && !filters.hasAddress &&
        filters.channels.length === 0 && filters.statuses.length === 0) {
      filters.textSearch = lower
    }

    return filters
  }

  // Sort helper function
  const handleSort = useCallback((column) => {
    setSortColumn(prevColumn => {
      if (prevColumn === column) {
        // Toggle direction if same column
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        return column
      } else {
        // New column, default to ascending
        setSortDirection('asc')
        return column
      }
    })
  }, [])

  // Filter and sort leads - memoized for performance
  const filteredLeads = useMemo(() => {
    let result = leads

    // Apply search filters
    if (searchTerm) {
      const filters = parseFilters(searchTerm)

      result = result.filter(lead => {
        // Text search (fallback)
        if (filters.textSearch) {
          const match = (
            (lead.first_name && lead.first_name.toLowerCase().includes(filters.textSearch)) ||
            (lead.last_name && lead.last_name.toLowerCase().includes(filters.textSearch)) ||
            (lead.email && lead.email.toLowerCase().includes(filters.textSearch)) ||
            (lead.phone && lead.phone.includes(filters.textSearch)) ||
            (lead.primary_address && lead.primary_address.toLowerCase().includes(filters.textSearch))
          )
          if (!match) return false
        }

        // Field presence filters
        if (filters.hasEmail !== null) {
          const hasEmail = !!(lead.email && lead.email.trim())
          if (filters.hasEmail !== hasEmail) return false
        }
        if (filters.hasPhone !== null) {
          const hasPhone = !!(lead.phone && lead.phone.trim())
          if (filters.hasPhone !== hasPhone) return false
        }
        if (filters.hasAddress !== null) {
          const hasAddress = !!(lead.primary_address && lead.primary_address.trim())
          if (filters.hasAddress !== hasAddress) return false
        }

        // Channel filters
        if (filters.channels.length > 0) {
          const channelMatch = filters.channels.some(ch =>
            lead.lead_channel && lead.lead_channel.toLowerCase().includes(ch.toLowerCase())
          )
          if (!channelMatch) return false
        }

        // Status filters
        if (filters.statuses.length > 0) {
          if (!filters.statuses.includes(lead.computed_status)) return false
        }

        return true
      })
    }

    // Apply sorting (only in list view)
    if (view === 'list') {
      result = [...result].sort((a, b) => {
        let aVal, bVal

        switch (sortColumn) {
          case 'name':
            aVal = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
            bVal = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase()
            break
          case 'primary_address':
            aVal = (a.primary_address || '').toLowerCase()
            bVal = (b.primary_address || '').toLowerCase()
            break
          case 'phone':
            aVal = a.phone || ''
            bVal = b.phone || ''
            break
          case 'email':
            aVal = (a.email || '').toLowerCase()
            bVal = (b.email || '').toLowerCase()
            break
          case 'lead_channel':
            aVal = (a.lead_channel || '').toLowerCase()
            bVal = (b.lead_channel || '').toLowerCase()
            break
          case 'computed_status':
            aVal = (a.computed_status || '').toLowerCase()
            bVal = (b.computed_status || '').toLowerCase()
            break
          case 'date_created':
            aVal = a.date_created || ''
            bVal = b.date_created || ''
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [leads, searchTerm, view, sortColumn, sortDirection])

  // Group leads by status for kanban view - memoized for performance
  const leadsByStatus = useMemo(() => {
    return STATUSES.reduce((acc, status) => {
      acc[status] = filteredLeads.filter(lead => lead.computed_status === status)
      return acc
    }, {})
  }, [filteredLeads])

  // Show delete confirmation
  const confirmDelete = (lead) => {
    setDeleteTarget(lead)
    setShowDeleteDialog(true)
  }

  // Instant delete without dialog (for Shift+D)
  const handleDeleteCard = async (lead) => {
    try {
      const query = `DELETE FROM customer_relationships WHERE id = '${lead.id}'`
      await window.electronAPI.db.query(query, [])

      // Clear selection and reload
      setSelectedCardId(null)
      await loadLeads()
    } catch (error) {
      console.error('Failed to delete lead:', error)
      alert('Failed to delete record')
    }
  }

  // Handle delete with dialog
  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      // Delete from database
      const query = `DELETE FROM customer_relationships WHERE id = '${deleteTarget.id}'`
      await window.electronAPI.db.query(query, [])

      // Reload leads
      await loadLeads()
      setShowDetail(false)
      setSelectedLead(null)
      setShowDeleteDialog(false)
      setDeleteTarget(null)
      setSelectedCardId(null)
    } catch (error) {
      console.error('Failed to delete lead:', error)
      alert('Failed to delete record')
    }
  }

  // Get visible statuses (respects collapse filter)
  const visibleStatuses = useMemo(() => {
    return STATUSES.filter(status => !collapseEmpty || (leadsByStatus[status]?.length > 0))
  }, [collapseEmpty, leadsByStatus])

  // VIM NAVIGATION FUNCTIONS - optimized with useCallback
  const navigateDown = useCallback(() => {
    // LIST VIEW: Navigate through flat array
    if (view === 'list') {
      if (filteredLeads.length === 0) return

      if (!selectedCardId) {
        setSelectedCardId(filteredLeads[0].id)
      } else {
        const currentIndex = filteredLeads.findIndex(l => l.id === selectedCardId)
        if (currentIndex >= 0 && currentIndex < filteredLeads.length - 1) {
          const newCardId = filteredLeads[currentIndex + 1].id
          setSelectedCardId(newCardId)

          // Auto-scroll to row
          requestAnimationFrame(() => {
            const rowElement = document.querySelector(`[data-card-id="${newCardId}"]`)
            if (rowElement) {
              rowElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
            }
          })
        }
      }
      return
    }

    // KANBAN VIEW: Navigate within column
    if (selectedColumn >= visibleStatuses.length) {
      setSelectedColumn(0)
      return
    }

    const currentStatus = visibleStatuses[selectedColumn]
    const cardsInColumn = leadsByStatus[currentStatus] || []

    if (cardsInColumn.length === 0) return

    if (!selectedCardId) {
      setSelectedCardId(cardsInColumn[0].id)
    } else {
      const currentIndex = cardsInColumn.findIndex(l => l.id === selectedCardId)
      if (currentIndex >= 0 && currentIndex < cardsInColumn.length - 1) {
        setSelectedCardId(cardsInColumn[currentIndex + 1].id)
      }
    }
  }, [view, selectedColumn, selectedCardId, leadsByStatus, visibleStatuses, filteredLeads])

  const navigateUp = useCallback(() => {
    // LIST VIEW: Navigate through flat array
    if (view === 'list') {
      if (filteredLeads.length === 0) return

      if (!selectedCardId) {
        setSelectedCardId(filteredLeads[filteredLeads.length - 1].id)
      } else {
        const currentIndex = filteredLeads.findIndex(l => l.id === selectedCardId)
        if (currentIndex > 0) {
          const newCardId = filteredLeads[currentIndex - 1].id
          setSelectedCardId(newCardId)

          // Auto-scroll to row
          requestAnimationFrame(() => {
            const rowElement = document.querySelector(`[data-card-id="${newCardId}"]`)
            if (rowElement) {
              rowElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
            }
          })
        }
      }
      return
    }

    // KANBAN VIEW: Navigate within column
    if (selectedColumn >= visibleStatuses.length) {
      setSelectedColumn(0)
      return
    }

    const currentStatus = visibleStatuses[selectedColumn]
    const cardsInColumn = leadsByStatus[currentStatus] || []

    if (cardsInColumn.length === 0) return

    if (!selectedCardId) {
      setSelectedCardId(cardsInColumn[cardsInColumn.length - 1].id)
    } else {
      const currentIndex = cardsInColumn.findIndex(l => l.id === selectedCardId)
      if (currentIndex > 0) {
        setSelectedCardId(cardsInColumn[currentIndex - 1].id)
      }
    }
  }, [view, selectedColumn, selectedCardId, leadsByStatus, visibleStatuses, filteredLeads])

  const jumpToFirst = useCallback(() => {
    // LIST VIEW: Jump to first row
    if (view === 'list') {
      if (filteredLeads.length === 0) return
      const firstCardId = filteredLeads[0].id
      setSelectedCardId(firstCardId)

      requestAnimationFrame(() => {
        const rowElement = document.querySelector(`[data-card-id="${firstCardId}"]`)
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
        }
      })
      return
    }

    // KANBAN VIEW: Jump to first card in current column
    if (selectedColumn >= visibleStatuses.length) {
      setSelectedColumn(0)
    }

    const currentStatus = visibleStatuses[selectedColumn]
    const cardsInColumn = leadsByStatus[currentStatus] || []

    if (cardsInColumn.length > 0) {
      const firstCardId = cardsInColumn[0].id
      setSelectedCardId(firstCardId)

      requestAnimationFrame(() => {
        const cardElement = document.querySelector(`[data-card-id="${firstCardId}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
        }
      })
    }
  }, [view, selectedColumn, filteredLeads, leadsByStatus, visibleStatuses])

  const jumpToLast = useCallback(() => {
    // LIST VIEW: Jump to last row
    if (view === 'list') {
      if (filteredLeads.length === 0) return
      const lastCardId = filteredLeads[filteredLeads.length - 1].id
      setSelectedCardId(lastCardId)

      requestAnimationFrame(() => {
        const rowElement = document.querySelector(`[data-card-id="${lastCardId}"]`)
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
        }
      })
      return
    }

    // KANBAN VIEW: Jump to last card in current column
    if (selectedColumn >= visibleStatuses.length) {
      setSelectedColumn(0)
    }

    const currentStatus = visibleStatuses[selectedColumn]
    const cardsInColumn = leadsByStatus[currentStatus] || []

    if (cardsInColumn.length > 0) {
      const lastCardId = cardsInColumn[cardsInColumn.length - 1].id
      setSelectedCardId(lastCardId)

      requestAnimationFrame(() => {
        const cardElement = document.querySelector(`[data-card-id="${lastCardId}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
        }
      })
    }
  }, [view, selectedColumn, filteredLeads, leadsByStatus, visibleStatuses])

  const jumpToFirstColumn = useCallback(() => {
    setSelectedColumn(0)
    const firstStatus = STATUSES[0]
    const firstCards = leadsByStatus[firstStatus] || []

    if (firstCards.length > 0) {
      const firstCardId = firstCards[0].id
      setSelectedCardId(firstCardId)

      requestAnimationFrame(() => {
        const cardElement = document.querySelector(`[data-card-id="${firstCardId}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
        }
      })
    } else {
      setSelectedCardId(null)
      requestAnimationFrame(() => {
        const columnElement = document.querySelector(`[data-status="${firstStatus}"]`)
        if (columnElement) {
          columnElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
        }
      })
    }
  }, [leadsByStatus])

  const jumpToLastColumn = useCallback(() => {
    const lastColumnIndex = STATUSES.length - 1
    setSelectedColumn(lastColumnIndex)
    const lastStatus = STATUSES[lastColumnIndex]
    const lastCards = leadsByStatus[lastStatus] || []

    if (lastCards.length > 0) {
      const lastCardId = lastCards[0].id
      setSelectedCardId(lastCardId)

      requestAnimationFrame(() => {
        const cardElement = document.querySelector(`[data-card-id="${lastCardId}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
        }
      })
    } else {
      setSelectedCardId(null)
      requestAnimationFrame(() => {
        const columnElement = document.querySelector(`[data-status="${lastStatus}"]`)
        if (columnElement) {
          columnElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
        }
      })
    }
  }, [leadsByStatus])

  const navigateLeft = useCallback(() => {
    // Skip in list view - no columns to navigate
    if (view === 'list') return

    if (selectedColumn > 0) {
      // Get current row position
      const currentStatus = visibleStatuses[selectedColumn]
      const currentCards = leadsByStatus[currentStatus] || []
      const currentRowIndex = selectedCardId
        ? currentCards.findIndex(l => l.id === selectedCardId)
        : 0

      // Move to new column
      const newColumn = selectedColumn - 1
      setSelectedColumn(newColumn)

      // Try to maintain same row position
      const newStatus = visibleStatuses[newColumn]
      const newCards = leadsByStatus[newStatus] || []

      if (newCards.length > 0) {
        // Stay at same row, or use last card if new column is shorter
        const targetIndex = Math.min(currentRowIndex, newCards.length - 1)
        const newCardId = newCards[targetIndex].id
        setSelectedCardId(newCardId)

        // Auto-scroll to the selected card
        requestAnimationFrame(() => {
          const cardElement = document.querySelector(`[data-card-id="${newCardId}"]`)
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
          }
        })
      } else {
        setSelectedCardId(null)
        // Scroll to the empty column header
        requestAnimationFrame(() => {
          const columnElement = document.querySelector(`[data-status="${newStatus}"]`)
          if (columnElement) {
            columnElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
          }
        })
      }
    }
  }, [view, selectedColumn, selectedCardId, leadsByStatus, visibleStatuses])

  const navigateRight = useCallback(() => {
    // Skip in list view - no columns to navigate
    if (view === 'list') return

    if (selectedColumn < visibleStatuses.length - 1) {
      // Get current row position
      const currentStatus = visibleStatuses[selectedColumn]
      const currentCards = leadsByStatus[currentStatus] || []
      const currentRowIndex = selectedCardId
        ? currentCards.findIndex(l => l.id === selectedCardId)
        : 0

      // Move to new column
      const newColumn = selectedColumn + 1
      setSelectedColumn(newColumn)

      // Try to maintain same row position
      const newStatus = visibleStatuses[newColumn]
      const newCards = leadsByStatus[newStatus] || []

      if (newCards.length > 0) {
        // Stay at same row, or use last card if new column is shorter
        const targetIndex = Math.min(currentRowIndex, newCards.length - 1)
        const newCardId = newCards[targetIndex].id
        setSelectedCardId(newCardId)

        // Auto-scroll to the selected card
        requestAnimationFrame(() => {
          const cardElement = document.querySelector(`[data-card-id="${newCardId}"]`)
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
          }
        })
      } else {
        setSelectedCardId(null)
        // Scroll to the empty column header
        requestAnimationFrame(() => {
          const columnElement = document.querySelector(`[data-status="${newStatus}"]`)
          if (columnElement) {
            columnElement.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
          }
        })
      }
    }
  }, [view, selectedColumn, selectedCardId, leadsByStatus, visibleStatuses])

  const moveCardToStatus = async (cardId, newStatus) => {
    const card = leads.find(l => l.id === cardId)
    if (!card) return

    try {
      // Save for undo
      setLastAction({
        leadId: cardId,
        previousStatus: card.computed_status,
        newStatus: newStatus
      })

      // Show success animation
      setSuccessColumn(newStatus)
      setTimeout(() => setSuccessColumn(null), 600)

      // Optimistic update
      setLeads(prevLeads =>
        prevLeads.map(l =>
          l.id === cardId
            ? { ...l, localbase_status: newStatus, computed_status: newStatus }
            : l
        )
      )

      // Update database
      const query = `UPDATE customer_relationships SET localbase_status = '${newStatus}' WHERE id = '${cardId}'`
      await window.electronAPI.db.query(query, [])
    } catch (error) {
      console.error('Failed to update status:', error)
      await loadLeads()
    }
  }

  // Open detail view
  const openDetail = (lead) => {
    setSelectedLead(lead)
    setShowDetail(true)
  }

  // Undo last drag action
  const handleUndo = async () => {
    if (!lastAction) return

    const { leadId, previousStatus } = lastAction

    try {
      console.log(`⏪ Undoing: Moving lead ${leadId} back to ${previousStatus}`)

      // Update UI immediately
      setLeads(prevLeads =>
        prevLeads.map(l =>
          l.id === leadId
            ? { ...l, localbase_status: previousStatus, computed_status: previousStatus }
            : l
        )
      )

      // Update database
      const query = `UPDATE customer_relationships SET localbase_status = '${previousStatus}' WHERE id = '${leadId}'`
      await window.electronAPI.db.query(query, [])

      // Clear the undo action
      setLastAction(null)
    } catch (error) {
      console.error('Failed to undo:', error)
      alert('Failed to undo')
      await loadLeads()
    }
  }

  // Handle drag start
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id)
  }

  // Handle drag end - update status in database
  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveDragId(null)

    if (!over) return

    const leadId = active.id

    // Find which column was dropped into by checking data-status attribute
    let newStatus = null

    // Check if dropped directly on a column
    if (STATUSES.includes(over.id)) {
      newStatus = over.id
    } else {
      // Dropped on another card - find its parent column
      const overLead = leads.find(l => l.id === over.id)
      if (overLead) {
        newStatus = overLead.computed_status
      }
    }

    if (!newStatus) {
      console.log('Could not determine drop column')
      return
    }

    // Find the lead being dragged
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.computed_status === newStatus) return

    // Don't allow dragging leads with payment/invoice override
    if (lead.computed_status === 'Payment Complete' || lead.computed_status === 'Invoice Sent') {
      alert('Cannot move leads with invoice or payment records. Update those records first.')
      return
    }

    try {
      // Save previous state for undo
      setLastAction({
        leadId: leadId,
        previousStatus: lead.computed_status,
        newStatus: newStatus
      })

      // Show success animation on target column
      setSuccessColumn(newStatus)
      setTimeout(() => setSuccessColumn(null), 600)

      // Optimistic update - update UI immediately
      setLeads(prevLeads =>
        prevLeads.map(l =>
          l.id === leadId
            ? { ...l, localbase_status: newStatus, computed_status: newStatus }
            : l
        )
      )

      // Update database in background
      const query = `UPDATE customer_relationships SET localbase_status = '${newStatus}' WHERE id = '${leadId}'`
      await window.electronAPI.db.query(query, [])

    } catch (error) {
      console.error('Failed to update lead status:', error)
      alert('Failed to update status')
      // Revert on error
      await loadLeads()
    }
  }

  // Droppable column component
  const DroppableColumn = ({ status, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id: status })
    const isSuccess = successColumn === status

    return (
      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-[200px] max-h-full overflow-y-auto pr-2 p-3 rounded-lg transition-all duration-200 ${
          isSuccess
            ? 'bg-green-400/10 scale-[1.02]'
            : isOver
            ? 'bg-green-500/5 scale-[1.01]'
            : 'bg-transparent'
        }`}
      >
        {children}
      </div>
    )
  }

  // Draggable lead card component
  const DraggableLeadCard = ({ lead }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: lead.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      // Ghost the original card while dragging (the real one is in DragOverlay)
      opacity: isDragging ? 0.3 : 1,
      cursor: 'grab',
    }

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <LeadCard lead={lead} />
      </div>
    )
  }

  // Render lead card
  const LeadCard = ({ lead, compact = false }) => {
    const isSelected = selectedCardId === lead.id
    return (
    <div className="relative" data-card-id={lead.id}>
      {isSelected && (
        <>
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-green-400 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-green-400 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-green-400 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-green-400 rounded-br-sm pointer-events-none" />
        </>
      )}
    <Card
      key={lead.id}
      className="mb-2 cursor-pointer p-2"
      onClick={() => openDetail(lead)}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {lead.first_name} {lead.last_name}
          </div>
          {lead.date_created && (
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(lead.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
        {lead.phone && (
          <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">{formatPhone(lead.phone)}</span>
          </div>
        )}
      </div>
      {lead.primary_address && (
        <div className="flex items-center gap-1 text-xs text-gray-400 truncate mb-0.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{lead.primary_address}</span>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {lead.email && (
          <div className="flex items-center gap-1 truncate flex-1 min-w-0">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.lead_channel && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0">
            {lead.lead_channel}
          </span>
        )}
      </div>
    </Card>
    </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 border-b border-gray-800">
        {/* Top Row: Title and Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pipeline</h1>
            <p className="text-sm text-gray-400">{filteredLeads.length} leads</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex border border-gray-700 rounded-md overflow-hidden">
              <Button
                variant={view === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('kanban')}
                className="rounded-none"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className="rounded-none"
              >
                <LayoutList className="w-4 h-4" />
              </Button>
            </div>

            {/* Add Record Button */}
            <Button
              size="sm"
              variant="outline"
              className="border-green-400/50 text-green-400 hover:bg-green-400/10 font-mono shadow-lg"
            >
              <Plus className="h-3 w-3 mr-1" />
              new
            </Button>
          </div>
        </div>

        {/* Full Width Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Try: '!collapse' or '!incomplete' or '!nap' or 'NAP leads without email'..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'kanban' ? (
          // Kanban View with Drag and Drop
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
              {STATUSES
                .filter(status => !collapseEmpty || (leadsByStatus[status]?.length > 0))
                .map(status => (
                <div key={status} className="flex-shrink-0 w-80" data-status={status}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{status}</h3>
                    <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                      {leadsByStatus[status]?.length || 0}
                    </span>
                  </div>
                  <SortableContext
                    id={status}
                    items={leadsByStatus[status]?.map(l => l.id) || []}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableColumn status={status}>
                      {leadsByStatus[status]?.length > 0 ? (
                        leadsByStatus[status].map(lead => (
                          <DraggableLeadCard key={lead.id} lead={lead} />
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No leads
                        </div>
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              ))}
            </div>

            {/* DragOverlay - always mounted, renders floating copy under cursor */}
            <DragOverlay
              dropAnimation={{
                duration: 150,
                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
              }}
            >
              {activeDragId ? (
                <div
                  style={{
                    cursor: 'grabbing',
                    transform: 'rotate(3deg) scale(1.05)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 3px rgba(34, 197, 94, 0.5)',
                  }}
                >
                  <LeadCard lead={leads.find(l => l.id === activeDragId)} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          // List View - Table Format
          <div className="w-full">
            {filteredLeads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-auto">
                  <thead className="border-b border-gray-800 sticky top-0 bg-background">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                        Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-400 w-auto">
                        Address {sortColumn === 'primary_address' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                        Phone {sortColumn === 'phone' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-400 w-auto">
                        Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                        Channel {sortColumn === 'lead_channel' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                        Status {sortColumn === 'computed_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                        Created {sortColumn === 'date_created' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(lead => {
                      const isSelected = selectedCardId === lead.id
                      return (
                        <tr
                          key={lead.id}
                          data-card-id={lead.id}
                          onClick={() => openDetail(lead)}
                          className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${
                            isSelected ? 'bg-green-400/10 ring-1 ring-green-400/50' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 w-auto">
                            <div className="font-medium whitespace-nowrap">
                              {lead.first_name} {lead.last_name}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 w-auto">
                            {lead.primary_address ? (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-xs">{lead.primary_address}</span>
                              </div>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap w-auto">
                            {lead.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 flex-shrink-0" />
                                <span className="whitespace-nowrap">{formatPhone(lead.phone)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 w-auto">
                            {lead.email ? (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-xs">{lead.email}</span>
                              </div>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 w-auto">
                            {lead.lead_channel ? (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                                {lead.lead_channel}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 w-auto">
                            <span className={`px-2 py-0.5 rounded text-xs text-white whitespace-nowrap ${STATUS_COLORS[lead.computed_status] || 'bg-gray-500'}`}>
                              {lead.computed_status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap w-auto">
                            {lead.date_created ? (
                              new Date(lead.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No leads found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Slide-Over Panel */}
      {showDetail && selectedLead && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDetail(false)}
          />

          {/* Slide-over panel */}
          <div className="ml-auto relative w-full max-w-lg bg-card shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedLead.first_name} {selectedLead.last_name}
                </h2>
                <span className={`inline-block px-2 py-0.5 rounded text-xs text-white mt-2 ${STATUS_COLORS[selectedLead.computed_status] || 'bg-gray-500'}`}>
                  {selectedLead.computed_status}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetail(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Contact Information</h3>
                <div className="space-y-3">
                  {selectedLead.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${selectedLead.email}`} className="text-sm hover:underline">
                        {selectedLead.email}
                      </a>
                    </div>
                  )}
                  {selectedLead.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${selectedLead.phone}`} className="text-sm hover:underline">
                        {formatPhone(selectedLead.phone)}
                      </a>
                    </div>
                  )}
                  {selectedLead.primary_address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{selectedLead.primary_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Lead Details</h3>
                <div className="space-y-3">
                  {selectedLead.lead_channel && (
                    <div className="flex items-center gap-3">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Source Channel</div>
                        <div className="text-sm font-medium">{selectedLead.lead_channel}</div>
                      </div>
                    </div>
                  )}
                  {selectedLead.amount && (
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Deal Value</div>
                        <div className="text-sm font-medium">${selectedLead.amount}</div>
                      </div>
                    </div>
                  )}
                  {selectedLead.date_created && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Created</div>
                        <div className="text-sm font-medium">
                          {new Date(selectedLead.date_created).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedLead.source_status && (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4" />
                      <div>
                        <div className="text-xs text-gray-500">Original Status</div>
                        <div className="text-sm font-medium">{selectedLead.source_status}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              {selectedLead.metadata && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Additional Data</h3>
                  <div className="bg-gray-900 rounded p-3 text-xs font-mono text-gray-400 overflow-auto max-h-40">
                    {selectedLead.metadata}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-800 flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => confirmDelete(selectedLead)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Record
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDetail(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Notification */}
      {showDeleteDialog && deleteTarget && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-bottom-5 duration-300">
          {/* Compact notification card */}
          <div className="bg-gray-900 border border-red-900/50 rounded-lg shadow-2xl shadow-red-500/20 p-4 max-w-sm">
            {/* Header with icon and close */}
            <div className="flex items-start gap-3 mb-3">
              <div className="rounded-full bg-red-500/10 p-2 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">Delete this record?</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {deleteTarget.first_name} {deleteTarget.last_name}
                </p>
              </div>
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
