#!/bin/bash
# Install git hooks for LocalBase

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "Installing git hooks..."

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/bash
# Pre-commit hook: Run security tests before allowing commit

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running security tests...${NC}"

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Server not running. Starting temporarily for tests...${NC}"

    # Start server in background
    npm start > /dev/null 2>&1 &
    SERVER_PID=$!

    # Wait for server to be ready
    for i in {1..10}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    STARTED_SERVER=true
else
    STARTED_SERVER=false
fi

# Run tests
npm test 2>&1

TEST_RESULT=$?

# Stop server if we started it
if [ "$STARTED_SERVER" = true ]; then
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
fi

if [ $TEST_RESULT -ne 0 ]; then
    echo -e "${RED}Security tests failed. Commit aborted.${NC}"
    echo -e "${YELLOW}Fix the failing tests before committing.${NC}"
    exit 1
fi

echo -e "${GREEN}Security tests passed.${NC}"
exit 0
HOOK

chmod +x "$HOOKS_DIR/pre-commit"

echo "Pre-commit hook installed successfully."
echo "Tests will run automatically before each commit."
