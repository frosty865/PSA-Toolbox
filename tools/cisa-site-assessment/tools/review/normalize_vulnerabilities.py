#!/usr/bin/env python3
"""
Normalize approved deficiency statements into canonical vulnerabilities.

For each approved deficiency statement:
- If it represents an observable deficiency: create/link vulnerability
- If not: reject the statement permanently
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor
from urllib.parse import quote_plus

# Load environment variables
def load_env_file(filepath):
    """Load environment variables from .env.local file."""
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.join(script_dir, '..', '..')
env_file = os.path.join(project_root, '.env.local')
if not os.path.exists(env_file):
    env_file = os.path.join(project_root, 'env.local')
load_env_file(env_file)


def get_db_connection():
    """Get database connection from environment variables."""
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        return psycopg2.connect(database_url)
    
    # Fallback to individual components
    user = os.getenv('DATABASE_USER', 'postgres')
    password = os.getenv('DATABASE_PASSWORD', '')
    host = os.getenv('DATABASE_HOST', 'localhost')
    port = os.getenv('DATABASE_PORT', '5432')
    dbname = os.getenv('DATABASE_NAME', 'postgres')
    
    return psycopg2.connect(
        host=host,
        port=port,
        database=dbname,
        user=user,
        password=password
    )


def is_observable_deficiency(raw_text, assigned_discipline, assigned_subtype):
    """
    Determine if statement represents an observable physical security deficiency.
    
    Returns True if it's a clear, verifiable deficiency.
    Returns False if it's informational, aspirational, or not a real deficiency.
    """
    if not raw_text:
        return False
    
    text_lower = raw_text.lower()
    
    # Must have deficiency indicators
    deficiency_indicators = [
        'missing', 'lacks', 'lacking', 'not present', 'not installed',
        'not configured', 'not monitored', 'insufficient', 'inadequate',
        'limited', 'blind spot', 'failure', 'unable to', 'does not', 'without',
        'absent', 'no', 'none', 'fails to', 'cannot', 'unable'
    ]
    
    has_deficiency = any(indicator in text_lower for indicator in deficiency_indicators)
    if not has_deficiency:
        return False
    
    # Must have physical security component
    physical_components = [
        'camera', 'door', 'gate', 'lock', 'reader', 'panel', 'sensor',
        'alarm', 'fence', 'barrier', 'bollard', 'lighting', 'access',
        'surveillance', 'monitoring', 'detection', 'perimeter', 'security'
    ]
    
    has_physical = any(component in text_lower for component in physical_components)
    if not has_physical:
        return False
    
    # Reject if too vague or aspirational
    vague_indicators = [
        'should', 'recommend', 'consider', 'may', 'might', 'could',
        'best practice', 'guideline', 'standard', 'policy', 'procedure'
    ]
    
    is_vague = any(indicator in text_lower for indicator in vague_indicators)
    if is_vague and 'not' not in text_lower and 'no' not in text_lower:
        return False
    
    return True


def get_or_create_vulnerability(conn, discipline, subtype, raw_text):
    """
    Get existing vulnerability or create new one.
    
    Returns (vulnerability_id, created_new)
    """
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Generate canonical title (first 100 chars of statement, cleaned)
    canonical_title = raw_text[:100].strip()
    if len(raw_text) > 100:
        canonical_title = canonical_title.rsplit('.', 1)[0] + '.'
    
    # Generate canonical description
    canonical_description = raw_text[:500].strip()
    
    # Check if similar vulnerability exists
    cur.execute("""
        SELECT id
        FROM public.normalized_vulnerabilities
        WHERE discipline = %s
          AND discipline_subtype = %s
          AND canonical_title = %s
        LIMIT 1
    """, (discipline, subtype, canonical_title))
    
    existing = cur.fetchone()
    if existing:
        return existing['id'], False
    
    # Create new vulnerability
    cur.execute("""
        INSERT INTO public.normalized_vulnerabilities (
            discipline,
            discipline_subtype,
            canonical_title,
            canonical_description,
            status
        ) VALUES (%s, %s, %s, %s, 'draft')
        RETURNING id
    """, (discipline, subtype, canonical_title, canonical_description))
    
    new_vuln = cur.fetchone()
    cur.close()
    return new_vuln['id'], True


def main():
    """Main normalization function."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Fetch approved deficiency statements not yet linked
        cur.execute("""
            SELECT 
                ss.id,
                ss.raw_text,
                ss.assigned_discipline,
                ss.assigned_subtype,
                ss.reviewer_notes
            FROM public.source_statements ss
            INNER JOIN public.source_documents sd ON ss.document_id = sd.id
            WHERE ss.review_status = 'approved'
              AND ss.deficiency_flag = TRUE
              AND sd.corpus_scope = 'primary'
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.normalized_evidence_links nel
                  WHERE nel.source_statement_id = ss.id
              )
            ORDER BY ss.id
        """)
        
        statements = cur.fetchall()
        print(f"Found {len(statements)} approved deficiency statements to normalize")
        
        vulnerabilities_created = 0
        vulnerabilities_linked = 0
        statements_rejected = 0
        
        for stmt in statements:
            stmt_id = stmt['id']
            raw_text = stmt['raw_text'] or ''
            discipline = stmt['assigned_discipline'] or 'Unassigned'
            subtype = stmt['assigned_subtype'] or 'General'
            
            if is_observable_deficiency(raw_text, discipline, subtype):
                # Create or get vulnerability
                vuln_id, created = get_or_create_vulnerability(
                    conn, discipline, subtype, raw_text
                )
                
                if created:
                    vulnerabilities_created += 1
                
                # Link statement as evidence
                cur.execute("""
                    INSERT INTO public.normalized_evidence_links (
                        source_statement_id,
                        vulnerability_id
                    ) VALUES (%s, %s)
                """, (stmt_id, vuln_id))
                
                vulnerabilities_linked += 1
            else:
                # Reject statement
                cur.execute("""
                    UPDATE public.source_statements
                    SET review_status = 'rejected',
                        reviewer_notes = COALESCE(reviewer_notes || ' ', '') || 
                            'No observable physical security deficiency; informational or aspirational.'
                    WHERE id = %s
                """, (stmt_id,))
                
                statements_rejected += 1
        
        conn.commit()
        
        print(f"\nResults:")
        print(f"  Vulnerabilities created: {vulnerabilities_created}")
        print(f"  Statements linked: {vulnerabilities_linked}")
        print(f"  Statements rejected: {statements_rejected}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()

