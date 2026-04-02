#!/usr/bin/env python3
"""
Deterministic OFC inference from document intent/findings.

Maps document findings to canonical OFC capabilities using template library.
All inferred OFCs are PENDING and require human approval.
"""
import argparse, json, os, re, sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

RE_SENT_SPLIT = re.compile(r"(?<=[\.\?\!])\s+")
RE_WS = re.compile(r"\s+")

# Rejection rules (from miner)
META_PREAMBLE_MARKERS = [
    "are outlined below", "is outlined below", "outlined below", "as outlined below",
    "the following recommended practices", "recommended practices",
    "are described below", "is described below",
    "this section provides", "this section describes", "the following", "see below"
]

COGNITIVE_PREFIXES = ["understand", "recognize", "be aware", "know", "learn", "remember"]
CONDITIONAL_COGNITIVE_PREFIXES = ["identify", "detect", "notice", "observe", "watch for", "look for"]

AUDITABLE_ANCHORS = [
    "procedure", "procedures", "process", "plan", "plans", "training", "program", "criteria", "guidance",
    "policy", "policies", "defined", "documented", "is defined", "are defined", "exists",
    "is provided", "are provided", "established", "communicated"
]

FORBIDDEN_IMPL = [
    "install", "purchase", "vendor", "model", "brand", "cost", "$", "timeline", "within ", 
    "comply with", "regulation", "statute", "hipaa", "pci", "nist", "cjis"
]

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def norm(s: str) -> str:
    s = (s or "").strip()
    s = RE_WS.sub(" ", s)
    return s

def lower(s: str) -> str:
    return (s or "").lower()

def is_meta_preamble(text: str) -> bool:
    t = lower(norm(text))
    return any(m in t for m in META_PREAMBLE_MARKERS)

def starts_with_any(text: str, prefixes: list) -> bool:
    t = lower(norm(text))
    return any(t.startswith(p) for p in prefixes)

def has_auditable_anchor(text: str) -> bool:
    t = lower(norm(text))
    return any(a in t for a in AUDITABLE_ANCHORS)

def is_state_vulnerability(text: str) -> bool:
    """Reject cognitive/state-vulnerability imperatives unless anchored to auditable capability."""
    t = lower(norm(text))
    if starts_with_any(t, COGNITIVE_PREFIXES) and not has_auditable_anchor(t):
        return True
    if starts_with_any(t, CONDITIONAL_COGNITIVE_PREFIXES) and not has_auditable_anchor(t):
        return True
    return False

def contains_forbidden(s: str) -> Optional[str]:
    t = lower(s)
    for w in FORBIDDEN_IMPL:
        if w in t:
            return w
    return None

def split_sentences(chunk_text: str) -> List[str]:
    raw = norm(chunk_text)
    if not raw:
        return []
    parts = RE_SENT_SPLIT.split(raw)
    return [p.strip() for p in parts if p and p.strip()]

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_corpus_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    die("Missing CORPUS_DATABASE_URL")

def get_runtime_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    die("Missing RUNTIME_DATABASE_URL")

def load_templates() -> List[Dict[str, Any]]:
    template_path = Path("app/lib/corpus/ofc_inference_templates.json")
    if not template_path.exists():
        die(f"Missing template file: {template_path}")
    data = json.loads(template_path.read_text(encoding="utf-8"))
    return data.get("templates", [])

def load_targets() -> Dict[str, Any]:
    p = Path("analytics/reports/ofc_mining_targets.json")
    if not p.exists():
        die("Missing analytics/reports/ofc_mining_targets.json. Run discover_ofc_mining_targets.py first.")
    return json.loads(p.read_text(encoding="utf-8"))

def fetch(cur, sql: str, params: Tuple[Any,...]=()) -> List[Dict[str, Any]]:
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def extract_asset(sentence: str, hints: List[str]) -> str:
    """Extract asset_or_area from sentence using hints, default to 'critical areas'."""
    t = lower(norm(sentence))
    for hint in hints:
        if hint in t:
            # Try to extract a phrase containing the hint
            words = sentence.split()
            for i, word in enumerate(words):
                if hint.lower() in word.lower():
                    # Return a reasonable phrase around the hint
                    start = max(0, i - 2)
                    end = min(len(words), i + 3)
                    extracted = " ".join(words[start:end])
                    if len(extracted) > 5 and len(extracted) < 50:
                        return extracted
            return hint
    return "critical areas"

