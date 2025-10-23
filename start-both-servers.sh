#!/bin/bash

# Start Both Node.js and Python Servers
# This script runs the Node.js Express server and Python FastAPI server concurrently

echo "🚀 Starting AI Leaders C-Suite Boardroom Services..."

# Start Python FastAPI server in background (port 8000)
echo "📦 Starting Python VectorDB API on port 8000..."
python main.py &
PYTHON_PID=$!

# Wait a moment for Python server to start
sleep 3

# Start Node.js Express server (port 5000)
echo "🌐 Starting Node.js Express server on port 5000..."
npm run dev &
NODE_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $PYTHON_PID 2>/dev/null
    kill $NODE_PID 2>/dev/null
    exit
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
