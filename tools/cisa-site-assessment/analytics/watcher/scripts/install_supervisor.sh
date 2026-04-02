#!/bin/bash
# Install Pipeline Watcher with Supervisor

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$WATCHER_DIR/../.." && pwd)"
SUPERVISOR_CONF="$WATCHER_DIR/supervisor/pipeline-watcher.conf"
SUPERVISOR_DIR="/etc/supervisor/conf.d"

# Check if supervisor is installed
if ! command -v supervisorctl &> /dev/null; then
    echo "Error: Supervisor is not installed"
    echo "Install with: sudo apt-get install supervisor"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    exit 1
fi

# Create log directory
mkdir -p /var/log/pipeline-watcher
chown psa:psa /var/log/pipeline-watcher 2>/dev/null || true

# Update config file with actual paths
sed -i "s|/opt/psa|$REPO_ROOT|g" "$SUPERVISOR_CONF"

# Copy config file
echo "Installing supervisor configuration..."
cp "$SUPERVISOR_CONF" "$SUPERVISOR_DIR/pipeline-watcher.conf"

# Reload supervisor
supervisorctl reread
supervisorctl update

echo "Supervisor configuration installed"
echo ""
echo "To start the watcher:"
echo "  sudo supervisorctl start pipeline-watcher"
echo ""
echo "To check status:"
echo "  sudo supervisorctl status pipeline-watcher"
echo ""
echo "To view logs:"
echo "  tail -f /var/log/pipeline-watcher/stdout.log"

