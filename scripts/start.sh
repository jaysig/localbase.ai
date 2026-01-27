#!/bin/bash
# LocalBase startup script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "🚀 Starting LocalBase..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Install from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js 18+ recommended (you have $(node -v))${NC}"
fi

# Install root dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --cache /tmp/npm-cache
fi

# Check if package-lock changed
if [ "package.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
    echo "📦 Updating dependencies..."
    npm install --cache /tmp/npm-cache
fi

# Install app dependencies if needed
if [ ! -d "app/node_modules" ]; then
    echo "📦 Installing app dependencies..."
    (cd app && npm install --cache /tmp/npm-cache)
fi

# Check if app package-lock changed
if [ "app/package.json" -nt "app/node_modules/.package-lock.json" ] 2>/dev/null; then
    echo "📦 Updating app dependencies..."
    (cd app && npm install --cache /tmp/npm-cache)
fi

# Check if ports are available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

if ! check_port 3000; then
    echo -e "${YELLOW}Warning: Port 3000 is in use${NC}"
    echo "Kill the process? (y/n)"
    read -r response
    if [ "$response" = "y" ]; then
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        echo "Killed process on port 3000"
    fi
fi

if ! check_port 5173; then
    echo -e "${YELLOW}Warning: Port 5173 is in use${NC}"
    echo "Kill the process? (y/n)"
    read -r response
    if [ "$response" = "y" ]; then
        lsof -ti:5173 | xargs kill -9 2>/dev/null || true
        echo "Killed process on port 5173"
    fi
fi

# Start the dev server
echo ""
echo -e "${GREEN}Starting dev server...${NC}"
echo "  API:  http://localhost:3000"
echo "  App:  http://localhost:5173"
echo ""

# Open browser after a short delay
(sleep 2 && open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null || true) &

# Start dev server (this blocks)
npm run dev
