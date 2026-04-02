#!/bin/bash
# Restart script for Pipeline Watcher

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Restarting Pipeline Watcher..."
"$SCRIPT_DIR/stop_watcher.sh"
sleep 2
"$SCRIPT_DIR/start_watcher.sh"

