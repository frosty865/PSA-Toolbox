#!/usr/bin/env python3
"""
Set Active Source Set CLI

Usage:
    python tools/corpus/set_active_source_set.py VOFC_LIBRARY
    python tools/corpus/set_active_source_set.py PILOT_DOCS
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    set_active_source_set,
    ALLOWED_SOURCE_SETS
)

def main():
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <source_set>")
        print(f"Valid values: {', '.join(sorted(ALLOWED_SOURCE_SETS))}")
        sys.exit(1)
    
    value = sys.argv[1].strip()
    
    try:
        conn = get_corpus_db_connection()
        set_active_source_set(conn, value)
        conn.close()
        
        print(f"✅ Active source set updated to: {value}")
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

