#!/bin/bash
# Bulk Ingest PDFs with PSA System venv
# Uses processor venv from D:\PSA_System\Dependencies\python\venvs\processor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Resolve PSA System root
PSA_SYSTEM_ROOT="${PSA_SYSTEM_ROOT:-D:\\PSA_System}"

# Use processor venv for PDF ingestion
# Convert Windows path to Unix-style if on WSL/Git Bash
VENV_PYTHON="${PSA_SYSTEM_ROOT}/Dependencies/python/venvs/processor/bin/python"

# Check if venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: PSA System processor venv not found at: $VENV_PYTHON"
    echo "Please create the virtual environment first:"
    echo "  D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName processor"
    exit 1
fi

# Run bulk ingestion using PSA System venv Python
"$VENV_PYTHON" tools/corpus/bulk_ingest_pdfs.py "$@"
EXIT_CODE=$?

exit $EXIT_CODE
