# Issue #006: Add Workspace Switching to Web App (localhost:3000)

**Status:** 🔵 Open
**Priority:** Low
**Created:** 2025-10-21
**Reporter:** Ryan

## Problem

The Express web app (localhost:3000) serves visualizations from a single workspace. To view visualizations from different instances (GoSkills, Renu, etc.), you need to stop the server and restart it from a different directory.

## Current Behavior

```bash
# Want to view GoSkills visualizations
cd ~/Work/goskills
npm start
# Visit localhost:3000 → shows GoSkills viz

# Want to view Renu visualizations
# Must stop server, change directory, restart
cd ~/Work/renu
npm start
# Visit localhost:3000 → shows Renu viz
```

## Proposed Solution

Add a workspace dropdown to the web app dashboard that:
1. Scans `~/Work` for LocalBase instances (directories with `app/assets/visualizations.json`)
2. Allows switching between workspaces without restarting the server
3. Updates API calls to read from the selected workspace's data directory
4. Persists workspace selection in browser localStorage

## Implementation Approach

**Minimal complexity option:**
- Add workspace detection endpoint: `GET /api/workspaces`
- Add workspace selection endpoint: `POST /api/workspace/select`
- Add dropdown to dashboard header
- Update existing API endpoints to use selected workspace path

**Alternative (more complex):**
- Multi-workspace support serving multiple instances simultaneously
- URL-based routing: `/workspace/goskills`, `/workspace/renu`

## Benefits

1. **Convenience** - Switch between workspaces without restarting server
2. **Compare workspaces** - View visualizations side-by-side from different projects
3. **Consistent UX** - Matches Electron app's workspace concept
4. **Single server** - One `npm start` serves all instances

## Considerations

- Web app is currently lightweight and simple
- Electron app already has full workspace switching
- YAGNI principle - may not be needed if web app is rarely used
- Framework vs instance repos - should this live in framework or instances?

## Files Involved

- `tools/server/app-server.js` - Express server
- `app/index.html` - Dashboard UI
- New: workspace detection utilities

## Notes

This is a nice-to-have enhancement, not critical. The current workflow (restart server from different directory) works fine for now. Consider implementing only if web app usage increases.
