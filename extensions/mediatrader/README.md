# MediaTrader Setup Guide

MediaTrader is a config-driven marketing attribution tool that calculates correlations between ad spend (channels) and business outcomes (conversion sources).

## Overview

MediaTrader uses a single `config.json` file to define:
- **Channels**: Ad spend data sources (Google Ads, Facebook Ads, etc.)
- **Conversion Sources**: Business outcomes to correlate (deals, clicks, impressions, etc.)

The tool automatically calculates time-lagged correlations to find which channels drive which outcomes.

## Quick Start

1. Create `tools/mediatrader/` directory in your instance
2. Create `config.json` with your data sources
3. Open MediaTrader tool in LocalBase app
4. Select channel and conversion source to analyze

## Data Source Inspection

Before configuring MediaTrader, you need to understand your data sources.

### SQLite Databases

**Inspect table structure:**
```bash
sqlite3 data/your-database.sqlite
.schema table_name
```

**Check date field format:**
```sql
SELECT date_field FROM table_name LIMIT 5;
```

**Identify columns:**
```sql
.headers on
SELECT * FROM table_name LIMIT 3;
```

**Key questions:**
1. What is the date field name? (e.g., `Day`, `Date`, `create_date`, `month`)
2. What format is it? DATE/DATETIME or TEXT like 'YYYY-MM'?
3. For ad spend: What is the cost field name? (e.g., `Cost`, `Spend`, `Amount spent`)
4. For metrics: What is the value field name? (e.g., `clicks`, `impressions`, `views`)

### CSV Files

**Inspect structure:**
```bash
head -5 data/your-file.csv
```

CSV files should have:
- Header row with column names
- Month column in 'YYYY-MM' format
- Value column with numeric data

Example:
```csv
month,clicks
2024-01,45234
2024-02,52108
```

## Date Format Determination

**Critical decision**: Does your date field need `dateFormat: "month"`?

### Use `dateFormat: "month"` when:
- Field is TEXT type storing pre-formatted months like 'YYYY-MM'
- Common in aggregated/monthly data exports
- Example: `month TEXT` storing '2024-03'

**Test:**
```sql
SELECT typeof(date_field) FROM table_name LIMIT 1;
-- Returns "text" → use dateFormat: "month"
```

### Do NOT use `dateFormat: "month"` when:
- Field is DATE or DATETIME type
- Contains full dates like '2024-03-15 10:30:00'
- Needs `strftime()` to extract month

**Test:**
```sql
SELECT strftime('%Y-%m', date_field) as month FROM table_name LIMIT 5;
-- If this works → do NOT use dateFormat: "month"
-- If this returns NULL → use dateFormat: "month"
```

## Config Structure

### Minimal Example

```json
{
  "name": "MediaTrader",
  "description": "Marketing attribution analysis",
  "version": "1.0.0",
  "channels": [
    {
      "id": "google-ads",
      "name": "Google Ads",
      "type": "search",
      "dataSource": "data/google-ads/google-ads.sqlite",
      "table": "ads_data",
      "currency": "USD",
      "dateField": "Day",
      "costField": "Cost",
      "enabled": true
    }
  ],
  "conversionSources": [
    {
      "id": "deals",
      "name": "Deals Created",
      "type": "crm",
      "dataSource": "data/deals/deals.sqlite",
      "table": "deals",
      "dateField": "create_date",
      "enabled": true
    }
  ],
  "settings": {
    "defaultTimeWindow": 90,
    "defaultAttributionWindow": 14,
    "currency": "USD"
  }
}
```

### Channel Configuration

**Required fields:**
- `id`: Unique identifier (lowercase, hyphens)
- `name`: Display name
- `dataSource`: Path to SQLite DB (from instance root)
- `table`: Table name in database
- `dateField`: Column name for dates
- `costField`: Column name for spend amount
- `enabled`: true/false

**Optional fields:**
- `type`: Categorization (search, social, display, etc.)
- `currency`: Currency code (USD, EUR, etc.)
- `dateFormat`: "month" if date field is pre-formatted TEXT

**Example with optional fields:**
```json
{
  "id": "social-ads",
  "name": "Social Media Ads",
  "type": "social",
  "dataSource": "data/social-ads/ads.sqlite",
  "table": "ad_campaigns",
  "currency": "USD",
  "dateField": "campaign_date",
  "costField": "total_spend",
  "enabled": true
}
```

### Conversion Source Configuration

**For COUNT aggregation (count of records):**
```json
{
  "id": "deals",
  "name": "Deals Created",
  "type": "crm",
  "dataSource": "data/deals.sqlite",
  "table": "deals",
  "dateField": "create_date",
  "enabled": true
}
```

**For SUM aggregation (sum a value field):**
```json
{
  "id": "organic-clicks",
  "name": "Organic Clicks",
  "type": "analytics",
  "dataSource": "data/organic-search.sqlite",
  "table": "search_data",
  "dateField": "month",
  "dateFormat": "month",
  "valueField": "clicks",
  "enabled": true
}
```

**Required fields:**
- `id`: Unique identifier
- `name`: Display name
- `dataSource`: Path to SQLite DB or CSV file
- `enabled`: true/false

