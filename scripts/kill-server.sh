#!/bin/bash

echo "🔍 Checking for running servers..."

# Check common ports
PORTS=(3000 3001 3002 3003 8080)

for port in "${PORTS[@]}"; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "🚫 Killing process $PID on port $port"
        kill -9 $PID
    fi
done

# Kill any tsx processes
echo "🚫 Killing tsx processes..."
pkill -f "tsx" 2>/dev/null

# Kill any node processes related to famspace
echo "🚫 Killing famspace node processes..."
pkill -f "node.*famspace" 2>/dev/null

echo "✅ All server processes killed!"
echo "🚀 You can now start the server with npm run dev or F5 in VS Code"