#!/usr/bin/env python3
"""
Create coverage_runs table in the database.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / "env.local"
if env_path.exists():
    load_dotenv(env_path)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Error: psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

def get_db_connection():
    """Get database connection from environment."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not found in environment")
        sys.exit(1)
    
    # Parse connection string for SSL
    ssl_mode = None
    if 'supabase' in database_url.lower() or 'amazonaws.com' in database_url.lower():
        ssl_mode = {'sslmode': 'require'}
    
    return psycopg2.connect(database_url, sslmode='require' if ssl_mode else None)

def create_table():
    """Create coverage_runs table."""
    # Check if documents table exists first
    check_sql = """
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'documents'
    );
    """
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(check_sql)
    documents_exists = cursor.fetchone()[0]
    
    # Build SQL with or without foreign key
    if documents_exists:
        fk_constraint = """
        CONSTRAINT fk_coverage_runs_document_id 
            FOREIGN KEY (document_id) 
            REFERENCES public.documents(document_id) 
            ON DELETE CASCADE
        """
    else:
        print("⚠ documents table does not exist - creating coverage_runs without foreign key")
        fk_constraint = ""
    
    sql = f"""
    -- Create coverage_runs table for Phase 2 coverage data
    CREATE TABLE IF NOT EXISTS public.coverage_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id TEXT NOT NULL,
        schema_version TEXT,
        generated_at TIMESTAMPTZ,
        coverage_percent REAL,
        raw_payload JSONB NOT NULL,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
        {',' + fk_constraint if fk_constraint else ''}
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_coverage_runs_document_id ON public.coverage_runs(document_id);
    CREATE INDEX IF NOT EXISTS idx_coverage_runs_schema_version ON public.coverage_runs(schema_version);
    CREATE INDEX IF NOT EXISTS idx_coverage_runs_generated_at ON public.coverage_runs(generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coverage_runs_ingested_at ON public.coverage_runs(ingested_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coverage_runs_raw_payload ON public.coverage_runs USING GIN (raw_payload);

    -- Add comment
    COMMENT ON TABLE public.coverage_runs IS 'Phase 2 coverage outputs - stores raw coverage data verbatim';
    """
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        conn.close()
        print("✓ Successfully created coverage_runs table")
        return True
    except Exception as e:
        print(f"✗ Error creating table: {e}")
        return False

if __name__ == "__main__":
    success = create_table()
    sys.exit(0 if success else 1)