**For SQLite sources:**
- `table`: Table name
- `dateField`: Column name for dates
- `valueField`: (optional) Column to SUM instead of COUNT(*)
- `dateFormat`: (optional) "month" for pre-formatted TEXT dates

**For CSV sources:**
- No table/dateField needed
- CSV must have `month,value` columns

## Field Name Edge Cases

**Spaces in field names:**
Field names with spaces (like `Amount spent`) work fine - the query framework automatically wraps them in square brackets:

```javascript
// Config
"costField": "Amount spent"

// Generated SQL
SUM([Amount spent]) as spend  // ✓ Works correctly
```

**Case sensitivity:**
SQLite is case-insensitive for column names, but match the exact case from your schema for clarity.

## Testing Your Configuration

### 1. Validate JSON Syntax
```bash
cat tools/mediatrader/config.json | python -m json.tool
```

### 2. Test Channel Query
```bash
sqlite3 data/your-ads.sqlite
```

```sql
-- Test spend aggregation by month
SELECT
  strftime('%Y-%m', [date_field]) as month,
  SUM([cost_field]) as spend
FROM your_table
WHERE [date_field] IS NOT NULL
  AND [date_field] >= '2024-01-01'
  AND [date_field] <= '2024-12-31'
GROUP BY month
ORDER BY month;
```

### 3. Test Conversion Source Query

**For COUNT aggregation:**
```sql
SELECT
  strftime('%Y-%m', [date_field]) as month,
  COUNT(*) as count
FROM your_table
WHERE [date_field] IS NOT NULL
  AND [date_field] >= '2024-01-01'
  AND [date_field] <= '2024-12-31'
GROUP BY month
ORDER BY month;
```

**For SUM with valueField:**
```sql
SELECT
  [month] as month,  -- Already formatted text
  SUM([value_field]) as value
FROM your_table
WHERE [month] IS NOT NULL
  AND [month] >= '2024-01-01'
  AND [month] <= '2024-12-31'
GROUP BY month
ORDER BY month;
```

### 4. Verify in MediaTrader UI

1. Restart LocalBase app (config loaded at startup)
2. Open MediaTrader tool
3. Check input options:
   - Ad Spend dropdown should show all enabled channels
   - Conversion dropdown should show all enabled conversion sources
4. Select a channel + conversion source
5. Chart should show monthly data (not zeros)

## Common Errors

### Error: "near 'field': syntax error"

**Cause**: Field name has special characters or spaces

**Fix**: Field names are automatically wrapped in brackets - no action needed. If error persists, check field name spelling.

### Error: Correlation shows 0.00

**Possible causes:**

1. **No overlapping date range** - Channel and conversion data don't overlap in time
   ```sql
   -- Check date ranges
   SELECT MIN(date_field), MAX(date_field) FROM channel_table;
   SELECT MIN(date_field), MAX(date_field) FROM conversion_table;
   ```

2. **Wrong dateFormat** - Using strftime() on TEXT field returns NULL
   ```sql
   -- Test this
   SELECT strftime('%Y-%m', [month]) FROM your_table LIMIT 1;
   -- If NULL → add "dateFormat": "month" to config
   ```

3. **Wrong aggregation** - Using COUNT when should use SUM
   - Add `"valueField": "column_name"` for SUM aggregation

4. **Data source disabled** - Check `"enabled": true` in config

### Error: Data source not showing in dropdown

**Causes:**
1. `"enabled": false` in config
2. Config syntax error (invalid JSON)
3. App not restarted after config change

**Fix:**
1. Validate JSON syntax
2. Set `enabled: true`
3. Restart app: `pkill -9 -f "electron|vite"` then relaunch

### Error: Changes not taking effect

**Cause**: Config loaded at Electron startup, not hot-reloaded

**Fix**: Full app restart (kill + relaunch)

## Setup Checklist

- [ ] Inspect all data sources (SQLite schema, CSV structure)
- [ ] Identify date fields and formats
- [ ] Identify cost fields (for channels)
- [ ] Identify value fields (for conversion sources)
- [ ] Test SQL queries to verify date extraction works
- [ ] Create `tools/mediatrader/config.json`
- [ ] Add all ad spend channels with correct field mappings
- [ ] Add all conversion sources with correct field mappings
- [ ] Set `dateFormat: "month"` for pre-formatted TEXT date fields
- [ ] Set `valueField` for conversion sources that need SUM not COUNT
- [ ] Validate JSON syntax
- [ ] Restart LocalBase app
- [ ] Test each channel + conversion combination
- [ ] Verify non-zero correlations for known relationships
- [ ] Commit config.json to instance repo (NOT framework)

## Architecture Notes

**Framework vs Instance:**
- Framework (`localbase.ai`) contains the MediaTrader code
- Each instance has its own `tools/mediatrader/config.json`
- Config files are NEVER in the framework repo
- Use `sync-framework.sh` to update code from framework to instances

**When to restart app:**
- Config file changes (not hot-reloaded)
- Framework code changes (after sync)
- Database schema changes

**When NOT to restart:**
- UI component changes (Vite hot-reloads)
- Most JavaScript changes in renderer process
