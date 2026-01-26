#!/bin/bash
#
# LocalBase Installer
# curl -fsSL https://localbase.ai/install | bash
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Config
REPO="https://github.com/localbase-ai/localbase.ai.git"
INSTALL_DIR="$HOME/localbase"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}         ${BOLD}LocalBase Installer${NC}              ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed${NC}"
    echo "Please install git and try again"
    exit 1
fi

# Check for node
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js (v18+) and try again"
    echo "Visit: https://nodejs.org"
    exit 1
fi

# Check node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js v18+ recommended (you have v$NODE_VERSION)${NC}"
fi

# Check if directory exists
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory $INSTALL_DIR already exists${NC}"
    read -p "Update existing installation? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Updating..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        echo "Aborted"
        exit 0
    fi
else
    # Clone repo
    echo -e "${GREEN}Cloning LocalBase...${NC}"
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo ""
echo -e "${GREEN}Installing dependencies...${NC}"
npm install --silent

# Create env.local if it doesn't exist
if [ ! -f "env.local" ]; then
    echo "# LocalBase Environment" > env.local
    echo "# Add your API keys here" >> env.local
    echo "# ANTHROPIC_API_KEY=sk-..." >> env.local
fi

# Done
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}         ${BOLD}Installation Complete!${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Location:${NC} $INSTALL_DIR"
echo ""
echo -e "  ${BOLD}To start:${NC}"
echo -e "    cd $INSTALL_DIR"
echo -e "    npm run dev"
echo ""
echo -e "  ${BOLD}Then open:${NC} http://localhost:5173"
echo ""
echo -e "  ${BOLD}Docs:${NC} https://github.com/localbase-ai/localbase.ai#readme"
echo ""
