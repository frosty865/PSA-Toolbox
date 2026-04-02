#!/bin/bash
# Process module PDFs from data/incoming: copy to module storage, ingest into CORPUS, link to module.
# Requires: --module-code (e.g. MODULE_EV_PARKING)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PSA_SYSTEM_ROOT="${PSA_SYSTEM_ROOT:-D:/PSA_System}"
VENV_PYTHON="${PSA_SYSTEM_ROOT}/Dependencies/python/venvs/processor/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
  echo "ERROR: Processor venv not found: $VENV_PYTHON"
  exit 1
fi

"$VENV_PYTHON" tools/corpus/process_module_pdfs_from_incoming.py "$@"
exit $?
