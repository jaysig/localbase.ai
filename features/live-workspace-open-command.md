# Feature: Live Workspace Open Command

## Overview
Update the `open` command behavior to load visualizations in Live Workspace instead of opening them in the system default browser.

## Current Behavior
When Claude uses the `open` command (e.g., `open app/viz/some-chart.html`), it opens the file in the system's default browser as a separate window/tab.

## Desired Behavior
When Claude uses `open` on a visualization file, it should:
1. Update `.localbase/context.json` to set the current visualization
2. Load the file in the Live Workspace preview pane
3. Keep the user in the LocalBase environment

## Implementation Details

### Context File Format
The `.localbase/context.json` file should be updated with:
```json
{
  "currentViz": {
    "filename": "chart-name.html",
    "title": "Chart Title",
    "path": "app/viz/chart-name.html"
  },
  "workspace": "Live Workspace",
  "mode": "visualization"
}
```

### Detection Logic
- Detect when `open` is called with a file path
- Check if the file is in `app/viz/` or matches `*.html` pattern
- If yes, update context.json instead of using system open command
- If no (non-viz file), fall back to system open behavior

### Title Extraction
Extract the title from the HTML file's `<title>` tag if available, or use the filename as fallback.

### Bash Tool Integration
The Bash tool currently allows `open` commands. This behavior should be intercepted or wrapped to check for visualization files first.

## Benefits
- Seamless workflow - visualizations stay in the LocalBase environment
- No context switching to external browser
- Live Workspace auto-refreshes can still detect new visualizations
- Better integration with Claude's workflow when creating/updating charts

## Example Usage
```bash
# Before (opens in system browser)
open app/viz/revenue-dashboard.html

# After (loads in Live Workspace)
open app/viz/revenue-dashboard.html
# -> Updates .localbase/context.json
# -> Live Workspace preview shows the chart
```

## Testing
1. Create a test visualization in `app/viz/`
2. Run `open app/viz/test-chart.html`
3. Verify `.localbase/context.json` is updated correctly
4. Verify Live Workspace preview displays the chart
5. Test with non-viz files to ensure fallback to system open works

## Related Files
- Bash tool wrapper (wherever `open` command is executed)
- `.localbase/context.json` (instance-specific, not in framework)
- Live Workspace preview component (should already handle context.json updates)

## Priority
Medium - Quality of life improvement for Claude's visualization workflow
