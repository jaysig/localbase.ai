/**
 * MediaTrader Data Adapter (Config-Driven)
 *
 * Framework provides generic query architecture.
 * Instances provide config.json defining available data sources.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

/**
 * Load MediaTrader config from workspace
 */
export function loadConfig(workspacePath) {
  // Check both locations: extensions/ (new) and tools/ (old)
  const configPaths = [
    path.join(workspacePath, 'extensions/mediatrader/config.json'),
    path.join(workspacePath, 'tools/mediatrader/config.json')
  ]

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(configData)
      } catch (error) {
        console.error('❌ Error parsing MediaTrader config:', error)
        return null
      }
    }
  }

  console.warn('⚠️  MediaTrader config not found in:', configPaths)
  return null
}

/**
 * Generic SQLite time series query
 */
function queryTimeSeriesFromSQLite(workspacePath, source, options = {}) {
  const { startDate = '2022-01-01', endDate = '2025-12-31', aggregation = 'count' } = options

  const dbPath = path.join(workspacePath, source.dataSource)
  const db = new Database(dbPath, { readonly: true })

  // Determine what to aggregate
  let aggregateSQL = 'COUNT(*) as count'
  if (aggregation === 'sum' && source.costField) {
    aggregateSQL = `SUM([${source.costField}]) as spend`
  } else if ((aggregation === 'sum' || aggregation === 'count') && source.valueField) {
    // If there's a valueField, sum it by default (clicks, impressions, etc.)
    aggregateSQL = `SUM([${source.valueField}]) as value`
  }

  // Handle different date formats
  let monthExpression
  let dateFieldExpression = `[${source.dateField}]`

  if (source.dateFormat === 'month') {
    // Date field is already in 'YYYY-MM' format (text field)
    monthExpression = `[${source.dateField}]`
  } else if (source.dateFormat === 'unixepoch') {
    // Date field is Unix timestamp (integer)
    // Handle both seconds and milliseconds (milliseconds > 1000000000000)
    dateFieldExpression = `datetime(CASE WHEN [${source.dateField}] > 1000000000000 THEN [${source.dateField}]/1000 ELSE [${source.dateField}] END, 'unixepoch')`
    monthExpression = `strftime('%Y-%m', datetime(CASE WHEN [${source.dateField}] > 1000000000000 THEN [${source.dateField}]/1000 ELSE [${source.dateField}] END, 'unixepoch'))`
  } else {
    // Standard DATE/DATETIME field
    monthExpression = `strftime('%Y-%m', [${source.dateField}])`
  }

  // Build WHERE clause with optional filters
  let whereClause = `WHERE ${dateFieldExpression} IS NOT NULL
      AND ${dateFieldExpression} >= ?
      AND ${dateFieldExpression} <= ?`

  if (source.filterField && source.filterValue) {
    whereClause += `\n      AND [${source.filterField}] = '${source.filterValue}'`
  }

  // Add custom whereClause from config (for event filtering, outcome filtering, etc.)
  if (source.whereClause) {
    whereClause += `\n      AND ${source.whereClause}`
  }

  const query = `
    SELECT
      ${monthExpression} as month,
      ${aggregateSQL}
    FROM ${source.table}
    ${whereClause}
    GROUP BY month
    ORDER BY month
  `

  const results = db.prepare(query).all(startDate, endDate)
  db.close()

  return results
}

/**
 * Generic CSV time series reader
 */
function queryTimeSeriesFromCSV(workspacePath, source, options = {}) {
  const { startDate = '2024-01-01', endDate = '2025-12-31' } = options

  const csvPath = path.join(workspacePath, source.dataSource)
  const csvData = fs.readFileSync(csvPath, 'utf-8')

  const lines = csvData.trim().split('\n').slice(1) // Skip header
  const results = lines
    .map(line => {
      const [month, value] = line.split(',')
      return {
        month,
        value: parseInt(value, 10)
      }
    })
    .filter(row => {
      const monthDate = row.month.includes('-') ? `${row.month}-01` : row.month
      return monthDate >= startDate && monthDate <= endDate
    })

  return results
}

/**
 * Query data for any source defined in config
 */
export function queryDataSource(workspacePath, sourceId, options = {}) {
  const config = loadConfig(workspacePath)
  if (!config) return []

  // Find source in channels or conversionSources
  const source = [...config.channels, ...config.conversionSources].find(s => s.id === sourceId)

  if (!source) {
    console.warn(`⚠️  Source "${sourceId}" not found in config`)
    return []
  }

  if (!source.enabled) {
    console.warn(`⚠️  Source "${sourceId}" is disabled`)
    return []
  }

  try {
    // Determine source type by extension
    if (source.dataSource.endsWith('.csv')) {
      return queryTimeSeriesFromCSV(workspacePath, source, options)
    } else if (source.dataSource.endsWith('.sqlite') || source.dataSource.endsWith('.db')) {
      return queryTimeSeriesFromSQLite(workspacePath, source, options)
    } else {
      console.warn(`⚠️  Unknown data source type: ${source.dataSource}`)
      return []
    }
  } catch (error) {
    console.error(`❌ Error querying source "${sourceId}":`, error)
    return []
  }
}

/**
 * Get all available data sources from config
 */
export function getAvailableDataSources(workspacePath) {
  const config = loadConfig(workspacePath)
  if (!config) return { channels: [], conversionSources: [] }

  return {
    channels: config.channels.filter(c => c.enabled),
    conversionSources: config.conversionSources.filter(c => c.enabled)
  }
}

