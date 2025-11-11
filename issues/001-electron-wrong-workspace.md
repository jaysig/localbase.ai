# Issue #001: Electron App Loading from Framework Directory

**Status:** 🟢 Resolved
**Priority:** High
**Created:** 2025-10-20
**Resolved:** 2025-10-20
**Reporter:** Other Claude instance
**Fixed By:** Commit 03cb168

## Problem

The Electron app is loading from the framework directory (`/Users/ryanriggin/Work/localbase.ai/`) instead of the instance directory (`/Users/ryanriggin/Work/goskills/`).

## Evidence

From screenshot at 16:46:26:
```
The issue is that your Electron app is running from the localbase.ai
framework directory in /Users/ryanriggin/Work/localbase.ai/electron-app.
That installation needs to be in the goskills directory above.
```

## Root Cause

The Electron app saves the workspace path in:
```
~/Library/Application Support/LocalBase/workspace-config.json
```

When the workspace is set to the framework directory, all subsequent launches load from there instead of the current instance.

## Impact

- Running from framework means:
  - Loading framework's env.local (wrong credentials)
  - Reading framework's data/ directory (wrong databases)
  - Writing visualizations to framework (wrong workspace tagging)
  - Confusing user experience (showing wrong connectors/data)

## Solution

Need to fix workspace detection to:
1. Default to the directory where Electron app is launched from
2. Validate saved workspace path on startup
3. Show clear workspace selector on first launch
4. Warn if saved workspace != current directory

## Files Involved

- `electron-app/electron/main.js` (lines 28-40, 99-107)
- `electron-app/electron/preload.js` (workspace config handlers)
- `electron-app/src/components/Setup.jsx` (workspace setup UI)

## Resolution

Fixed in commit 03cb168:

1. ✅ Renamed `projectRoot` → `instanceRoot` for clarity
2. ✅ Always default to instance directory (where electron-app is installed)
3. ✅ Validate saved config on startup
4. ✅ Auto-reset to instance root if saved config points elsewhere
5. ✅ Added warning logs when config differs from instance

**Changes:**
- `electron-app/electron/main.js`:
  - Lines 28-35: Detect instance root and log it
  - Lines 40-42: Default to instance root with clear comment
  - Lines 107-130: Validate saved config and auto-correct if wrong

**Testing:**
- Launch from GoSkills instance → loads GoSkills workspace ✓
- Launch from Renu instance → loads Renu workspace ✓
- Stale config auto-corrects on next launch ✓
