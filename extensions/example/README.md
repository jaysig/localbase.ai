# Example Extension

Template for creating LocalBase extensions.

## Structure

```
extensions/my-extension/
├── config.json      # Extension metadata and routes
├── Dashboard.jsx    # React component(s)
└── README.md        # Documentation
```

## config.json

```json
{
  "name": "My Extension",
  "description": "What it does",
  "version": "1.0.0",
  "presentation": "sidebar",
  "routes": [
    {
      "id": "main",
      "label": "Main View",
      "icon": "LayoutDashboard",
      "component": "Main.jsx"
    }
  ]
}
```

### Fields

- `name` - Display name in the UI
- `description` - Short description
- `version` - Semantic version
- `presentation` - Where to show (`sidebar`)
- `routes` - Array of navigation items
  - `id` - Unique route identifier
  - `label` - Navigation label
  - `icon` - Lucide icon name
  - `component` - JSX file to render

## Icons

Use any [Lucide icon](https://lucide.dev/icons) name:
- `LayoutDashboard`, `Users`, `DollarSign`, `Settings`, `BarChart`, etc.

## Creating an Extension

1. Copy `extensions/example` to `extensions/my-extension`
2. Edit `config.json` with your metadata
3. Create your React components
4. Restart the app to load the extension
