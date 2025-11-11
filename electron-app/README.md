# LocalBase Electron Desktop App

Built with:
- **Electron** - Desktop app framework
- **React** - UI framework
- **Vite** - Build tool
- **shadcn/ui** - Component library with Tailwind CSS
- **ApexCharts** - Complex visualizations
- **Chart.js + chartjs-chart-venn** - Venn diagrams
- **Recharts** (via shadcn) - Themed charts

## Quick Start

**IMPORTANT:** In development mode, you must run the Express API server separately:

```bash
# Terminal 1: Start the Express API server (from project root)
cd .. && npm start

# Terminal 2: Start Electron app (from electron-app directory)
npm install
npm run electron:dev
```

**Why?** Electron uses Node v18 (MODULE_VERSION 121) while better-sqlite3 is compiled for your system's Node version. Running the Express server separately in Terminal 1 allows better-sqlite3 to use the system Node version, avoiding native module version mismatches.

**Alternative (run separately):**
```bash
npm run dev        # Start Vite dev server on port 5173
npm run electron   # Launch Electron (requires dev server running)
```

## Features

- **Sidebar Navigation** - Collapsible sidebar with nav items
- **Dark Mode** - Built-in dark theme using shadcn
- **Multiple Chart Libraries** - shadcn/Recharts, ApexCharts, Chart.js
- **Responsive Design** - Adapts to different window sizes

## Chart Libraries

### shadcn Charts (Recharts)
- Built-in Tailwind theming
- Automatic dark mode
- Responsive containers

### ApexCharts
- Drop-in for existing LocalBase charts
- Multi-line charts, dual Y-axis
- Interactive tooltips

### Chart.js + Venn
- Venn diagram support
- Set intersection visualization