def resolve_subtype_id(runtime_cur, subtype_code: str) -> Optional[str]:
    """Resolve discipline_subtype_code to UUID."""
    runtime_cur.execute("""
        SELECT id FROM public.discipline_subtypes 
        WHERE code = %s AND is_active = true
    """, (subtype_code,))
    row = runtime_cur.fetchone()
    return str(row[0]) if row else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--source-set", type=str, default=None)
    ap.add_argument("--document-id", type=str, default=None)
    ap.add_argument("--max-chunks", type=int, default=None)
    ap.add_argument("--allow-authority", action="store_true", help="Allow processing AUTHORITY_SOURCE documents (testing only)")
    args = ap.parse_args()
    
    # SAFETY GUARD
    if args.apply and os.environ.get("ALLOW_INFER_APPLY") != "YES":
        die("Inference --apply blocked. Set ALLOW_INFER_APPLY=YES environment variable to enable.")
    
    # Load templates
    templates = load_templates()
    print(f"[INFO] Loaded {len(templates)} inference templates")
    
    # Load schema discovery
    targets = load_targets()
    dest = targets["destination"]
    doc_chunks = targets["document_chunks"]
    
    dest_table = dest["table"]
    chunks_table = doc_chunks["table"]
    chunk_id_col = doc_chunks["chunk_id_col"]
    chunk_text_col = doc_chunks["chunk_text_col"]
    chunk_doc_id_col = doc_chunks["document_id_col"]
    chunk_source_set_col = doc_chunks.get("source_set_col")
    dest_id_col = dest["id_col"]
    dest_text_col = dest["text_col"]
    dest_chunk_fk_col = dest.get("document_chunk_id_col")
    
    corpus_conn = get_corpus_db()
    corpus_cur = corpus_conn.cursor()
    runtime_conn = get_runtime_db()
    runtime_cur = runtime_conn.cursor()
    
    # Check schema
    dest_cols_check = fetch(corpus_cur, f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema='public' AND table_name=%s
    """, (dest_table.replace("public.", ""),))
    dest_cols = {r["column_name"] for r in dest_cols_check}
    has_submitted_by = "submitted_by" in dest_cols
    has_status = "status" in dest_cols
    has_discipline_subtype_id = "discipline_subtype_id" in dest_cols
    needs_source_id = "source_id" in dest_cols
    
    # Check document_role filtering (only OFC_SOURCE documents)
    corpus_cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' 
            AND table_name='corpus_documents'
            AND column_name='document_role'
        )
    """)
    has_document_role = corpus_cur.fetchone()[0]
    
    # Build WHERE clause
    where = []
    params: List[Any] = []
    
    if has_document_role and not args.allow_authority:
        where.append("cd.document_role = 'OFC_SOURCE'")
    
    if args.source_set and chunk_source_set_col:
        where.append(f"dc.{chunk_source_set_col}=%s")
        params.append(args.source_set)
    if args.document_id:
        where.append(f"dc.{chunk_doc_id_col}=%s")
        params.append(args.document_id)
    
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    limit_sql = f"LIMIT {int(args.max_chunks)}" if args.max_chunks else ""
    
    # Query chunks (join to corpus_documents for role filtering)
    # Also join to documents/canonical_sources if we need source_id
    chunk_select_cols = [f"dc.{chunk_id_col}", f"dc.{chunk_text_col}", f"dc.{chunk_doc_id_col}"]
    
    if has_document_role:
        if args.allow_authority:
            # For testing: use LEFT JOIN so we don't filter by role
            join_clause = f"LEFT JOIN public.corpus_documents cd ON dc.{chunk_doc_id_col} = cd.id"
        else:
            # Production: JOIN and filter by OFC_SOURCE
            join_clause = f"JOIN public.corpus_documents cd ON dc.{chunk_doc_id_col} = cd.id"
    else:
        join_clause = ""
        if where_sql:
            where_sql = where_sql.replace("cd.document_role = 'OFC_SOURCE'", "1=1")  # Remove invalid filter
    
    # Add source_id if needed (join to documents -> canonical_sources)
    if needs_source_id:
        chunk_select_cols.append("COALESCE(d.source_id, cs.source_id) as source_id")
        join_clause += f"""
            LEFT JOIN public.documents d ON dc.{chunk_doc_id_col} = d.document_id
            LEFT JOIN public.corpus_documents cd2 ON dc.{chunk_doc_id_col} = cd2.id
            LEFT JOIN public.canonical_sources cs ON (d.file_hash = cs.content_hash OR cd2.file_hash = cs.content_hash)
        """
    
    chunks_query = f"""
        SELECT {', '.join(chunk_select_cols)}
        FROM {chunks_table} dc
        {join_clause}
        {where_sql} {limit_sql}
    """
    
    chunks = fetch(corpus_cur, chunks_query, tuple(params))
    
    if not chunks:
        if has_document_role and not args.allow_authority:
            die("No document_chunks matched the selection. Ensure at least one document has document_role = 'OFC_SOURCE'.")
        else:
            die("No document_chunks matched the selection.")
    
    print(f"[INFO] Processing {len(chunks)} chunks")
    
    # Check existing OFCs for deduplication
    existing_ofcs = set()
    if dest_chunk_fk_col:
        existing_rows = fetch(corpus_cur, f"SELECT {dest_text_col}, {dest_chunk_fk_col} FROM {dest_table} WHERE {dest_chunk_fk_col} IS NOT NULL")
        for r in existing_rows:
            if r[dest_chunk_fk_col] and r[dest_text_col]:
                existing_ofcs.add((str(r[dest_chunk_fk_col]), norm(r[dest_text_col])))
    
    # Process chunks
    matches_by_template = Counter()
    candidates_generated = []
    skipped = Counter()
    chunks_scanned = len(chunks)
    
    # Build subtype_code -> subtype_id mapping
    subtype_code_to_id = {}
    for template in templates:
        code = template.get("discipline_subtype_code")
        if code and code not in subtype_code_to_id:
            subtype_id = resolve_subtype_id(runtime_cur, code)
            if subtype_id:
                subtype_code_to_id[code] = subtype_id
            else:
                print(f"[WARN] Subtype code not found: {code}", file=sys.stderr)
    
    for chunk in chunks:
        chunk_id = str(chunk[chunk_id_col])
        chunk_text = chunk.get(chunk_text_col) or ""
        doc_id = str(chunk[chunk_doc_id_col])
        source_id = chunk.get("source_id") if needs_source_id else None
        
        if not chunk_text:
            skipped["empty_chunk"] += 1
            continue
        
        sentences = split_sentences(chunk_text)
        
        for sentence in sentences:
            if len(sentence) < 40 or len(sentence) > 500:
                continue
            
            # Rejection checks
            if is_meta_preamble(sentence):
                skipped["meta_preamble"] += 1
                continue
            
            if is_state_vulnerability(sentence):
                skipped["state_vulnerability_cognitive"] += 1
                continue
            
            # Check templates for matches
            matched_template = None
            for template in templates:
                triggers = template.get("triggers_any", [])
                sentence_lower = lower(norm(sentence))
                if any(trigger.lower() in sentence_lower for trigger in triggers):
                    matched_template = template
                    break
            
            if not matched_template:
                continue
            
            # Check forbidden words in template output
            asset = extract_asset(sentence, matched_template.get("asset_extraction_hints", []))
            ofc_text = matched_template["ofc_text_template"].format(asset_or_area=asset)
            
            forbidden_word = contains_forbidden(ofc_text)
            if forbidden_word:
                skipped["forbidden_impl_detail"] += 1
                continue
            
            # Check duplicate
            if dest_chunk_fk_col:
                if (chunk_id, norm(ofc_text)) in existing_ofcs:
                    skipped["duplicate"] += 1
                    continue
            
            # Resolve subtype_id
            subtype_code = matched_template.get("discipline_subtype_code")
            subtype_id = subtype_code_to_id.get(subtype_code) if subtype_code else None
            
            if not subtype_id:
                skipped["subtype_not_found"] += 1
                continue
            
            # Generate candidate
            matches_by_template[matched_template["template_id"]] += 1
            candidates_generated.append({
                "template_id": matched_template["template_id"],
                "evidence_sentence": sentence,
                "inferred_ofc": ofc_text,
                "chunk_id": chunk_id,
                "doc_id": doc_id,
                "source_id": source_id,
                "subtype_id": subtype_id,
                "subtype_code": subtype_code,
                "capability_dimension": matched_template.get("capability_dimension")
            })
    
    # Apply if requested
    candidates_inserted = 0
    if args.apply and candidates_generated:
        print(f"[INFO] Inserting {len(candidates_generated)} inferred OFC candidates...")
        
        for candidate in candidates_generated:
            try:
                # Build insert columns
                insert_cols = [dest_text_col, "discipline_subtype_id"]
                insert_vals = [candidate["inferred_ofc"], candidate["subtype_id"]]
                
                if needs_source_id:
                    if not candidate.get("source_id"):
                        skipped["missing_source_id"] += 1
                        continue  # Skip if source_id is required but missing
                    insert_cols.append("source_id")
                    insert_vals.append(candidate["source_id"])
                
                if dest_chunk_fk_col:
                    insert_cols.append(dest_chunk_fk_col)
                    insert_vals.append(candidate["chunk_id"])
                
                if has_submitted_by:
                    insert_cols.append("submitted_by")
                    insert_vals.append("INFERRED")
                
                if has_status:
                    insert_cols.append("status")
                    insert_vals.append("PENDING")
                
                # Insert OFC candidate
                placeholders = ", ".join(["%s"] * len(insert_vals))
                corpus_cur.execute(f"""
                    INSERT INTO {dest_table} ({', '.join(insert_cols)})
                    VALUES ({placeholders})
                    RETURNING {dest_id_col}
                """, tuple(insert_vals))
                
                candidate_id = str(corpus_cur.fetchone()[0])
                candidates_inserted += 1
                
            except Exception as e:
                print(f"[ERROR] Failed to insert candidate: {e}", file=sys.stderr)
                skipped["insert_error"] += 1
        
        corpus_conn.commit()
        print(f"[OK] Inserted {candidates_inserted} candidates")
    
    # Generate report
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "chunks_scanned": chunks_scanned,
        "matches_by_template_id": dict(matches_by_template),
        "candidates_generated": len(candidates_generated),
        "candidates_inserted": candidates_inserted if args.apply else 0,
        "skipped_by_reason": dict(skipped),
        "example_pairs": [
            {
                "evidence_sentence": c["evidence_sentence"][:200],
                "inferred_ofc": c["inferred_ofc"],
                "template_id": c["template_id"]
            }
            for c in candidates_generated[:10]
        ]
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/ofc_inference_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    corpus_cur.close()
    corpus_conn.close()
    runtime_cur.close()
    runtime_conn.close()

if __name__ == "__main__":
    main()
