#!/usr/bin/env python3
"""
Remove all expansion questions from CORPUS database.

This script connects to the CORPUS database and deletes all expansion questions
and related records in corpus_candidate_question_links.
"""

import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def get_corpus_connection():
    """Get CORPUS database connection."""
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if not corpus_url:
        raise ValueError('SUPABASE_CORPUS_URL environment variable not set')
    
    if not corpus_password:
        raise ValueError('SUPABASE_CORPUS_DB_PASSWORD environment variable not set')
    
    # Parse URL to extract connection details
    # Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres
    from urllib.parse import urlparse
    parsed = urlparse(corpus_url)
    
    # Extract project ref from hostname
    hostname = parsed.hostname
    project_ref = hostname.split('.')[0] if hostname else None
    
    if not project_ref:
        raise ValueError(f'Could not extract project ref from URL: {corpus_url}')
    
    # Construct connection string
    conn_string = f"postgresql://postgres:{corpus_password}@db.{project_ref}.supabase.co:6543/postgres"
    
    conn = psycopg2.connect(
        conn_string,
        sslmode='require'
    )
    
    return conn

def remove_expansion_questions(dry_run=False):
    """Remove all expansion questions from CORPUS database."""
    conn = None
    try:
        conn = get_corpus_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check current count
        cur.execute("SELECT COUNT(*) as count FROM public.expansion_questions")
        before_count = cur.fetchone()['count']
        
        print(f"Found {before_count} expansion questions in database")
        
        if before_count == 0:
            print("No expansion questions to remove.")
            return
        
        if dry_run:
            print("[DRY RUN] Would delete:")
            print(f"  - {before_count} expansion questions")
            
            # Check related records
            cur.execute("""
                SELECT COUNT(*) as count 
                FROM public.corpus_candidate_question_links 
                WHERE universe = 'EXPANSION'
            """)
            link_count = cur.fetchone()['count']
            print(f"  - {link_count} expansion question links in corpus_candidate_question_links")
            
            print("\n[DRY RUN] No changes made. Run without --dry-run to execute.")
            return
        
        # Delete expansion question links first
        cur.execute("""
            DELETE FROM public.corpus_candidate_question_links
            WHERE universe = 'EXPANSION'
        """)
        links_deleted = cur.rowcount
        print(f"Deleted {links_deleted} expansion question links")
        
        # Delete all expansion questions
        cur.execute("DELETE FROM public.expansion_questions")
        questions_deleted = cur.rowcount
        print(f"Deleted {questions_deleted} expansion questions")
        
        # Verify deletion
        cur.execute("SELECT COUNT(*) as count FROM public.expansion_questions")
        after_count = cur.fetchone()['count']
        
        if after_count > 0:
            raise Exception(f"Failed to delete all expansion questions. {after_count} remain.")
        
        # Commit transaction
        conn.commit()
        print(f"\n✅ Successfully removed all expansion questions from CORPUS database")
        print(f"   - Deleted {questions_deleted} expansion questions")
        print(f"   - Deleted {links_deleted} related question links")
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Remove all expansion questions from CORPUS database')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without making changes')
    args = parser.parse_args()
    
    remove_expansion_questions(dry_run=args.dry_run)
