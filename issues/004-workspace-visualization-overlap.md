# Issue #004: Workspace Visualization Overlap

**Status:** 🟢 Resolved
**Priority:** High
**Created:** 2025-10-20
**Resolved:** 2025-10-20
**Reporter:** User

## Problem

Visualizations from different workspaces (GoSkills, Renu) were appearing in the wrong instances. When opening the GoSkills electron app, there was a risk of seeing Renu visualizations or vice versa.

## Evidence

- User reported: "we were seeing workspace overlap"
- API handler `api:getVisualizations` was returning ALL visualizations from the registry without filtering by workspace
- Each visualization has a `workspace` field (added by VizRegistry), but it wasn't being used for filtering

## Root Cause

**Location:** `electron-app/electron/main.js:489-519` (before fix)

The API handler was reading the visualization registry and returning all visualizations:

```javascript
const registry = JSON.parse(data)
return {
  success: true,
  visualizations: registry.visualizations || [],
  total: registry.visualizations?.length || 0
}
```

Even though the `VizRegistry` class has a `getByWorkspace()` method, the Electron API wasn't using it.

## Impact

- Cross-workspace contamination
- User confusion (seeing wrong data)
- Potential data privacy issues (business separation)
- Breaks the multi-instance model

## Solution

**Implemented:** 2025-10-20 (Commit `a679d48`)

Added workspace detection and filtering to the API handler:

1. **Detect workspace from path:**
   ```javascript
   const workspace = currentProjectRoot.includes('/goskills') ? 'goskills'
     : currentProjectRoot.includes('/renu') ? 'renu'
     : currentProjectRoot.includes('/localbase.ai') ? 'framework'
     : 'unknown'
   ```

2. **Filter visualizations by workspace:**
   ```javascript
   const allViz = registry.visualizations || []
   const workspaceViz = allViz.filter(v => v.workspace === workspace)
   ```

3. **Add warning logs for debugging:**
   - Warns about visualizations from wrong workspace
   - Warns about visualizations without workspace metadata
   - Logs filter stats: `Returning X visualizations for workspace "Y" (filtered from Z total)`

## Files Involved

- `electron-app/electron/main.js` - Added workspace filtering to `api:getVisualizations` handler
- `tools/viz/registry.js` - Already had `detectWorkspace()` and `getByWorkspace()` methods

## Testing

- ✅ GoSkills instance shows only GoSkills visualizations (39)
- ✅ Framework changes committed and synced to instance
- ✅ Console logs show workspace detection and filtering

## Related Issues

- Issue #001: Electron App Loading from Framework Directory (workspace detection)
- Future: Issue #003 will add tests to prevent this regression

## Next Steps

- [x] Commit fix to framework
- [x] Sync to GoSkills instance
- [x] Document in DEVOPS-WORKFLOW.md
- [ ] Add test coverage (Issue #003)
