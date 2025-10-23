#!/bin/bash
cd /home/runner/workspace
while true; do
    echo "Starting Python server..."
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
    echo "Python server stopped. Restarting in 2 seconds..."
    sleep 2
done
