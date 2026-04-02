#!/usr/bin/env python3
"""
Canonicalize OFC Phrasing

De-boilerplate mined OFCs by removing redundant lead-ins while preserving:
- PSA doctrine
- Deterministic behavior
- Review safety
- WHAT-level capability framing

Operates ONLY on mined OFCs in PENDING status.
"""

import argparse
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

def load_targets() -> Dict[str, Any]:
    """Load mining targets configuration."""
    p = Path("analytics/reports/ofc_mining_targets.json")
    if not p.exists():
        die("Missing analytics/reports/ofc_mining_targets.json. Run discover_ofc_mining_targets.py first.")
    return json.loads(p.read_text(encoding="utf-8"))

def normalize_text(s: str) -> str:
    """Normalize text for comparison."""
    s = (s or "").strip().lower()
    s = re.sub(r'\s+', ' ', s)
    return s

# Boilerplate prefixes to remove (ordered by length, longest first)
BOILERPLATE_PREFIXES = [
    "an option for consideration is to ensure that",
    "an option for consideration is to",
    "consider ensuring that",
    "consider",
    "it is recommended that",
    "it is recommended to",
    "it is suggested that",
    "it is suggested to"
]

# Capability verbs that must remain after stripping
CAPABILITY_VERBS = [
    " is ", " are ", " includes ", " provides ", " maintains ", 
    " ensures ", " requires ", " establishes ", " implements ",
    " has ", " have ", " supports ", " enables ", " facilitates "
]

def has_capability_verb(text: str) -> bool:
    """Check if text contains a capability assertion verb."""
    text_lower = text.lower()
    return any(verb in text_lower for verb in CAPABILITY_VERBS)

def remove_boilerplate(text: str) -> Optional[str]:
    """
    Remove redundant lead-in boilerplate.
    Returns None if canonicalization would break the sentence.
    """
    if not text or not text.strip():
        return None
    
    text_lower = text.lower().strip()
    original = text.strip()
    
    # Try each boilerplate prefix (longest first)
    for prefix in BOILERPLATE_PREFIXES:
        if text_lower.startswith(prefix):
            # Remove prefix (case-insensitive match)
            prefix_len = len(prefix)
            remaining = original[prefix_len:].strip()
            
            # Remove leading "that" if present
            if remaining.lower().startswith("that "):
                remaining = remaining[5:].strip()
            
            # Remove any leading whitespace/newlines (multiple passes to handle all whitespace)
            remaining = remaining.lstrip()
            
            # Capitalize first letter
            if remaining:
                remaining = remaining[0].upper() + remaining[1:] if len(remaining) > 1 else remaining.upper()
            else:
                return None  # Nothing left after stripping
            
            # Validate: must still have a capability verb
            if not has_capability_verb(remaining):
                return None  # Skip - would break capability assertion
            
            # Validate: length constraints
            if len(remaining) < 40 or len(remaining) > 400:
                return None  # Skip - length constraint
            
            return remaining
    
    # No boilerplate found - return original
    return original

# Forbidden implementation detail markers (from mining script)
FORBIDDEN_IMPL = [
    "install", "purchase", "vendor", "model", "brand", "cost", "$", 
    "timeline", "within ", "comply with", "regulation", "statute",
    "hipaa", "pci", "nist", "cjis"
]

VULNERABILITY_MARKERS = [
    " is limited", " are limited",
    " is lacking", " are lacking",
    " is insufficient", " are insufficient",
    " is inadequate", " are inadequate",
    " is not sufficient", " are not sufficient",
    " lacks ", " lack ",
    " missing ", " absent ",
    " does not have ", " do not have ",
    " no ",  # will be applied carefully (see function)
    " unable to ", " cannot ",
    " gap", " deficiency", " vulnerability", " weakness", " shortfall"
]

# Meta/preamble scaffolding that is not an OFC
META_PREAMBLE_MARKERS = [
    "are outlined below",
    "is outlined below",
    "outlined below",
    "as outlined below",
    "the following recommended practices",
    "recommended practices",
    "are described below",
    "is described below",
    "the following",
    "see below",
    "in the section below",
    "this section provides",
    "this section describes"
]

def contains_forbidden(text: str) -> bool:
    """Check if text contains forbidden implementation detail markers."""
    text_lower = text.lower()
    return any(marker in text_lower for marker in FORBIDDEN_IMPL)

def is_meta_preamble(text: str) -> bool:
    t = normalize_text(text)
    return any(m in t for m in META_PREAMBLE_MARKERS)

def is_vulnerability_statement(text: str) -> bool:
    """
    Reject statements that read like a deficiency/finding rather than a capability.
    We keep this conservative: only strong markers.
    """
    t = normalize_text(" " + text + " ")

    # Strong meta finding words
    if any(w in t for w in [" vulnerability", " weakness", " deficiency", " shortfall", " gap"]):
        return True

    # Strong deficiency constructions
    if any(m in t for m in VULNERABILITY_MARKERS):
        # Special-case: avoid rejecting legitimate "no unauthorized access" type phrases
        # We only treat " no " as vulnerability if paired with a capability noun (e.g., "no cctv", "no lighting")
        if " no " in t:
            cap_nouns = ["cctv","camera","surveillance","lighting","alarm","detection","fence","gate","guard","screening","plan","procedure","training"]
            if any((" no " + n) in t for n in cap_nouns):
                return True
            # otherwise do not trigger on generic "no"
            return False
        return True

    return False

