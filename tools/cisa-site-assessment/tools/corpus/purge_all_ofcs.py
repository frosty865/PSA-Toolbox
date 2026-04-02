#!/usr/bin/env python3
"""
Full OFC Purge Script - Doctrinal Reset

PURPOSE
Purge ALL OFCs from CORPUS database to establish clean slate for PSA OFC Doctrine v1.

SCOPE
- Deletes from ofc_candidate_queue (all origins: CORPUS and MODULE)
- Deletes from ofc_question_links
- Deletes from ofc_candidate_targets
- Preserves: documents, chunks, sources, questions, taxonomy

GUARD
- DRY RUN by default
- --apply requires: ALLOW_OFC_RESET=YES

Usage:
    # Always use venv!
    source venv/bin/activate  # Unix/Mac/Linux
    venv\Scripts\activate      # Windows
    
    python tools/corpus/purge_all_ofcs.py                    # DRY RUN
    ALLOW_OFC_RESET=YES python tools/corpus/purge_all_ofcs.py --apply
    
    # Or use wrapper scripts (auto-activate venv):
    scripts/run_ofc_purge.bat          # Windows DRY RUN
    scripts/run_ofc_purge.sh           # Unix DRY RUN
    ALLOW_OFC_RESET=YES scripts/run_ofc_purge.bat --apply  # Windows APPLY
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_corpus_db():
    """Get CORPUS database connection."""
    import psycopg2
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def table_exists(conn, table_name: str) -> bool:
    """Check if table exists."""
    cur = conn.cursor()
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
    """, (table_name,))
    exists = cur.fetchone()[0]
    cur.close()
    return exists

def count_rows(conn, table_name: str) -> int:
    """Count rows in table."""
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM public.{table_name}")
    count = cur.fetchone()[0]
    cur.close()
    return count

def discover_ofc_tables(conn) -> Dict[str, bool]:
    """Discover which OFC-related tables exist."""
    tables = {
        "ofc_candidate_queue": False,
        "ofc_question_links": False,
        "ofc_candidate_targets": False,
    }
    
    for table_name in tables.keys():
        tables[table_name] = table_exists(conn, table_name)
    
    return tables

def purge_ofcs(conn, dry_run: bool = True) -> Dict[str, Any]:
    """Purge all OFCs from CORPUS database."""
    cur = conn.cursor()
    report = {
        "mode": "DRY_RUN" if dry_run else "APPLY",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "tables_purged": {},
        "errors": []
    }
    
    # Discover tables
    print("[INFO] Discovering OFC-related tables...")
    ofc_tables = discover_ofc_tables(conn)
    
    for table_name, exists in ofc_tables.items():
        if not exists:
            print(f"[SKIP] Table {table_name} does not exist")
            continue
        
        count_before = count_rows(conn, table_name)
        report["tables_purged"][table_name] = {
            "exists": True,
            "rows_before": count_before,
            "rows_deleted": 0 if dry_run else count_before
        }
        print(f"[INFO] {table_name}: {count_before} rows")
    
    if dry_run:
        print("\n[DRY RUN] Would delete:")
        for table_name, info in report["tables_purged"].items():
            if info["exists"]:
                print(f"  - {table_name}: {info['rows_before']} rows")
        return report
    
    # Apply deletions in correct order (respecting FK constraints)
    try:
        # 1. Delete from ofc_question_links (references ofc_candidate_queue)
        if ofc_tables.get("ofc_question_links"):
            print("\n[APPLY] Deleting from ofc_question_links...")
            cur.execute("DELETE FROM public.ofc_question_links")
            deleted = cur.rowcount
            report["tables_purged"]["ofc_question_links"]["rows_deleted"] = deleted
            print(f"[OK] Deleted {deleted} rows from ofc_question_links")
        
        # 2. Delete from ofc_candidate_targets (references ofc_candidate_queue)
        if ofc_tables.get("ofc_candidate_targets"):
            print("\n[APPLY] Deleting from ofc_candidate_targets...")
            cur.execute("DELETE FROM public.ofc_candidate_targets")
            deleted = cur.rowcount
            report["tables_purged"]["ofc_candidate_targets"]["rows_deleted"] = deleted
            print(f"[OK] Deleted {deleted} rows from ofc_candidate_targets")
        
        # 3. Delete from ofc_candidate_queue (main table)
        if ofc_tables.get("ofc_candidate_queue"):
            print("\n[APPLY] Deleting from ofc_candidate_queue...")
            cur.execute("DELETE FROM public.ofc_candidate_queue")
            deleted = cur.rowcount
            report["tables_purged"]["ofc_candidate_queue"]["rows_deleted"] = deleted
            print(f"[OK] Deleted {deleted} rows from ofc_candidate_queue")
        
        # Commit transaction
        conn.commit()
        print("\n[OK] Transaction committed")
        
        # Verify deletion
        print("\n[VERIFY] Verifying deletion...")
        for table_name in ofc_tables.keys():
            if ofc_tables[table_name]:
                count_after = count_rows(conn, table_name)
                if count_after > 0:
                    report["errors"].append(f"{table_name} still has {count_after} rows after deletion")
                    print(f"[FAIL] {table_name}: {count_after} rows remaining (expected 0)")
                else:
                    print(f"[OK] {table_name}: 0 rows (verified)")
        
    except Exception as e:
        conn.rollback()
        error_msg = f"Transaction failed: {str(e)}"
        report["errors"].append(error_msg)
        print(f"\n[FAIL] {error_msg}")
        print("[INFO] Transaction rolled back")
        raise
    
    finally:
        cur.close()
    
    return report

