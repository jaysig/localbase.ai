#!/bin/bash

# Start LocalBase Insights Server
# Unified Node.js server with static files + API endpoints

echo "🚀 Starting LocalBase Server"
echo
echo "============================================================"

# Kill any existing processes on port 3000
echo "🧹 Clearing port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait a moment for processes to clean up
sleep 1

# Start the unified Node.js server
echo "🌐 Starting Node.js server on port 3000..."
node tools/server/app-server.js
