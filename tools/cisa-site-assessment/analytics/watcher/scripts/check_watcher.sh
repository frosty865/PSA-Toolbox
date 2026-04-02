#!/bin/bash
# Health check script for Pipeline Watcher
# Returns 0 if watcher is running, 1 if not
# Can be used with cron or monitoring systems

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER_DIR="$(dirname "$SCRIPT_DIR")"
PIDFILE="$WATCHER_DIR/watcher.pid"

if [ ! -f "$PIDFILE" ]; then
    echo "ERROR: Watcher PID file not found"
    exit 1
fi

PID=$(cat "$PIDFILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "ERROR: Watcher process not running (stale PID: $PID)"
    exit 1
fi

# Check if process is actually the watcher
if ! ps -p "$PID" -o cmd= | grep -q "pipeline_watcher.py"; then
    echo "ERROR: PID $PID is not the watcher process"
    exit 1
fi

echo "OK: Watcher is running (PID: $PID)"
exit 0