// Legacy compatibility - specific query functions
// These now use the config-driven approach internally

export function getDealsCreatedByMonth(workspacePath, options = {}) {
  return queryDataSource(workspacePath, 'hubspot-deals', options)
}

export function getBusinessesCreatedByMonth(workspacePath, options = {}) {
  return queryDataSource(workspacePath, 'hubspot-companies', options)
}

export function getOrganicClicksByMonth(workspacePath, options = {}) {
  const results = queryDataSource(workspacePath, 'organic-clicks', options)
  // Map 'value' to 'clicks' for backward compatibility
  return results.map(r => ({ month: r.month, clicks: r.count || r.value }))
}

export function getOrganicImpressionsByMonth(workspacePath, options = {}) {
  const results = queryDataSource(workspacePath, 'organic-impressions', options)
  return results.map(r => ({ month: r.month, impressions: r.count || r.value }))
}

export function getDirectTrafficByMonth(workspacePath, options = {}) {
  const results = queryDataSource(workspacePath, 'direct-traffic', options)
  return results.map(r => ({ month: r.month, direct_traffic: r.value }))
}

export function getYouTubeViewsByMonth(workspacePath, options = {}) {
  const results = queryDataSource(workspacePath, 'youtube-views', options)
  return results.map(r => ({ month: r.month, views: r.value }))
}

export function getGooglePaidImpressionsByMonth(workspacePath, options = {}) {
  const config = loadConfig(workspacePath)
  const source = config?.conversionSources?.find(s => s.id === 'google-paid-impressions')
  if (!source) return []

  const dbPath = path.join(workspacePath, source.dataSource)
  const db = new Database(dbPath, { readonly: true })

  const query = `
    SELECT
      strftime('%Y-%m', [${source.dateField}]) as month,
      SUM([Impr]) as impressions
    FROM ${source.table}
    WHERE [${source.dateField}] IS NOT NULL
      AND [${source.dateField}] >= ?
      AND [${source.dateField}] <= ?
    GROUP BY month
    ORDER BY month
  `

  const { startDate = '2024-01-01', endDate = '2025-12-31' } = options
  const results = db.prepare(query).all(startDate, endDate)
  db.close()

  return results
}

export function getFacebookPaidImpressionsByMonth(workspacePath, options = {}) {
  const config = loadConfig(workspacePath)
  const source = config?.conversionSources?.find(s => s.id === 'facebook-paid-impressions')
  if (!source) return []

  const dbPath = path.join(workspacePath, source.dataSource)
  const db = new Database(dbPath, { readonly: true })

  const query = `
    SELECT
      strftime('%Y-%m', [${source.dateField}]) as month,
      SUM([Impressions]) as impressions
    FROM ${source.table}
    WHERE [${source.dateField}] IS NOT NULL
      AND [${source.dateField}] >= ?
      AND [${source.dateField}] <= ?
    GROUP BY month
    ORDER BY month
  `

  const { startDate = '2024-01-01', endDate = '2025-12-31' } = options
  const results = db.prepare(query).all(startDate, endDate)
  db.close()

  return results
}

export function getBingPaidImpressionsByMonth(workspacePath, options = {}) {
  const config = loadConfig(workspacePath)
  const source = config?.conversionSources?.find(s => s.id === 'bing-paid-impressions')
  if (!source) return []

  const dbPath = path.join(workspacePath, source.dataSource)
  const db = new Database(dbPath, { readonly: true })

  const query = `
    SELECT
      strftime('%Y-%m', [${source.dateField}]) as month,
      SUM([Impressions]) as impressions
    FROM ${source.table}
    WHERE [${source.dateField}] IS NOT NULL
      AND [${source.dateField}] >= ?
      AND [${source.dateField}] <= ?
    GROUP BY month
    ORDER BY month
  `

  const { startDate = '2024-01-01', endDate = '2025-12-31' } = options
  const results = db.prepare(query).all(startDate, endDate)
  db.close()

  return results
}

export function getGoogleAdsSpendByMonth(workspacePath, options = {}) {
  return queryDataSource(workspacePath, 'google-ads', { ...options, aggregation: 'sum' })
}

export function getFacebookAdsSpendByMonth(workspacePath, options = {}) {
  return queryDataSource(workspacePath, 'facebook-ads', { ...options, aggregation: 'sum' })
}

export function getBingAdsSpendByMonth(workspacePath, options = {}) {
  return queryDataSource(workspacePath, 'bing-ads', { ...options, aggregation: 'sum' })
}

// Utility functions (no changes needed - already generic)

export function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = (n * sumXY) - (sumX * sumY)
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  return denominator === 0 ? 0 : numerator / denominator
}

export function shiftArray(arr, lag) {
  if (lag === 0) return arr
  const shifted = new Array(lag).fill(0)
  shifted.push(...arr.slice(0, -lag))
  return shifted
}

export function getCorrelationAtLag(spend, outcomes, lagMonths) {
  const shiftedOutcomes = shiftArray(outcomes, lagMonths)
  return calculateCorrelation(spend, shiftedOutcomes)
}

export function findOptimalLag(spend, outcomes, maxLag = 12) {
  let bestLag = 0
  let bestCorrelation = -Infinity

  for (let lag = 0; lag <= maxLag; lag++) {
    const corr = getCorrelationAtLag(spend, outcomes, lag)
    if (corr > bestCorrelation) {
      bestCorrelation = corr
      bestLag = lag
    }
  }

  return { lag: bestLag, correlation: bestCorrelation }
}
