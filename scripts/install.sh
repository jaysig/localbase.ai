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
DEFAULT_DIR="$HOME/localbase"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}         ${BOLD}LocalBase Installer${NC}              ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Check for existing LocalBase installation in common locations
EXISTING_INSTALL=""
for dir in "$HOME/localbase" "$HOME/Work/localbase.ai" "$HOME/Work/localbase" "$PWD/localbase.ai" "$PWD/localbase"; do
    if [ -f "$dir/package.json" ] && grep -q '"name": "localbase"' "$dir/package.json" 2>/dev/null; then
        EXISTING_INSTALL="$dir"
        break
    fi
done

if [ -n "$EXISTING_INSTALL" ]; then
    echo -e "${GREEN}Found existing LocalBase installation at $EXISTING_INSTALL${NC}"
    echo ""
    read -p "Start LocalBase to create a new workspace? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "Starting LocalBase..."
        cd "$EXISTING_INSTALL"

        # Start the server
        npm run dev &
        sleep 3

        # Open browser directly to create workspace
        if command -v open &> /dev/null; then
            open "http://localhost:5173?action=create-workspace"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:5173?action=create-workspace"
        fi

        echo ""
        echo -e "${GREEN}LocalBase is running!${NC}"
        echo ""
        echo -e "  Enter a name for your new workspace in the browser."
        echo ""
        exit 0
    fi
    echo ""
fi

# Prompt for install directory
echo -e "${BOLD}Where would you like to install LocalBase?${NC}"
echo -e "  Default: ${GREEN}$DEFAULT_DIR${NC}"
echo ""
read -p "Install directory (press Enter for default): " CUSTOM_DIR

if [ -z "$CUSTOM_DIR" ]; then
    INSTALL_DIR="$DEFAULT_DIR"
else
    # Expand ~ to $HOME
    INSTALL_DIR="${CUSTOM_DIR/#\~/$HOME}"
fi

echo ""
echo -e "Installing to: ${GREEN}$INSTALL_DIR${NC}"
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
    # Check if it's a LocalBase installation
    if [ -f "$INSTALL_DIR/package.json" ] && grep -q "localbase" "$INSTALL_DIR/package.json" 2>/dev/null; then
        echo -e "${GREEN}LocalBase is already installed at $INSTALL_DIR${NC}"
        echo ""
        echo -e "Starting LocalBase so you can create a new workspace..."
        cd "$INSTALL_DIR"

        # Start the server and open browser
        npm run dev &
        sleep 3

        # Open browser directly to create workspace
        if command -v open &> /dev/null; then
            open "http://localhost:5173?action=create-workspace"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:5173?action=create-workspace"
        fi

        echo ""
        echo -e "${GREEN}LocalBase is running!${NC}"
        echo ""
        echo -e "  Enter a name for your new workspace in the browser."
        echo ""
        exit 0
    else
        echo -e "${YELLOW}Directory $INSTALL_DIR already exists but is not a LocalBase installation${NC}"
        read -p "Install LocalBase here anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted"
            exit 0
        fi
        # Continue with clone into existing directory
        echo -e "${GREEN}Cloning LocalBase...${NC}"
        git clone --depth 1 "$REPO" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
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