def fetch_rows(cur, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    """Fetch rows as dictionaries."""
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def main():
    ap = argparse.ArgumentParser(description="Canonicalize mined OFC phrasing: remove boilerplate lead-ins")
    ap.add_argument("--apply", action="store_true", help="Apply changes to database (default: dry run)")
    ap.add_argument("--limit", type=int, default=None, help="Limit number of OFCs to process")
    args = ap.parse_args()
    
    targets = load_targets()
    dest = targets["destination"]
    dest_table = dest["table"]
    dest_id_col = dest["id_col"]
    dest_text_col = dest["text_col"]
    
    conn = get_corpus_db()
    cur = conn.cursor()
    
    # Load mined candidates (status='PENDING')
    # Mined candidates are identified by:
    # 1. Having the boilerplate prefix "An option for consideration is to ensure that"
    # 2. Or being in PENDING status (since mining creates PENDING candidates)
    limit_sql = f"LIMIT {args.limit}" if args.limit else ""
    
    candidates = fetch_rows(cur, f"""
        SELECT {dest_id_col}, {dest_text_col}, document_chunk_id
        FROM {dest_table}
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        {limit_sql}
    """)
    
    if not candidates:
        print("[INFO] No mined PENDING candidates found.")
        cur.close()
        conn.close()
        return
    
    print(f"[INFO] Processing {len(candidates)} mined candidates...")
    
    # Track statistics
    modified_count = 0
    skipped_reasons = Counter()
    examples_before_after: List[Dict[str, str]] = []
    
    # Check for existing normalized text to avoid duplicates
    existing_normalized: Dict[str, set] = defaultdict(set)  # chunk_id -> {normalized_texts}
    if dest.get("document_chunk_id_col"):
        chunk_col = dest["document_chunk_id_col"]
        existing = fetch_rows(cur, f"""
            SELECT {chunk_col}, {dest_text_col}
            FROM {dest_table}
            WHERE {chunk_col} IS NOT NULL
        """)
        for row in existing:
            chunk_id = str(row[chunk_col]) if row[chunk_col] else None
            text = row[dest_text_col] or ""
            if chunk_id and text:
                existing_normalized[chunk_id].add(normalize_text(text))
    
    # Process each candidate
    for cand in candidates:
        cand_id = str(cand[dest_id_col])
        original_text = cand.get(dest_text_col) or ""
        chunk_id = str(cand.get("document_chunk_id")) if cand.get("document_chunk_id") else None
        
        if not original_text or len(original_text.strip()) < 10:
            skipped_reasons["empty_text"] += 1
            continue
        
        # Check if already canonicalized (doesn't start with boilerplate)
        text_lower = original_text.lower().strip()
        has_boilerplate = any(text_lower.startswith(prefix) for prefix in BOILERPLATE_PREFIXES)
        
        if not has_boilerplate:
            skipped_reasons["no_boilerplate"] += 1
            continue
        
        # Attempt canonicalization
        canonicalized = remove_boilerplate(original_text)
        
        if not canonicalized:
            skipped_reasons["canonicalization_failed"] += 1
            continue
        
        # Check if canonicalized text becomes meta/preamble or vulnerability after stripping boilerplate
        if is_meta_preamble(canonicalized):
            skipped_reasons["meta_preamble"] += 1
            continue
        
        if is_vulnerability_statement(canonicalized):
            skipped_reasons["vulnerability_finding"] += 1
            continue
        
        # Safety checks
        if len(canonicalized) < 40 or len(canonicalized) > 400:
            skipped_reasons["length_constraint"] += 1
            continue
        
        if contains_forbidden(canonicalized):
            skipped_reasons["forbidden_term"] += 1
            continue
        
        # Check for duplicate within same chunk
        if chunk_id and chunk_id in existing_normalized:
            normalized_canon = normalize_text(canonicalized)
            if normalized_canon in existing_normalized[chunk_id]:
                skipped_reasons["duplicate_in_chunk"] += 1
                continue
        
        # All checks passed - apply canonicalization
        if args.apply:
            cur.execute(f"""
                UPDATE {dest_table} 
                SET {dest_text_col} = %s 
                WHERE {dest_id_col} = %s
            """, (canonicalized, cand_id))
            
            # Update existing_normalized for duplicate checking
            if chunk_id:
                existing_normalized[chunk_id].add(normalize_text(canonicalized))
        
        modified_count += 1
        
        # Collect examples (max 10)
        if len(examples_before_after) < 10:
            examples_before_after.append({
                "candidate_id": cand_id,
                "before": original_text[:200],
                "after": canonicalized[:200]
            })
    
    if args.apply:
        conn.commit()
    
    # Build report
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "scanned_ofcs": len(candidates),
        "modified_ofcs": modified_count,
        "skipped_ofcs_by_reason": dict(skipped_reasons),
        "examples_before_after": examples_before_after
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/ofc_canonicalization_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    
    print("\n" + "=" * 70)
    print("OFC Phrasing Canonicalization Report")
    print("=" * 70)
    print(f"\nCandidates scanned: {len(candidates)}")
    print(f"Modified: {modified_count}")
    print(f"Skipped: {sum(skipped_reasons.values())}")
    print(f"\nSkipped reasons:")
    for reason, count in skipped_reasons.most_common():
        print(f"  {reason}: {count}")
    
    if examples_before_after:
        print(f"\nExamples (first {len(examples_before_after)}):")
        for i, ex in enumerate(examples_before_after[:5], 1):
            print(f"\n  Example {i}:")
            print(f"    BEFORE: {ex['before']}")
            print(f"    AFTER:  {ex['after']}")
    
    print(f"\n[OK] Wrote analytics/reports/ofc_canonicalization_report.json")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
