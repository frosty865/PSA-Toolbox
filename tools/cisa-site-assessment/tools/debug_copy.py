#!/usr/bin/env python3
"""Debug the copy operation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

conn = get_corpus_db_connection()
cur = conn.cursor()

try:
    # Check source table columns
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'documents'
        ORDER BY ordinal_position
    """)
    print("📋 Source documents table columns:")
    for row in cur.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    # Check target table columns
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'corpus_documents'
        ORDER BY ordinal_position
    """)
    print("\n📋 Target corpus_documents table columns:")
    for row in cur.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    # Try the copy with error handling
    print("\n🔄 Attempting copy...")
    try:
        cur.execute("""
            INSERT INTO public.corpus_documents (
              file_hash,
              canonical_path,
              original_filename,
              file_stem,
              inferred_title,
              title_confidence,
              pdf_meta_title,
              pdf_meta_author,
              pdf_meta_subject,
              pdf_meta_creator,
              pdf_meta_producer,
              pdf_meta_creation_date,
              pdf_meta_mod_date,
              publisher,
              publication_date,
              source_url,
              citation_short,
              citation_full,
              locator_scheme,
              ingestion_warnings
            )
            SELECT
              d.file_hash,
              d.file_path as canonical_path,
              NULL as original_filename,
              NULL as file_stem,
              d.title as inferred_title,
              50 as title_confidence,
              NULL as pdf_meta_title,
              NULL as pdf_meta_author,
              NULL as pdf_meta_subject,
              NULL as pdf_meta_creator,
              NULL as pdf_meta_producer,
              NULL as pdf_meta_creation_date,
              NULL as pdf_meta_mod_date,
              NULL as publisher,
              NULL as publication_date,
              NULL as source_url,
              NULL as citation_short,
              NULL as citation_full,
              'page' as locator_scheme,
              '[]'::jsonb as ingestion_warnings
            FROM public.documents d
            WHERE d.file_hash IS NOT NULL
              AND d.file_hash != ''
            ON CONFLICT (file_hash) DO NOTHING
        """)
        conn.commit()
        print(f"✅ Copy completed. Rows inserted: {cur.rowcount}")
        
        cur.execute("SELECT COUNT(*) FROM public.corpus_documents")
        count = cur.fetchone()[0]
        print(f"📊 Total corpus_documents: {count}")
    except Exception as e:
        print(f"❌ Copy failed: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    
finally:
    cur.close()
    conn.close()
