#!/bin/bash
# Stop script for Pipeline Watcher

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER_DIR="$(dirname "$SCRIPT_DIR")"
PIDFILE="$WATCHER_DIR/watcher.pid"

if [ ! -f "$PIDFILE" ]; then
    echo "Watcher is not running (no PID file found)"
    exit 0
fi

PID=$(cat "$PIDFILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "Watcher is not running (stale PID file)"
    rm -f "$PIDFILE"
    exit 0
fi

echo "Stopping Pipeline Watcher (PID: $PID)..."
kill "$PID"

# Wait for process to stop
for i in {1..30}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "Watcher stopped successfully"
        rm -f "$PIDFILE"
        exit 0
    fi
    sleep 1
done

# Force kill if still running
if ps -p "$PID" > /dev/null 2>&1; then
    echo "Force killing watcher..."
    kill -9 "$PID"
    rm -f "$PIDFILE"
    echo "Watcher force stopped"
fi

