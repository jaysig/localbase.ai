#!/bin/bash
# Run tests with server

set -e

# Kill any existing server on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start server in background
echo "Starting server..."
node tools/server/app-server.js &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..30}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "Server ready"
    break
  fi
  sleep 0.5
done

# Run tests
echo "Running tests..."
node --test test/**/*.test.js
TEST_EXIT=$?

# Stop server
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null || true

exit $TEST_EXIT
