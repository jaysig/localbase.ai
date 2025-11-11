# Issue #003: Add Test Suite for Framework and Instances

**Status:** 🔴 Open
**Priority:** High
**Created:** 2025-10-20
**Reporter:** User

## Problem

We're finding bugs reactively rather than proactively:
- Issue #001: Wrong workspace loading (caught by user)
- Issue #002: Massive console errors (caught by user)
- Missing dependencies after sync (caught by user)

These should be caught by automated tests before deployment.

## What We Need

### Unit Tests

1. **Workspace Detection**
   - `detectWorkspace()` returns correct workspace from path
   - `instanceRoot` is set correctly in dev vs production
   - Saved config validation works

2. **Visualization Registry**
   - `getVisualizations()` sorts by creation date (newest first)
   - Workspace filtering returns only matching visualizations
   - Empty registry returns empty array (not error)

3. **API Handlers**
   - `api:getVisualizations` returns sorted array
   - `api:getConnectors` reads from correct workspace
   - `api:getTools` scans correct directory

### Integration Tests

1. **Electron App Startup**
   - App starts without errors
   - Console has zero errors on load
   - Correct workspace is detected and loaded

2. **Framework Sync**
   - `sync-framework.sh` copies correct files
   - Excludes instance-specific files (data/, env.local, visualizations.json)
   - Preserves instance visualizations

3. **Bootstrap Script**
   - Creates valid instance directory structure
   - Initializes git repository
   - Creates proper .gitignore
   - npm install runs successfully

### End-to-End Tests

1. **Full Workflow**
   - Bootstrap new instance → sync framework → npm install → npm start
   - Create visualization → appears in registry → loads in UI
   - Switch workspaces → correct data loads

## Test Framework Options

**For Node.js/Framework:**
- Jest (popular, batteries included)
- Vitest (fast, Vite-native)
- Mocha + Chai (lightweight)

**For Electron:**
- Spectron (official Electron testing)
- Playwright (modern, cross-platform)
- Puppeteer (headless Chrome)

**For React Components:**
- React Testing Library (recommended)
- Vitest + Testing Library

## Proposed Structure

```
tests/
├── unit/
│   ├── workspace-detection.test.js
│   ├── viz-registry.test.js
│   └── api-handlers.test.js
├── integration/
│   ├── electron-startup.test.js
│   ├── framework-sync.test.js
│   └── bootstrap.test.js
├── e2e/
│   ├── full-workflow.test.js
│   └── workspace-switching.test.js
└── fixtures/
    ├── test-instance/
    └── mock-visualizations.json
```

## Success Criteria

- [ ] All current bugs would be caught by tests
- [ ] CI/CD runs tests on every commit
- [ ] Test coverage > 70% for critical paths
- [ ] Tests run in < 30 seconds (unit + integration)
- [ ] E2E tests run in < 2 minutes

## Files Involved

- `package.json` (add test scripts and dependencies)
- `tests/` (new directory)
- `.github/workflows/test.yml` (CI/CD)
- `electron-app/package.json` (Electron test config)

## Next Steps

1. [ ] Choose test framework (recommend Vitest + Playwright)
2. [ ] Set up test infrastructure
3. [ ] Write tests for Issues #001 and #002 (regression tests)
4. [ ] Add tests for new features going forward
5. [ ] Set up GitHub Actions for CI

## Notes

This is blocking further development. We need confidence that changes don't break existing functionality.
