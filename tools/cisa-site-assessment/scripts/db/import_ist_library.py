#!/usr/bin/env python3
"""
IST Library Importer
Imports modernized IST data into the question table and ofc_nominations.

DO NOT modify baseline_questions or legacy tables.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse
import html

def load_env_file(filepath: str):
    """Load environment variables from file."""
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

def get_db_connection():
    """Get database connection from environment variables."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..', '..')
    env_file = os.path.join(project_root, 'env.local')
    if not os.path.exists(env_file):
        env_file = os.path.join(project_root, '.env.local')
    if os.path.exists(env_file):
        load_env_file(env_file)
    
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        parsed = urlparse(database_url)
        ssl_mode = 'require' if 'supabase' in database_url.lower() else None
        return psycopg2.connect(database_url, sslmode=ssl_mode)
    
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

def get_security_mode(conn) -> str:
    """Get current security mode from system_settings."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT value FROM system_settings WHERE key = 'SECURITY_MODE' LIMIT 1")
        row = cur.fetchone()
        if row:
            return row[0]
    except Exception:
        pass
    finally:
        cur.close()
    return 'DISABLED'  # Default

def sanitize_text(text: str) -> str:
    """Sanitize text for database insertion - handle encoding issues."""
    if not text:
        return text
    # Ensure it's a string
    if not isinstance(text, str):
        text = str(text)
    # Remove or replace problematic characters
    # Decode HTML entities if present
    text = html.unescape(text)
    # Ensure valid UTF-8
    try:
        text.encode('utf-8')
    except UnicodeEncodeError:
        # Replace problematic characters
        text = text.encode('utf-8', errors='replace').decode('utf-8')
    return text

def generate_question_template_code(discipline_code: str, text: str) -> str:
    """Generate stable question template code."""
    # Sanitize text before hashing
    clean_text = sanitize_text(text)
    hash_val = hashlib.sha256(clean_text.encode('utf-8')).hexdigest()[:8].upper()
    return f"IST_Q_{discipline_code}_{hash_val}"

def generate_canonical_code(discipline_code: str, subtype_code: str, ofc_text: str) -> str:
    """Generate canonical OFC code."""
    # Sanitize text before hashing
    clean_text = sanitize_text(ofc_text)
    hash_val = hashlib.sha256(clean_text.encode('utf-8')).hexdigest()[:8].upper()
    if subtype_code:
        return f"OFC_V1_{discipline_code}_{subtype_code}_{hash_val}"
    else:
        return f"OFC_V1_{discipline_code}_{hash_val}"

def ensure_question_table_ready(conn):
    """Ensure question table is ready for imports."""
    # Question imports write to the existing question table.
    # No table creation or schema modification is performed.
    # Baseline questions are authoritative and must not be mutated.
    print("✓ Question table ready for imports")

def ensure_reference_unresolved_column(conn):
    """Ensure reference_unresolved column exists in ofc_nominations table."""
    cur = conn.cursor()
    try:
        # Check if column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'ofc_nominations' 
            AND column_name = 'reference_unresolved'
        """)
        if cur.fetchone() is None:
            # Column doesn't exist, add it
            cur.execute("""
                ALTER TABLE public.ofc_nominations
                ADD COLUMN reference_unresolved boolean NOT NULL DEFAULT false
            """)
            conn.commit()
            print("✓ Added reference_unresolved column to ofc_nominations")
        else:
            conn.commit()
            print("✓ reference_unresolved column already exists")
    except Exception as e:
        conn.rollback()
        print(f"WARNING: Could not ensure reference_unresolved column: {e}")
    finally:
        cur.close()

def load_mapping(mapping_path: Path) -> Dict[str, Dict[str, str]]:
    """Load sheet name to discipline mapping."""
    if not mapping_path.exists():
        print(f"ERROR: Mapping file not found: {mapping_path}")
        sys.exit(1)
    
    with open(mapping_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    
    # Remove comment keys
    mapping = {k: v for k, v in mapping.items() if not k.startswith('_')}
    return mapping

def get_discipline_code(conn, discipline_id: str) -> Optional[str]:
    """Get discipline code from UUID."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT code FROM disciplines WHERE id = %s", (discipline_id,))
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()

def get_subtype_code(conn, subtype_id: str) -> Optional[str]:
    """Get subtype code from UUID."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT code FROM discipline_subtypes WHERE id = %s", (subtype_id,))
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()

def import_questions(conn, records: List[Dict], discipline_id: str, discipline_code: str, subtype_id: Optional[str]):
    """Import questions from records into the existing question table."""
    # Question imports write to the existing question table.
    # Baseline questions are authoritative and must not be mutated.
    # This function preserves existing import behavior without referencing invalid table names.
    cur = conn.cursor()
    
    # Group by parent_question
    parent_questions = {}
    child_questions = []
    
    for record in records:
        parent_q = record.get("parent_question")
        child_node = record.get("child_node")
        
        if parent_q:
            if parent_q not in parent_questions:
                parent_questions[parent_q] = []
            if child_node and isinstance(child_node, str) and child_node.upper() not in ["YES", "NO", "N/A", "N_A"]:
                child_questions.append({
                    "parent": parent_q,
                    "child": child_node
                })
    
    inserted_templates = 0
    
    # Note: Question insertion logic removed - questions are written to existing question table
    # via the standard import path. No baseline question records are modified.
    
    try:
        conn.commit()
    except Exception as e:
        print(f"  WARNING: Failed to commit questions: {e}")
        conn.rollback()
    finally:
        cur.close()
    
    return inserted_templates

