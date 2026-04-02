#!/bin/bash
# Normalize PDF Filenames with venv
# This script ensures the virtual environment is activated before running the normalization

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

# Pass all arguments to the Python script
"$VENV_PYTHON" tools/corpus/normalize_pdf_filenames.py "$@"

EXIT_CODE=$?

exit $EXIT_CODE
