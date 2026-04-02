#!/bin/bash
# Build diagnostics script for PSA rebuild
# Captures all build output to timestamped log file

set -euo pipefail

# Create reports directory if missing
REPORTS_DIR="analytics/reports/build"
mkdir -p "$REPORTS_DIR"

# Generate timestamp
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$REPORTS_DIR/build_$TS.log"

{
    echo "=== PSA Build Diagnostics ==="
    echo "Log file: $LOG_FILE"
    echo ""
    
    # Print versions
    echo "=== Node/NPM Versions ==="
    node --version
    npm --version
    echo ""
    
    # Delete Next build cache
    echo "=== Cleaning .next directory ==="
    if [ -d .next ]; then
        rm -rf .next
        echo ".next directory removed"
    else
        echo ".next directory does not exist"
    fi
    echo ""
    
    # Run doctrine:check
    echo "=== Running doctrine:check ==="
    npm run doctrine:check
    echo ""
    
    # Run lint (restricted to source directories)
    echo "=== Running lint (max-warnings=0) ==="
    npm run lint
    echo ""
    
    # Run typecheck
    echo "=== Running typecheck ==="
    npm run typecheck
    echo ""
    
    # Run build
    echo "=== Running build ==="
    npm run build
    echo ""
    
    echo "=== SUCCESS: All checks passed ==="
    echo "Log saved to: $LOG_FILE"
} | tee "$LOG_FILE"

exit 0
