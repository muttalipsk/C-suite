#!/usr/bin/env bash
set -e
cd /home/runner/workspace
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
