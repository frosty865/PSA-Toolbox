#!/usr/bin/env python3
"""
Check if documents table has required columns for ingestion
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from model.db.db_config import get_corpus_db_connection

def main():
    required_columns = [
        'original_filename',
        'file_stem',
        'inferred_title',
        'title_confidence',
        'pdf_meta_title',
        'pdf_meta_author',
        'pdf_meta_subject',
        'pdf_meta_creator',
        'pdf_meta_producer',
        'pdf_meta_creation_date',
        'pdf_meta_mod_date',
        'publisher',
        'publication_date',
        'source_url',
        'citation_short',
        'citation_full',
        'ingestion_warnings',
    ]
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Check which columns exist
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'documents'
        """)
        existing_columns = {row[0] for row in cur.fetchall()}
        
        missing_columns = [col for col in required_columns if col not in existing_columns]
        
        if missing_columns:
            print("❌ Missing columns in documents table:")
            for col in missing_columns:
                print(f"   - {col}")
            print("\n📋 Solution: Run the migration:")
            print("   db/migrations/20260116_add_document_citation_metadata.sql")
            print("\n   You can run it via:")
            print("   1. Supabase SQL Editor (recommended)")
            print("   2. Python script: python tools/run_sql.py db/migrations/20260116_add_document_citation_metadata.sql")
            return 1
        else:
            print("✅ All required columns exist in documents table")
            return 0
            
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    sys.exit(main())
