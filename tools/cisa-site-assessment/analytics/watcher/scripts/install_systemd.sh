#!/bin/bash
# Install Pipeline Watcher as systemd service

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCHER_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$WATCHER_DIR/../.." && pwd)"
SERVICE_FILE="$WATCHER_DIR/systemd/pipeline-watcher.service"
SYSTEMD_DIR="/etc/systemd/system"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    exit 1
fi

# Update service file with actual paths
sed -i "s|/opt/psa|$REPO_ROOT|g" "$SERVICE_FILE"

# Copy service file
echo "Installing systemd service..."
cp "$SERVICE_FILE" "$SYSTEMD_DIR/pipeline-watcher.service"

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable pipeline-watcher.service

echo "Service installed and enabled"
echo ""
echo "To start the service:"
echo "  sudo systemctl start pipeline-watcher"
echo ""
echo "To check status:"
echo "  sudo systemctl status pipeline-watcher"
echo ""
echo "To view logs:"
echo "  sudo journalctl -u pipeline-watcher -f"

