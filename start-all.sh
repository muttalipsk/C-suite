
#!/bin/bash

# Start Python FastAPI server in background
echo "Starting Python FastAPI server on port 8000..."
python3 main.py &
PYTHON_PID=$!

# Wait a moment for Python server to start
sleep 3

# Start Node.js server
echo "Starting Node.js server on port 5000..."
npm run dev

# Cleanup on exit
trap "kill $PYTHON_PID" EXIT
