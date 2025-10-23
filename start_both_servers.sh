#!/usr/bin/env bash
set -m

echo "Starting Python FastAPI server on port 8000..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info &
PYTHON_PID=$!

sleep 3

if ps -p $PYTHON_PID > /dev/null; then
   echo "✓ Python server started successfully (PID: $PYTHON_PID)"
else
   echo "✗ Python server failed to start"
   exit 1
fi

echo "Starting Node.js Express server on port 5000..."
NODE_ENV=development tsx server/index.ts
