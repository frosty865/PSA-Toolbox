#!/bin/bash
# Cron-based watcher monitor
# Add to crontab: */5 * * * * /path/to/cron_watcher.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER_DIR="$(dirname "$SCRIPT_DIR")"
CHECK_SCRIPT="$WATCHER_DIR/scripts/check_watcher.sh"
START_SCRIPT="$WATCHER_DIR/scripts/start_watcher.sh"

# Check if watcher is running
if ! "$CHECK_SCRIPT" > /dev/null 2>&1; then
    echo "$(date): Watcher not running, restarting..." >> "$WATCHER_DIR/watcher_monitor.log"
    "$START_SCRIPT" >> "$WATCHER_DIR/watcher_monitor.log" 2>&1
fi

