# Issue #005: Instance-Specific AI Functions for Interactive Claude Assistance

**Status:** 🔴 Open
**Priority:** Medium
**Created:** 2025-10-21
**Reporter:** User

## Problem

Currently, Claude Code has access to generic tools (MCP connectors, bash, file operations), but lacks instance-specific intelligence about Renu's business operations. This means:

- Repetitive questions require full context each time
- No shortcuts for common Renu-specific analysis tasks
- Claude can't proactively offer relevant insights based on Renu data patterns
- Business logic is scattered across one-off scripts rather than reusable functions

## Vision

Create a system where each business instance (Renu, GoSkills) can define custom AI functions that make Claude more interactive and helpful for that specific business context.

### Example Use Cases

**Renu-Specific Functions:**
- "What's blocking deals this week?" → Automated pipeline analysis
- "Compare channel performance" → Lead source attribution report
- "Revenue forecast" → QuickBooks + RoofMaxx trend analysis
- "Pipeline health check" → Deal velocity and conversion metrics

### Potential Approaches

1. **Custom MCP Tools** (`connectors/renu-tools/`)
   - Extends MCP server with instance-specific tools
   - Auto-available to Claude via MCP integration
   - Example: `analyze_pipeline`, `forecast_revenue`, `compare_channels`

2. **Slash Commands** (`.claude/commands/`)
   - Quick shortcuts: `/sync-renu`, `/revenue-report`, `/pipeline-status`
   - Instance-specific to each workspace

3. **Helper Utilities** (`tools/renu/`)
   - Reusable business logic libraries
   - Revenue calculations, channel attribution, deal scoring
   - Called by other scripts/visualizations

4. **Interactive Analysis Framework**
   - Natural language triggers → automatic data analysis
   - Combines multiple data sources intelligently
   - Learns common query patterns

## Benefits

- **Faster insights**: One command vs multi-step manual analysis
- **Consistency**: Standardized business logic across analyses
- **Proactive**: Claude can offer relevant insights without being asked
- **Scalable**: Each instance customizes for their needs

## Proposed Solution

Create a framework-level pattern for instance-specific AI tools:

```
instances/renu/
├── tools/                    # Renu-specific utilities
│   ├── pipeline-analysis.js
│   ├── revenue-forecast.js
│   └── channel-attribution.js
├── mcp-tools/               # Renu MCP extensions
│   ├── index.js            # Tool registry
│   └── tools/
│       ├── analyze-pipeline.js
│       └── forecast-revenue.js
└── .claude/commands/        # Renu slash commands
    ├── sync-renu.md
    └── pipeline-status.md
```

## Files Involved

- `tools/instance-tools-loader.js` (new - dynamic tool loading)
- `connectors/mcp-server.js` (extend to load instance tools)
- `CLAUDE.md` (document instance tool pattern)
- Instance directories: `renu/tools/`, `goskills/tools/`

## Next Steps

- [ ] Design instance tools architecture
- [ ] Identify top 5-10 Renu-specific functions to implement
- [ ] Create proof-of-concept with one interactive function
- [ ] Document pattern for future instances
- [ ] Test with real Renu workflow

## Notes

This will make Claude significantly more useful for day-to-day business operations by encoding domain knowledge into reusable, interactive functions.
