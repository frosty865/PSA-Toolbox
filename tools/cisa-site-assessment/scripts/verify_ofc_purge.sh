#!/bin/bash
# Verify OFC Purge Status
# This script checks if all OFC tables are empty

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Check if venv exists
if [ ! -f "venv/bin/python" ]; then
    echo "ERROR: Virtual environment not found at venv/bin/python"
    echo "Please create a virtual environment first:"
    echo "  python -m venv venv"
    exit 1
fi

# Use venv Python directly (more reliable than activating)
VENV_PYTHON="$PROJECT_ROOT/venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: venv Python not found at $VENV_PYTHON"
    exit 1
fi

"$VENV_PYTHON" tools/corpus/verify_ofc_purge.py

EXIT_CODE=$?

exit $EXIT_CODE
