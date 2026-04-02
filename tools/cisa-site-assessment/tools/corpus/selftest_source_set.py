#!/usr/bin/env python3
"""
CORPUS Source Set Self-Test

Validates source_set configuration and data integrity.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    get_active_source_set,
    ALLOWED_SOURCE_SETS
)

def main():
    errors = []
    warnings = []
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Test 1: Active source set exists and is valid
        try:
            active_set = get_active_source_set(conn)
            print(f"✅ Active source set: {active_set}")
            
            if active_set not in ALLOWED_SOURCE_SETS:
                errors.append(f"Active source set '{active_set}' not in allowed list")
        except Exception as e:
            errors.append(f"Failed to get active source set: {e}")
            return
        
        # Test 2: No UNSPECIFIED documents when active is VOFC_LIBRARY
        if active_set == 'VOFC_LIBRARY':
            cur.execute("""
                SELECT COUNT(*) FROM public.documents 
                WHERE source_set = 'UNSPECIFIED'
            """)
            unspecified_count = cur.fetchone()[0]
            
            if unspecified_count > 0:
                warnings.append(
                    f"Found {unspecified_count} documents with source_set='UNSPECIFIED'. "
                    "These will be excluded from processing."
                )
            else:
                print("✅ No UNSPECIFIED documents found")
        
        # Test 3: At least 1 document in active source_set (after ingest)
        cur.execute("""
            SELECT COUNT(*) FROM public.documents 
            WHERE source_set = %s
        """, (active_set,))
        doc_count = cur.fetchone()[0]
        
        if doc_count == 0:
            warnings.append(
                f"No documents found in active source_set '{active_set}'. "
                "Run ingestion first."
            )
        else:
            print(f"✅ Found {doc_count} documents in active source_set")
        
        # Test 4: At least 1 chunk in active source_set (after ingest)
        cur.execute("""
            SELECT COUNT(*) FROM public.document_chunks 
            WHERE source_set = %s
        """, (active_set,))
        chunk_count = cur.fetchone()[0]
        
        if chunk_count == 0:
            warnings.append(
                f"No chunks found in active source_set '{active_set}'. "
                "Run ingestion first."
            )
        else:
            print(f"✅ Found {chunk_count} chunks in active source_set")
        
        # Test 5: Chunks match their document's source_set
        cur.execute("""
            SELECT COUNT(*) 
            FROM public.document_chunks dc
            JOIN public.documents d ON dc.document_id = d.document_id
            WHERE dc.source_set != d.source_set
        """)
        mismatch_count = cur.fetchone()[0]
        
        if mismatch_count > 0:
            errors.append(
                f"Found {mismatch_count} chunks with mismatched source_set "
                "(chunk.source_set != document.source_set)"
            )
        else:
            print("✅ All chunks match their document's source_set")
        
    finally:
        cur.close()
        conn.close()
    
    # Print results
    print()
    if warnings:
        print("⚠️  Warnings:")
        for w in warnings:
            print(f"   {w}")
        print()
    
    if errors:
        print("❌ Errors:")
        for e in errors:
            print(f"   {e}")
        print()
        sys.exit(1)
    
    if not warnings and not errors:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        sys.exit(0)  # Warnings are OK

if __name__ == '__main__':
    main()

