#!/usr/bin/env bash
set -euo pipefail
IN="${1:-SAFE_Comprehensive.html}"
OUT="${2:-SAFE_Comprehensive_wk.pdf}"
# Common options: print background, disable smart shrinking (better fidelity), margins
wkhtmltopdf   --print-media-type   --margin-top 12.7 --margin-right 12.7 --margin-bottom 12.7 --margin-left 12.7   --disable-smart-shrinking   "$IN" "$OUT"
echo "Created $OUT"