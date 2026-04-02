#!/usr/bin/env python3
"""
Normalize Mined OFCs

Post-mining normalization to prepare candidates for human review:
- Generate deterministic titles from OFC text
- Pre-assign discipline_subtype_id when confidence is high (≥80%)
- Flag duplicates

NO auto-approval. Status remains PENDING.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

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

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def get_corpus_db():
    """Get CORPUS database connection."""
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = corpus_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            die(f"Could not parse project_ref from CORPUS_URL: {corpus_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    die("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def get_runtime_db():
    """Get RUNTIME database connection (for discipline_subtypes)."""
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and runtime_password:
        clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = runtime_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            die(f"Could not parse project_ref from RUNTIME_URL: {runtime_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    die("Missing RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD.")

def load_targets() -> Dict[str, Any]:
    """Load mining targets configuration."""
    p = Path("analytics/reports/ofc_mining_targets.json")
    if not p.exists():
        die("Missing analytics/reports/ofc_mining_targets.json. Run discover_ofc_mining_targets.py first.")
    return json.loads(p.read_text(encoding="utf-8"))

def normalize_text(s: str) -> str:
    """Normalize text for hashing."""
    s = (s or "").strip().lower()
    s = re.sub(r'\s+', ' ', s)
    return s

def hash_ofc_text(text: str) -> str:
    """Compute deterministic hash of normalized OFC text."""
    normalized = normalize_text(text)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]

# Boilerplate prefixes to remove
BOILERPLATE_PREFIXES = [
    "an option for consideration is to ensure that",
    "an option for consideration is to",
    "consider",
    "it is recommended that",
    "it is recommended to"
]

def remove_boilerplate(text: str) -> str:
    """Remove leading boilerplate phrases."""
    text_lower = text.lower().strip()
    for prefix in BOILERPLATE_PREFIXES:
        if text_lower.startswith(prefix):
            # Remove prefix and capitalize first letter
            remaining = text[len(prefix):].strip()
            if remaining:
                remaining = remaining[0].upper() + remaining[1:] if len(remaining) > 1 else remaining.upper()
            return remaining
    return text.strip()

def extract_noun_phrase(text: str, max_words: int = 12) -> str:
    """
    Extract first strong noun phrase from text.
    Simple heuristic: find first sequence of capitalized words or important nouns.
    """
    # Remove boilerplate first
    cleaned = remove_boilerplate(text)
    
    # Split into sentences
    sentences = re.split(r'[.!?]\s+', cleaned)
    if not sentences:
        return cleaned[:100]  # Fallback
    
    first_sent = sentences[0]
    
    # Try to find a meaningful noun phrase (8-12 words)
    words = first_sent.split()
    
    # If sentence is short enough, use it
    if len(words) <= max_words:
        # Capitalize first letter
        result = ' '.join(words)
        if result:
            result = result[0].upper() + result[1:] if len(result) > 1 else result.upper()
        return result
    
    # Take first max_words words
    phrase = ' '.join(words[:max_words])
    # Capitalize first letter
    if phrase:
        phrase = phrase[0].upper() + phrase[1:] if len(phrase) > 1 else phrase.upper()
    return phrase

def generate_title(ofc_text: str) -> str:
    """
    Generate deterministic title from OFC text.
    - Extract first strong noun phrase
    - Limit to 8-12 words
    - Remove boilerplate
    """
    if not ofc_text or not ofc_text.strip():
        return "Untitled OFC"
    
    title = extract_noun_phrase(ofc_text, max_words=12)
    
    # Ensure minimum length
    if len(title) < 8:
        # Fallback: use first 60 chars
        title = ofc_text[:60].strip()
        if title:
            title = title[0].upper() + title[1:] if len(title) > 1 else title.upper()
    
    # Clean up trailing punctuation
    title = re.sub(r'[.,;:]+$', '', title)
    
    return title.strip()

def fetch_rows(cur, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    """Fetch rows as dictionaries."""
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def main():
    ap = argparse.ArgumentParser(description="Normalize mined OFCs: generate titles, assign subtypes, flag duplicates")
    ap.add_argument("--apply", action="store_true", help="Apply changes to database (default: dry run)")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of OFCs to process")
    args = ap.parse_args()
    
    targets = load_targets()
    dest = targets["destination"]
    dest_table = dest["table"]
    dest_id_col = dest["id_col"]
    dest_text_col = dest["text_col"]
    
    corpus_conn = get_corpus_db()
    corpus_cur = corpus_conn.cursor()
    
    runtime_conn = get_runtime_db()
    runtime_cur = runtime_conn.cursor()
    
    # Check if title column exists, add if missing
    corpus_cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s AND column_name='title'
    """, (dest_table.replace("public.", ""),))
    has_title_col = corpus_cur.fetchone() is not None
    
    if not has_title_col and args.apply:
        print("[INFO] Adding title column to candidate table...")
        try:
            corpus_cur.execute(f"""
                ALTER TABLE {dest_table} ADD COLUMN title TEXT NULL
            """)
            corpus_conn.commit()
            has_title_col = True
            print("[OK] Title column added")
        except Exception as e:
            print(f"[WARN] Could not add title column: {e}")
            corpus_conn.rollback()
    
    # Check if discipline_subtype_id column exists, add if missing
    corpus_cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s AND column_name='discipline_subtype_id'
    """, (dest_table.replace("public.", ""),))
    has_subtype_col = corpus_cur.fetchone() is not None
    
    if not has_subtype_col and args.apply:
        print("[INFO] Adding discipline_subtype_id column to candidate table...")
        try:
            corpus_cur.execute(f"""
                ALTER TABLE {dest_table} ADD COLUMN discipline_subtype_id UUID NULL
            """)
            corpus_conn.commit()
            has_subtype_col = True
            print("[OK] discipline_subtype_id column added")
        except Exception as e:
            print(f"[WARN] Could not add discipline_subtype_id column: {e}")
            corpus_conn.rollback()
    
    # Load all candidates
    limit_sql = f"LIMIT {args.limit}" if args.limit else ""
    candidates = fetch_rows(corpus_cur, f"""
        SELECT {dest_id_col}, {dest_text_col}, document_chunk_id, source_id
        FROM {dest_table}
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        {limit_sql}
    """)
    
    if not candidates:
        print("[INFO] No PENDING candidates found.")
        corpus_cur.close()
        corpus_conn.close()
        runtime_cur.close()
        runtime_conn.close()
        return
    
    print(f"[INFO] Processing {len(candidates)} candidates...")
    
    # Load discipline_subtypes for validation
    subtype_map: Dict[str, str] = {}  # code -> id
    if has_subtype_col:
        subtypes = fetch_rows(runtime_cur, """
            SELECT id, code FROM public.discipline_subtypes
        """)
        subtype_map = {s["code"]: str(s["id"]) for s in subtypes}
    
    # Track statistics
    titles_generated = 0
    subtypes_assigned = 0
    duplicates_detected: Dict[str, List[str]] = defaultdict(list)  # hash -> [candidate_ids]
    skipped_reasons = Counter()
    
    # Process each candidate
    for cand in candidates:
        cand_id = str(cand[dest_id_col])
        ofc_text = cand.get(dest_text_col) or ""
        
        if not ofc_text or len(ofc_text.strip()) < 10:
            skipped_reasons["empty_text"] += 1
            continue
        
        # 1) Generate title if missing
        title = None
        if has_title_col:
            corpus_cur.execute(f"""
                SELECT title FROM {dest_table} WHERE {dest_id_col} = %s
            """, (cand_id,))
            row = corpus_cur.fetchone()
            existing_title = row[0] if row and row[0] else None
            
            if not existing_title or (existing_title and existing_title.strip() == ""):
                title = generate_title(ofc_text)
                if args.apply:
                    corpus_cur.execute(f"""
                        UPDATE {dest_table} SET title = %s WHERE {dest_id_col} = %s
                    """, (title, cand_id))
                titles_generated += 1
        
        # 2) Detect duplicates (hash-based)
        text_hash = hash_ofc_text(ofc_text)
        duplicates_detected[text_hash].append(cand_id)
        
        # 3) Subtype assignment
        # Since candidates aren't directly linked to questions yet (linker uses canonical_ofcs),
        # we can't use the "≥80% of linked questions" rule.
        # For now, leave subtype_id as NULL - it will be assigned during review or after promotion.
        # Future enhancement: could infer from document context or citation metadata
        
    if args.apply:
        corpus_conn.commit()
    
    # Build report
    duplicate_groups = {h: ids for h, ids in duplicates_detected.items() if len(ids) > 1}
    
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "total_ofcs_scanned": len(candidates),
        "titles_generated": titles_generated,
        "subtypes_assigned": subtypes_assigned,
        "duplicates_detected": {
            "total_duplicate_groups": len(duplicate_groups),
            "total_duplicate_candidates": sum(len(ids) for ids in duplicate_groups.values()),
            "duplicate_groups": [
                {
                    "hash": h,
                    "candidate_ids": ids[:10],  # Limit to first 10 per group
                    "count": len(ids)
                }
                for h, ids in list(duplicate_groups.items())[:50]  # Limit to 50 groups
            ]
        },
        "skipped_reason_counts": dict(skipped_reasons),
        "columns_available": {
            "title": has_title_col,
            "discipline_subtype_id": has_subtype_col
        }
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/ofc_normalization_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    
    print("\n" + "=" * 70)
    print("OFC Normalization Report")
    print("=" * 70)
    print(f"\nCandidates scanned: {len(candidates)}")
    print(f"Titles generated: {titles_generated}")
    print(f"Subtypes assigned: {subtypes_assigned}")
    print(f"Duplicate groups: {len(duplicate_groups)}")
    print(f"Total duplicate candidates: {sum(len(ids) for ids in duplicate_groups.values())}")
    print(f"\nSkipped reasons: {dict(skipped_reasons)}")
    print(f"\n[OK] Wrote analytics/reports/ofc_normalization_report.json")
    
    corpus_cur.close()
    corpus_conn.close()
    runtime_cur.close()
    runtime_conn.close()

if __name__ == "__main__":
    main()
