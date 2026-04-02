#!/bin/bash
# Start script for Pipeline Watcher
# Ensures watcher is running and restarts if needed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$WATCHER_DIR/../.." && pwd)"
VENV="${VENV:-$REPO_ROOT/venv}"
PYTHON="${PYTHON:-$VENV/bin/python}"
WATCHER_SCRIPT="$WATCHER_DIR/pipeline_watcher.py"
PIDFILE="$WATCHER_DIR/watcher.pid"
LOGFILE="$WATCHER_DIR/watcher.log"

# Check if watcher is already running
if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Watcher is already running (PID: $PID)"
        exit 0
    else
        echo "Stale PID file found, removing..."
        rm -f "$PIDFILE"
    fi
fi

# Ensure Python and watcher script exist
if [ ! -f "$PYTHON" ]; then
    echo "Error: Python not found at $PYTHON"
    exit 1
fi

if [ ! -f "$WATCHER_SCRIPT" ]; then
    echo "Error: Watcher script not found at $WATCHER_SCRIPT"
    exit 1
fi

# Start watcher in background
echo "Starting Pipeline Watcher..."
cd "$WATCHER_DIR"
nohup "$PYTHON" "$WATCHER_SCRIPT" >> "$LOGFILE" 2>&1 &
PID=$!

# Save PID
echo "$PID" > "$PIDFILE"

# Wait a moment and check if process is still running
sleep 2
if ps -p "$PID" > /dev/null 2>&1; then
    echo "Watcher started successfully (PID: $PID)"
    echo "Logs: $LOGFILE"
else
    echo "Error: Watcher failed to start"
    rm -f "$PIDFILE"
    exit 1
fi

