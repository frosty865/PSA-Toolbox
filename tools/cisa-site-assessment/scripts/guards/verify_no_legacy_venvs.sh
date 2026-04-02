#!/bin/bash
# PSA System - Verify No Legacy Virtual Environments
# Guards against venv directories in wrong locations
#
# This script fails if it finds:
#   - venv/ directory in repo root
#   - .venv/ directory in repo root
#   - bin/python in repo root (Unix venv artifact)
#
# Exception: venvs under D:\PSA_System\Dependencies\python\venvs\ are allowed

set -e

REPO_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
PSA_SYSTEM_ROOT="${PSA_SYSTEM_ROOT:-D:\PSA_System}"
ALLOWED_VENV_ROOT="$PSA_SYSTEM_ROOT/Dependencies/python/venvs"

ERRORS=()

# Check for venv/ in repo root
if [ -d "$REPO_ROOT/venv" ]; then
    ERRORS+=("Found venv/ directory at: $REPO_ROOT/venv (should be under $ALLOWED_VENV_ROOT)")
fi

# Check for .venv/ in repo root
if [ -d "$REPO_ROOT/.venv" ]; then
    ERRORS+=("Found .venv/ directory at: $REPO_ROOT/.venv (should be under $ALLOWED_VENV_ROOT)")
fi

# Check for bin/python in repo root (Unix venv artifact)
if [ -f "$REPO_ROOT/bin/python" ]; then
    ERRORS+=("Found bin/python at: $REPO_ROOT/bin/python (venv artifact in wrong location)")
fi

# Report results
if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "ERROR: Found legacy virtual environments in wrong locations:" >&2
    echo "" >&2
    for error in "${ERRORS[@]}"; do
        echo "  - $error" >&2
    done
    echo "" >&2
    echo "All Python virtual environments must be under:" >&2
    echo "  $ALLOWED_VENV_ROOT" >&2
    echo "" >&2
    echo "To create venvs in the correct location, run:" >&2
    echo "  D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName processor" >&2
    echo "  D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName engine" >&2
    exit 1
else
    echo "✓ No legacy virtual environments found in wrong locations"
    exit 0
fi