def main():
    ap = argparse.ArgumentParser(description="Purge all OFCs from CORPUS database (doctrinal reset)")
    ap.add_argument("--apply", action="store_true", help="Apply deletions (requires ALLOW_OFC_RESET=YES)")
    args = ap.parse_args()
    
    dry_run = not args.apply
    
    if args.apply:
        if os.environ.get("ALLOW_OFC_RESET") != "YES":
            print("[FAIL] --apply requires ALLOW_OFC_RESET=YES environment variable")
            print("[INFO] Set environment variable: export ALLOW_OFC_RESET=YES")
            sys.exit(1)
    
    print("=" * 70)
    print("PSA OFC DOCTRINE V1 - FULL PURGE")
    print("=" * 70)
    print(f"\nMode: {'DRY RUN' if dry_run else 'APPLY'}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}Z")
    
    if dry_run:
        print("\n[INFO] This is a DRY RUN. No data will be deleted.")
        print("[INFO] Use --apply with ALLOW_OFC_RESET=YES to apply deletions.")
    else:
        print("\n[WARN] This will DELETE ALL OFCs from CORPUS database!")
        print("[WARN] This action cannot be undone.")
        print("[WARN] Preserved: documents, chunks, sources, questions, taxonomy")
    
    conn = get_corpus_db()
    
    try:
        report = purge_ofcs(conn, dry_run=dry_run)
        
        # Write report
        Path("analytics/reports").mkdir(parents=True, exist_ok=True)
        report_path = Path("analytics/reports/ofc_full_purge_report.json")
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        
        print("\n" + "=" * 70)
        print("PURGE SUMMARY")
        print("=" * 70)
        
        total_deleted = sum(
            info.get("rows_deleted", 0) 
            for info in report["tables_purged"].values() 
            if info.get("exists", False)
        )
        
        print(f"\nTotal rows {'would be deleted' if dry_run else 'deleted'}: {total_deleted}")
        
        for table_name, info in report["tables_purged"].items():
            if info.get("exists"):
                print(f"  {table_name}: {info.get('rows_before', 0)} → {info.get('rows_deleted', 0)}")
        
        if report.get("errors"):
            print("\n[FAIL] Errors encountered:")
            for error in report["errors"]:
                print(f"  - {error}")
            sys.exit(1)
        
        if dry_run:
            print("\n[OK] DRY RUN complete. Review report and use --apply to execute.")
        else:
            print("\n[OK] Purge complete. All OFCs removed from CORPUS database.")
        
        print(f"\n[OK] Report written to: {report_path}")
        
    except Exception as e:
        print(f"\n[FAIL] Purge failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        conn.close()

if __name__ == "__main__":
    main()
