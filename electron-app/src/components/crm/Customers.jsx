import { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { Search, Mail, Phone, MapPin, DollarSign, Calendar, X, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Format phone number to (XXX) XXX-XXXX
const formatPhone = (phone) => {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerLeads, setCustomerLeads] = useState([])
  const [customerPayments, setCustomerPayments] = useState([])
  const [sortColumn, setSortColumn] = useState('last_payment_date')
  const [sortDirection, setSortDirection] = useState('desc')

  useEffect(() => {
    loadCustomers()
  }, [])

  // Debounce search term to avoid abrupt UX while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // Wait 300ms after user stops typing

    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadCustomers = async () => {
    try {
      setLoading(true)

      if (!window.electronAPI?.db) {
        console.error('Database API not available')
        setLoading(false)
        return
      }

      // Get customers who have made payments (implies QuickBooks profile)
      const query = `
        SELECT DISTINCT
          c.id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.primary_address,
          COUNT(DISTINCT payments.id) as payment_count,
          SUM(CAST(payments.amount AS REAL)) as total_paid,
          MAX(payments.date_created) as last_payment_date,
          MIN(payments.date_created) as first_payment_date
        FROM customers c
        JOIN customer_relationships payments
          ON payments.customer_id = c.id
          AND payments.relationship_type = 'payment'
        GROUP BY c.id
        ORDER BY last_payment_date DESC
      `

      const result = await window.electronAPI.db.query(query, [])
      setCustomers(result || [])
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerDetails = async (customerId) => {
    try {
      // Load all leads for this customer
      const leadsQuery = `
        SELECT
          cr.id,
          cr.status as source_status,
          cr.localbase_status,
          cr.amount,
          cr.lead_channel,
          cr.date_created,
          cr.metadata,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM customer_relationships
              WHERE customer_id = cr.customer_id AND relationship_type = 'payment'
            ) THEN 'Payment Complete'
            WHEN EXISTS (
              SELECT 1 FROM customer_relationships
              WHERE customer_id = cr.customer_id AND relationship_type = 'invoice'
            ) THEN 'Invoice Sent'
            ELSE cr.localbase_status
          END as computed_status
        FROM customer_relationships cr
        WHERE cr.customer_id = ? AND cr.relationship_type = 'lead'
        ORDER BY cr.date_created DESC
      `
      const leads = await window.electronAPI.db.query(leadsQuery, [customerId])

      // Load all payments for this customer
      const paymentsQuery = `
        SELECT
          id,
          amount,
          date_created,
          metadata
        FROM customer_relationships
        WHERE customer_id = ? AND relationship_type = 'payment'
        ORDER BY date_created DESC
      `
      const payments = await window.electronAPI.db.query(paymentsQuery, [customerId])

      setCustomerLeads(leads || [])
      setCustomerPayments(payments || [])
    } catch (error) {
      console.error('Failed to load customer details:', error)
    }
  }

  // Parse search term into structured filters
  const parseFilters = (searchTerm) => {
    const filters = {
      textSearch: null,
      totalPaid: { min: null, max: null },
      paymentCount: { min: null, max: null },
      dateRange: { start: null, end: null }
    }

    if (!searchTerm) return filters

    // Strip conversational prefixes
    let cleanedTerm = searchTerm.trim()
    const conversationalPrefixes = [
      /^show me\s+/i,
      /^let'?s see\s+/i,
      /^filter for\s+/i,
      /^find\s+/i,
      /^get me\s+/i,
      /^give me\s+/i,
      /^display\s+/i,
      /^list\s+/i
    ]

    for (const prefix of conversationalPrefixes) {
      cleanedTerm = cleanedTerm.replace(prefix, '')
    }

    // Convert word numbers to digits
    const wordNumbers = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
      'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
      'eighteen': '18', 'nineteen': '19', 'twenty': '20'
    }

    for (const [word, digit] of Object.entries(wordNumbers)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      cleanedTerm = cleanedTerm.replace(regex, digit)
    }

    const lower = cleanedTerm.toLowerCase().trim()

    // Parse payment count FIRST (more specific)
    // Patterns: >5 payments, >5, < 3 payments, more than 5 payments
    const paymentCountMatch = lower.match(/(?:more than|>)\s*(\d+)(?:\s*payments?)?(?:\s|$)/)
    if (paymentCountMatch && parseInt(paymentCountMatch[1]) < 100) {
      // Only treat as payment count if number is small (< 100)
      filters.paymentCount.min = parseInt(paymentCountMatch[1])
    }

    const paymentCountUnderMatch = lower.match(/(?:less than|fewer than|<)\s*(\d+)(?:\s*payments?)?(?:\s|$)/)
    if (paymentCountUnderMatch && parseInt(paymentCountUnderMatch[1]) < 100) {
      filters.paymentCount.max = parseInt(paymentCountUnderMatch[1])
    }

    // Parse numeric comparisons for total paid (only if not already matched as payment count)
    // Patterns: >10000, > 10k, over 10000, under 5000, <5000, $5000+
    if (!paymentCountMatch) {
      const totalPaidMatch = lower.match(/(?:total\s*paid\s+|paid\s+)?(?:over|>|above)\s*\$?(\d+\.?\d*k?)/)
      if (totalPaidMatch) {
        let amount = parseFloat(totalPaidMatch[1].replace('k', ''))
        if (totalPaidMatch[1].includes('k')) amount *= 1000
        // Only treat as amount if it's > 100 or has $ or k
        if (amount > 100 || totalPaidMatch[0].includes('$') || totalPaidMatch[0].includes('k')) {
          filters.totalPaid.min = amount
        }
      }
    }

    if (!paymentCountUnderMatch) {
      const totalPaidUnderMatch = lower.match(/(?:total\s*paid\s+|paid\s+)?(?:under|<|below)\s*\$?(\d+\.?\d*k?)/)
      if (totalPaidUnderMatch) {
        let amount = parseFloat(totalPaidUnderMatch[1].replace('k', ''))
        if (totalPaidUnderMatch[1].includes('k')) amount *= 1000
        if (amount > 100 || totalPaidUnderMatch[0].includes('$') || totalPaidUnderMatch[0].includes('k')) {
          filters.totalPaid.max = amount
        }
      }
    }

    // Parse date ranges
    // Patterns: last 30 days, this month, this year, 2024
    if (lower.match(/last\s+(\d+)\s+days?/)) {
      const days = parseInt(lower.match(/last\s+(\d+)\s+days?/)[1])
      const date = new Date()
      date.setDate(date.getDate() - days)
      filters.dateRange.start = date.toISOString().split('T')[0]
    }

    if (lower.includes('this month')) {
      const now = new Date()
      filters.dateRange.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    }

    if (lower.includes('this year')) {
      const now = new Date()
      filters.dateRange.start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    }

    // If no special filters matched, treat as text search
    // But remove any matched patterns first
    let textSearch = cleanedTerm
    // Remove all filter patterns from text search
    textSearch = textSearch
      .replace(/(?:total\s*paid\s+|paid\s+)?(?:over|under|>|<|above|below)\s*\$?\d+\.?\d*k?/gi, '')
      .replace(/(?:more than|less than|fewer than|>|<)\s*\d+(?:\s*payments?)?/gi, '')
      .replace(/last\s+\d+\s+days?/gi, '')
      .replace(/this\s+(month|year)/gi, '')
      .trim()

    // Remove common filler words that don't help with search
    const fillerWords = /\b(all|customers?|with|the|a|an|that|have|has|had)\b/gi
    textSearch = textSearch.replace(fillerWords, '').replace(/\s+/g, ' ').trim()

    if (textSearch) {
      filters.textSearch = textSearch.toLowerCase()
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

  // Filter and sort customers
  const filteredCustomers = customers
    .filter(customer => {
      if (!debouncedSearchTerm) return true

      const filters = parseFilters(debouncedSearchTerm)

      // Text search filter
      if (filters.textSearch) {
        const match = (
          (customer.first_name && customer.first_name.toLowerCase().includes(filters.textSearch)) ||
          (customer.last_name && customer.last_name.toLowerCase().includes(filters.textSearch)) ||
          (customer.email && customer.email.toLowerCase().includes(filters.textSearch)) ||
          (customer.phone && customer.phone.includes(filters.textSearch)) ||
          (customer.primary_address && customer.primary_address.toLowerCase().includes(filters.textSearch))
        )
        if (!match) return false
      }

      // Total paid filters
      if (filters.totalPaid.min !== null) {
        const totalPaid = parseFloat(customer.total_paid || 0)
        if (totalPaid <= filters.totalPaid.min) return false
      }
      if (filters.totalPaid.max !== null) {
        const totalPaid = parseFloat(customer.total_paid || 0)
        if (totalPaid >= filters.totalPaid.max) return false
      }

      // Payment count filters
      if (filters.paymentCount.min !== null) {
        // >1 means "more than 1", so keep customers with count > min
        const count = customer.payment_count || 0
        if (count <= filters.paymentCount.min) return false
      }
      if (filters.paymentCount.max !== null) {
        // <3 means "less than 3", so keep customers with count < max
        const count = customer.payment_count || 0
        if (count >= filters.paymentCount.max) return false
      }

      // Date range filters
      if (filters.dateRange.start !== null) {
        if (!customer.last_payment_date || customer.last_payment_date < filters.dateRange.start) return false
      }

      return true
    })
    .sort((a, b) => {
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
        case 'payment_count':
          aVal = a.payment_count || 0
          bVal = b.payment_count || 0
          break
        case 'total_paid':
          aVal = parseFloat(a.total_paid || 0)
          bVal = parseFloat(b.total_paid || 0)
          break
        case 'last_payment_date':
          aVal = a.last_payment_date || ''
          bVal = b.last_payment_date || ''
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  // Vim-style keyboard navigation
  useEffect(() => {
    let lastKeyPress = null
    let lastKeyTime = 0

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Priority 1: Close detail panel if open
        if (showDetail) {
          e.preventDefault()
          e.stopPropagation()
          setShowDetail(false)
          setSelectedCustomer(null)
          setCustomerLeads([])
          setCustomerPayments([])
          return
        }

        // Priority 2: If search input is focused, blur it and clear search
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
          e.preventDefault()
          e.stopPropagation()
          setSearchTerm('')
          e.target.blur()
          return
        }

        // Priority 3: Clear selection
        if (selectedCustomerId) {
          e.preventDefault()
          e.stopPropagation()
          setSelectedCustomerId(null)
          return
        }

        e.stopPropagation()
        return
      }

      // Don't interfere when typing in input fields
      if (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable) {
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

      // Number keys 1-7 for sorting
      if (e.key >= '1' && e.key <= '7') {
        e.preventDefault()
        const columnMap = {
          '1': 'name',
          '2': 'primary_address',
          '3': 'phone',
          '4': 'email',
          '5': 'payment_count',
          '6': 'total_paid',
          '7': 'last_payment_date'
        }
        handleSort(columnMap[e.key])
        return
      }

      // j - Move down
      if (e.key === 'j') {
        e.preventDefault()
        if (filteredCustomers.length === 0) return

        const currentIndex = filteredCustomers.findIndex(c => c.id === selectedCustomerId)
        if (currentIndex === -1) {
          // No selection, select first
          flushSync(() => {
            setSelectedCustomerId(filteredCustomers[0].id)
          })
          scrollToCustomer(filteredCustomers[0].id)
        } else if (currentIndex < filteredCustomers.length - 1) {
          // Move to next
          const nextCustomer = filteredCustomers[currentIndex + 1]
          flushSync(() => {
            setSelectedCustomerId(nextCustomer.id)
          })
          scrollToCustomer(nextCustomer.id)
        }
        return
      }

      // k - Move up
      if (e.key === 'k') {
        e.preventDefault()
        if (filteredCustomers.length === 0) return

        const currentIndex = filteredCustomers.findIndex(c => c.id === selectedCustomerId)
        if (currentIndex === -1) {
          // No selection, select first
          flushSync(() => {
            setSelectedCustomerId(filteredCustomers[0].id)
          })
          scrollToCustomer(filteredCustomers[0].id)
        } else if (currentIndex > 0) {
          // Move to previous
          const prevCustomer = filteredCustomers[currentIndex - 1]
          flushSync(() => {
            setSelectedCustomerId(prevCustomer.id)
          })
          scrollToCustomer(prevCustomer.id)
        }
        return
      }

      // g - Jump to first (gg)
      if (e.key === 'g') {
        const now = Date.now()
        if (lastKeyPress === 'g' && (now - lastKeyTime) < 500) {
          e.preventDefault()
          if (filteredCustomers.length > 0) {
            const firstCustomer = filteredCustomers[0]
            setSelectedCustomerId(firstCustomer.id)
            scrollToCustomer(firstCustomer.id)
          }
          lastKeyPress = null
        } else {
          lastKeyPress = 'g'
          lastKeyTime = now
        }
        return
      }

      // G - Jump to last
      if (e.key === 'G' && e.shiftKey) {
        e.preventDefault()
        if (filteredCustomers.length > 0) {
          const lastCustomer = filteredCustomers[filteredCustomers.length - 1]
          setSelectedCustomerId(lastCustomer.id)
          scrollToCustomer(lastCustomer.id)
        }
        return
      }

      // Enter - Open detail panel for selected customer
      if (e.key === 'Enter') {
        if (selectedCustomerId) {
          e.preventDefault()
          const customer = filteredCustomers.find(c => c.id === selectedCustomerId)
          if (customer) {
            setSelectedCustomer(customer)
            loadCustomerDetails(customer.id)
            setShowDetail(true)
          }
        }
        return
      }
    }

    const scrollToCustomer = (customerId) => {
      requestAnimationFrame(() => {
        const rowElement = document.querySelector(`[data-customer-id="${customerId}"]`)
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'auto', block: 'nearest' })
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCustomerId, showDetail, customers, searchTerm])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading customers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customers</h1>
            <p className="text-sm text-gray-400">{filteredCustomers.length} paying customers</p>
          </div>
        </div>

        {/* Search */}
        <div className="w-full space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search: 'over 10k', '>5 payments', 'this month', or name/email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          {/* Active Filters Display */}
          {debouncedSearchTerm && (() => {
            const filters = parseFilters(debouncedSearchTerm)
            const hasFilters = filters.totalPaid.min || filters.totalPaid.max ||
                              filters.paymentCount.min || filters.paymentCount.max ||
                              filters.dateRange.start

            if (!hasFilters) return null

            return (
              <div className="flex flex-wrap gap-2 text-xs">
                {filters.totalPaid.min !== null && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    💰 Total Paid &gt; ${filters.totalPaid.min.toLocaleString()}
                  </span>
                )}
                {filters.totalPaid.max !== null && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                    💰 Total Paid &lt; ${filters.totalPaid.max.toLocaleString()}
                  </span>
                )}
                {filters.paymentCount.min !== null && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    📊 Payments &gt; {filters.paymentCount.min}
                  </span>
                )}
                {filters.paymentCount.max !== null && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                    📊 Payments &lt; {filters.paymentCount.max}
                  </span>
                )}
                {filters.dateRange.start && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                    📅 Since {new Date(filters.dateRange.start).toLocaleDateString()}
                  </span>
                )}
                {filters.textSearch && (
                  <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded">
                    🔍 Text: "{filters.textSearch}"
                  </span>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* List View */}
      <div className="flex-1 overflow-auto p-4">
        <div className="w-full">
          {filteredCustomers.length > 0 ? (
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
                      Payments {sortColumn === 'payment_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                      Total Paid {sortColumn === 'total_paid' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-2 font-semibold text-gray-400" style={{width: '1%'}}>
                      Last Payment {sortColumn === 'last_payment_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => {
                    const isSelected = selectedCustomerId === customer.id
                    return (
                      <tr
                        key={customer.id}
                        data-customer-id={customer.id}
                        onClick={() => {
                          setSelectedCustomerId(customer.id)
                          setSelectedCustomer(customer)
                          loadCustomerDetails(customer.id)
                          setShowDetail(true)
                        }}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${
                          isSelected ? 'bg-green-400/10 ring-1 ring-green-400/50' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 w-auto">
                          <div className="font-medium whitespace-nowrap">
                            {customer.first_name} {customer.last_name}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 w-auto">
                          {customer.primary_address ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-xs">{customer.primary_address}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap w-auto">
                          {customer.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span className="whitespace-nowrap">{formatPhone(customer.phone)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 w-auto">
                          {customer.email ? (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-xs">{customer.email}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-center whitespace-nowrap w-auto">
                          {customer.payment_count}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap w-auto">
                          {customer.total_paid ? (
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="w-3 h-3 flex-shrink-0" />
                              <span>${parseFloat(customer.total_paid).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap w-auto">
                          {customer.last_payment_date ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              <span>
                                {new Date(customer.last_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
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
              No customers found
            </div>
          )}
        </div>
      </div>

      {/* Customer Detail Panel */}
      {showDetail && selectedCustomer && (
        <div className="fixed inset-y-0 right-0 w-[600px] bg-card border-l border-gray-800 shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-green-400" />
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </h2>
                <p className="text-xs text-gray-400">Customer Details</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowDetail(false)
                setSelectedCustomer(null)
                setCustomerLeads([])
                setCustomerPayments([])
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Contact Information */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-400">Contact Information</h3>
              <div className="space-y-2 text-sm">
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{formatPhone(selectedCustomer.phone)}</span>
                  </div>
                )}
                {selectedCustomer.primary_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{selectedCustomer.primary_address}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Summary Stats */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-400">Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total Paid</p>
                  <p className="text-lg font-semibold text-green-400">
                    ${parseFloat(selectedCustomer.total_paid).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Payments</p>
                  <p className="text-lg font-semibold">{selectedCustomer.payment_count}</p>
                </div>
                <div>
                  <p className="text-gray-500">Customer Since</p>
                  <p className="text-sm">
                    {new Date(selectedCustomer.first_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Last Payment</p>
                  <p className="text-sm">
                    {new Date(selectedCustomer.last_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </Card>

            {/* Lead Records */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-400">Lead History ({customerLeads.length})</h3>
              {customerLeads.length > 0 ? (
                <div className="space-y-2">
                  {customerLeads.map(lead => (
                    <div key={lead.id} className="p-3 bg-gray-800/30 rounded border border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          lead.computed_status === 'Payment Complete' ? 'bg-green-500/20 text-green-400' :
                          lead.computed_status === 'Invoice Sent' ? 'bg-blue-500/20 text-blue-400' :
                          lead.computed_status === 'Proposal Sent' ? 'bg-purple-500/20 text-purple-400' :
                          lead.computed_status === 'Estimate Sent' ? 'bg-yellow-500/20 text-yellow-400' :
                          lead.computed_status === 'New Lead' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {lead.computed_status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(lead.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-xs space-y-1">
                        {lead.lead_channel && (
                          <div className="text-gray-400">Channel: {lead.lead_channel}</div>
                        )}
                        {lead.amount && (
                          <div className="text-gray-400">
                            Amount: ${parseFloat(lead.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No lead records found</p>
              )}
            </Card>

            {/* Payment History */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-400">Payment History ({customerPayments.length})</h3>
              {customerPayments.length > 0 ? (
                <div className="space-y-2">
                  {customerPayments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded border border-gray-800">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-green-400">
                          ${parseFloat(payment.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {new Date(payment.date_created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No payment records found</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