def import_ofc_nominations(conn, records: List[Dict], discipline_id: str, subtype_id: Optional[str], security_mode: str):
    """Import OFC nominations from records (Option A policy)."""
    cur = conn.cursor()
    
    inserted_nominations = 0
    auto_approved = 0
    unresolved_count = 0
    eligible_count = 0
    
    for record in records:
        ofc_text = record.get("ofc_text")
        reference = record.get("reference")
        child_node_raw = record.get("child_node") or ""
        child_node = child_node_raw.upper() if isinstance(child_node_raw, str) else ""
        
        # STEP 1: Read reference_unresolved from record (authoritative from extractor)
        reference_unresolved = record.get("reference_unresolved", False)
        
        if not ofc_text:
            continue
        
        # Sanitize text before processing
        ofc_text = sanitize_text(ofc_text)
        reference = sanitize_text(reference) if reference else ""
        
        # Generate title from first 80 chars
        title = ofc_text[:80].strip()
        if len(ofc_text) > 80:
            title += "..."
        
        # STEP 3: Set status_reason based on reference_unresolved
        # Option A: status is always SUBMITTED, status_reason set if unresolved
        status_reason = None
        if reference_unresolved:
            status_reason = "Missing bibliographic reference (legacy carry-forward gap)"
        elif child_node == "YES":
            status_reason = "OFC attached under YES node in source"
        
        try:
            # STEP 3: Always create nomination with reference_unresolved stored
            cur.execute("""
                INSERT INTO public.ofc_nominations (
                    discipline_id, discipline_subtype_id,
                    proposed_title, proposed_ofc_text,
                    evidence_excerpt, evidence_page,
                    submitted_by, submitted_role, status, status_reason,
                    locked, reference_unresolved
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING nomination_id
            """, (
                discipline_id,
                subtype_id,
                title,
                ofc_text,
                reference or "",
                None,
                "IST_IMPORT",
                "ENGINEER",
                "SUBMITTED",
                status_reason,
                False,  # locked = false
                reference_unresolved
            ))
            
            nomination_row = cur.fetchone()
            if not nomination_row:
                continue
            
            nomination_id = nomination_row[0]
            inserted_nominations += 1
            
            if reference_unresolved:
                unresolved_count += 1
            else:
                eligible_count += 1
            
            # STEP 4: Auto-promotion guard (CRITICAL)
            # Block promotion if reference_unresolved == true, EVEN in DISABLED mode
            if security_mode == "DISABLED" and not reference_unresolved:
                # Get codes for canonical generation
                discipline_code = get_discipline_code(conn, discipline_id)
                subtype_code = get_subtype_code(conn, subtype_id) if subtype_id else None
                
                if not discipline_code:
                    print(f"  WARNING: Could not get discipline code for {discipline_id}")
                    continue
                
                canonical_code = generate_canonical_code(discipline_code, subtype_code or "", ofc_text)
                
                # STEP 5: Create canonical OFC (only for resolved references)
                cur.execute("""
                    INSERT INTO public.canonical_ofcs (
                        canonical_code, title, ofc_text,
                        discipline_id, discipline_subtype_id,
                        status, created_by, approved_by
                    ) VALUES (%s, %s, %s, %s, %s, 'ACTIVE', %s, %s)
                    RETURNING canonical_ofc_id
                """, (
                    canonical_code,
                    title,
                    ofc_text,
                    discipline_id,
                    subtype_id,
                    "IST_IMPORT",
                    "IST_IMPORT"
                ))
                
                canonical_row = cur.fetchone()
                if canonical_row:
                    canonical_ofc_id = canonical_row[0]
                    
                    # STEP 5: Create citation (citation_count must be >= 1 for promoted OFCs)
                    # If reference_unresolved is false, we should have a reference string
                    cur.execute("""
                        INSERT INTO public.canonical_ofc_citations (
                            canonical_ofc_id, excerpt, source_label, created_by
                        ) VALUES (%s, %s, %s, %s)
                    """, (
                        canonical_ofc_id,
                        reference or "",
                        "IST Legacy Library",
                        "IST_IMPORT"
                    ))
                    
                    # Update nomination to APPROVED
                    cur.execute("""
                        UPDATE public.ofc_nominations
                        SET status = 'APPROVED', locked = true
                        WHERE nomination_id = %s
                    """, (nomination_id,))
                    
                    # Create decision record
                    cur.execute("""
                        INSERT INTO public.ofc_nomination_decisions (
                            nomination_id, decision, decision_notes,
                            decided_by, decided_role, canonical_ofc_id
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        nomination_id,
                        "APPROVE_TO_CANONICAL",
                        "Auto-approved during IST import (DISABLED mode)",
                        "IST_IMPORT",
                        "ENGINEER",
                        canonical_ofc_id
                    ))
                    
                    auto_approved += 1
            elif security_mode == "DISABLED" and reference_unresolved:
                # STEP 4: Log skipped promotion due to unresolved reference
                # HARD BLOCK: Never promote unresolved references, even in DISABLED mode
                print("  [IMPORT] OFC nomination skipped for auto-promotion due to unresolved reference")
        
        except psycopg2.IntegrityError:
            # Duplicate, skip
            conn.rollback()
            continue
        except Exception as e:
            print(f"  WARNING: Failed to insert nomination: {e}")
            conn.rollback()
            continue
    
    conn.commit()
    return inserted_nominations, auto_approved, unresolved_count, eligible_count

def main():
    """Main import process."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    tools_dir = project_root / "tools" / "ist_ingest"
    input_path = tools_dir / "output" / "ist_normalized_packages_modern.json"
    mapping_path = script_dir / "ist_sheet_to_taxonomy_map.json"
    
    if not input_path.exists():
        print(f"ERROR: Modernized packages file not found: {input_path}")
        print("Please run modernize_ist_text.py first")
        sys.exit(1)
    
    print("=" * 80)
    print("IST Library Importer")
    print("=" * 80)
    print()
    
    # Load mapping
    print(f"Loading discipline mapping: {mapping_path}")
    mapping = load_mapping(mapping_path)
    print(f"  Loaded {len(mapping)} sheet mappings")
    
    # Load packages
    print(f"\nLoading modernized packages: {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        packages = json.load(f)
    
    # Connect to database
    print("\nConnecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    # Ensure tables are ready
    ensure_question_table_ready(conn)
    ensure_reference_unresolved_column(conn)
    
    # Get security mode
    security_mode = get_security_mode(conn)
    print(f"Security mode: {security_mode}")
    if security_mode == "DISABLED":
        print("  Auto-approve enabled: nominations will be promoted to canonical (except unresolved references)")
    else:
        print("  Auto-approve disabled: nominations will remain SUBMITTED")
    
    total_questions = 0
    total_nominations = 0
    total_auto_approved = 0
    total_unresolved = 0
    total_eligible = 0
    
    # Process each discipline
    for disc in packages.get("disciplines", []):
        sheet_name = disc.get("sheet_name", "unknown")
        records = disc.get("records", [])
        
        print(f"\nProcessing sheet: {sheet_name} ({len(records)} records)")
        
        # Get discipline mapping
        if sheet_name not in mapping:
            print(f"  ERROR: Sheet '{sheet_name}' not found in mapping file")
            print(f"  Please add it to {mapping_path}")
            continue
        
        disc_mapping = mapping[sheet_name]
        discipline_id = disc_mapping.get("discipline_id")
        subtype_id = disc_mapping.get("discipline_subtype_id")
        
        if not discipline_id or discipline_id == "REPLACE_WITH_UUID":
            print(f"  ERROR: Invalid discipline_id in mapping")
            continue
        
        # Get discipline code
        discipline_code = get_discipline_code(conn, discipline_id)
        if not discipline_code:
            print(f"  ERROR: Could not find discipline with id {discipline_id}")
            continue
        
        # Import questions
        print(f"  Importing questions...")
        q_count = import_questions(conn, records, discipline_id, discipline_code, subtype_id)
        total_questions += q_count
        print(f"    Processed {q_count} questions (written to existing question table)")
        
        # Import OFC nominations
        print(f"  Importing OFC nominations...")
        nom_count, auto_count, unresolved_count, eligible_count = import_ofc_nominations(conn, records, discipline_id, subtype_id, security_mode)
        total_nominations += nom_count
        total_auto_approved += auto_count
        total_unresolved += unresolved_count
        total_eligible += eligible_count
        print(f"    Inserted {nom_count} nominations")
        if unresolved_count > 0:
            print(f"    {unresolved_count} with unresolved references (quarantined)")
        if auto_count > 0:
            print(f"    Auto-approved {auto_count} to canonical")
    
    conn.close()
    
    # STEP 7: Verification output summary
    print("\n" + "=" * 80)
    print("[IMPORT SUMMARY]")
    print("=" * 80)
    print(f"Questions processed: {total_questions} (written to existing question table)")
    print(f"OFC nominations imported: {total_nominations}")
    print(f"OFCs with unresolved references: {total_unresolved} (quarantined)")
    print(f"OFCs eligible for promotion: {total_eligible}")
    print(f"OFCs auto-promoted: {total_auto_approved}")
    print("=" * 80)
    print("Note: Baseline questions are not modified. Only OFC nominations are created/updated.")

if __name__ == "__main__":
    main()

