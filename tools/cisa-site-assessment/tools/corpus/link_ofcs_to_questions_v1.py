#!/usr/bin/env python3
import argparse, json, math, os, re, sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Deterministic text normalization
RE_PUNCT = re.compile(r"[^a-z0-9\s]+")
RE_WS = re.compile(r"\s+")

STOPWORDS = {
    "the","a","an","and","or","to","of","in","for","on","with","by","as","at","from","into",
    "is","are","be","been","being","that","this","these","those","it","its","their","they",
    "must","should","may","can","will","shall","ensure","consider","option","consideration"
}

def norm_text(s: str) -> str:
    s = (s or "").lower()
    s = RE_PUNCT.sub(" ", s)
    s = RE_WS.sub(" ", s).strip()
    return s

def tokens(s: str) -> List[str]:
    t = [w for w in norm_text(s).split(" ") if w and w not in STOPWORDS and len(w) >= 3]
    return t

def bigrams(toks: List[str]) -> List[str]:
    return [toks[i] + "_" + toks[i+1] for i in range(len(toks)-1)]

def jaccard(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0

# Minimal BM25 (deterministic)
@dataclass
class BM25Index:
    docs_tokens: List[List[str]]
    doc_freq: Dict[str, int]
    avgdl: float
    k1: float = 1.5
    b: float = 0.75

def build_bm25(docs_tokens: List[List[str]]) -> BM25Index:
    df = Counter()
    lengths = []
    for dt in docs_tokens:
        lengths.append(len(dt))
        for w in set(dt):
            df[w] += 1
    avgdl = sum(lengths)/len(lengths) if lengths else 0.0
    return BM25Index(docs_tokens=docs_tokens, doc_freq=dict(df), avgdl=avgdl)

def bm25_score(idx: BM25Index, query_tokens: List[str], doc_tokens: List[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    tf = Counter(doc_tokens)
    score = 0.0
    N = len(idx.docs_tokens)
    dl = len(doc_tokens)
    for w in query_tokens:
        n_q = idx.doc_freq.get(w, 0)
        if n_q == 0:
            continue
        idf = math.log(1 + (N - n_q + 0.5) / (n_q + 0.5))
        f = tf.get(w, 0)
        if f == 0:
            continue
        denom = f + idx.k1 * (1 - idx.b + idx.b * (dl / (idx.avgdl or 1.0)))
        score += idf * (f * (idx.k1 + 1)) / (denom or 1.0)
    return score

# TF-IDF cosine (deterministic, no sklearn dependency required)
@dataclass
class TFIDFIndex:
    vocab: Dict[str, int]
    idf: List[float]
    doc_vecs: List[Dict[int, float]]

def build_tfidf(docs_tokens: List[List[str]]) -> TFIDFIndex:
    df = Counter()
    for dt in docs_tokens:
        for w in set(dt):
            df[w] += 1
    vocab = {w:i for i,(w,_) in enumerate(df.items())}
    N = len(docs_tokens)
    idf = [0.0]*len(vocab)
    for w, i in vocab.items():
        idf[i] = math.log((N + 1) / (df[w] + 1)) + 1.0

    doc_vecs: List[Dict[int, float]] = []
    for dt in docs_tokens:
        tf = Counter(dt)
        vec = {}
        for w, c in tf.items():
            i = vocab.get(w)
            if i is None:
                continue
            vec[i] = (c / len(dt)) * idf[i]
        # l2 normalize
        norm = math.sqrt(sum(v*v for v in vec.values())) or 1.0
        vec = {i:v/norm for i,v in vec.items()}
        doc_vecs.append(vec)
    return TFIDFIndex(vocab=vocab, idf=idf, doc_vecs=doc_vecs)

def tfidf_query_vec(q_tokens: List[str], idx: TFIDFIndex) -> Dict[int, float]:
    tf = Counter(q_tokens)
    vec = {}
    for w, c in tf.items():
        i = idx.vocab.get(w)
        if i is None:
            continue
        vec[i] = (c / len(q_tokens or [1])) * idx.idf[i]
    norm = math.sqrt(sum(v*v for v in vec.values())) or 1.0
    return {i:v/norm for i,v in vec.items()}

def cosine_sparse(a: Dict[int, float], b: Dict[int, float]) -> float:
    if not a or not b:
        return 0.0
    # iterate smaller
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(i, 0.0) for i, v in a.items())

# DB access — reuse your existing tooling connection style
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

def get_runtime_db():
    """Get RUNTIME database connection (for questions and OFCs)."""
    import psycopg2  # type: ignore
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    # Try direct RUNTIME_DATABASE_URL first
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    # Fallback to SUPABASE_RUNTIME_URL + password pattern
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and runtime_password:
        clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
        url = urlparse(runtime_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            # Try direct port
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD.")

def get_corpus_db():
    """Get CORPUS database connection (for citations and chunks)."""
    import psycopg2  # type: ignore
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    # Try direct CORPUS_DATABASE_URL first
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    # Fallback to SUPABASE_CORPUS_URL + password pattern
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
            # Try direct port
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def read_schema_discovery() -> Dict[str, Any]:
    p = Path("analytics/reports/ofc_link_schema_discovery.json")
    if not p.exists():
        raise SystemExit("Missing analytics/reports/ofc_link_schema_discovery.json. Run discover_linking_schema.py first.")
    return json.loads(p.read_text(encoding="utf-8"))

def fetch_rows(conn, sql: str, params: Tuple[Any, ...]=()) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    out = []
    for row in cur.fetchall():
        out.append({cols[i]: row[i] for i in range(len(cols))})
    cur.close()
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topn", type=int, default=10)
    ap.add_argument("--promote-threshold", type=float, default=0.25)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--apply-suggested", action="store_true")
    ap.add_argument("--allow-reserve", action="store_true")
    # Default: require_subtype_match = True
    # Use --no-require-subtype-match to disable
    ap.add_argument("--no-require-subtype-match", dest="require_subtype_match", action="store_false")
    ap.add_argument("--calibrate", action="store_true", help="Compute score distributions for eligible pairs and recommend thresholds (no DB writes)")
    ap.set_defaults(require_subtype_match=True)
    args = ap.parse_args()

    schema = read_schema_discovery()
    qtbl = schema["selected_question_table"]["name"]
    otbl = schema["selected_ofc_table"]["name"]
    ctbl = schema["selected_citation_table"]["name"]
    ltbl = schema.get("selected_link_table") or {}
    ltbl = ltbl.get("name") if isinstance(ltbl, dict) else None

    q_id_col = schema["selected_question_table"]["question_id_col"]
    q_text_col = schema["selected_question_table"]["question_text_col"]
    q_subtype_col = schema["selected_question_table"].get("subtype_col")

    o_id_col = schema["selected_ofc_table"]["ofc_id_col"]
    o_text_col = schema["selected_ofc_table"]["ofc_text_col"]
    o_subtype_col = schema["selected_ofc_table"].get("subtype_col")

    citation_ofc_id_col = schema["selected_citation_table"]["ofc_id_col"]
    
    # Determine which DBs to use
    databases = schema.get("databases", {})
    ofc_db = databases.get("ofcs", "RUNTIME")
    citation_db = databases.get("citations", "RUNTIME")

    # Questions are in RUNTIME
    runtime_conn = get_runtime_db()
    
    # OFCs and citations may be in CORPUS (for mined candidates)
    ofc_conn = get_corpus_db() if ofc_db == "CORPUS" else runtime_conn
    
    # Questions - prefer discipline_subtype_id, fallback to subtype_code
    q_cols = [q_id_col, q_text_col]
    q_subtype_id_col = None
    q_subtype_code_col = None
    
    # Check for discipline_subtype_id (UUID) first
    if q_subtype_col == "discipline_subtype_id":
        q_subtype_id_col = q_subtype_col
        q_cols.append(q_subtype_id_col)
    elif q_subtype_col:
        # If we have subtype_code, we'll need to map it
        q_subtype_code_col = q_subtype_col
        q_cols.append(q_subtype_code_col)
    
    # Also check if both columns exist (for migration period)
    question_cols = fetch_rows(runtime_conn, f"""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = %s
    """, (qtbl.replace("public.", ""),))
    available_cols = {r["column_name"] for r in question_cols}
    
    if "discipline_subtype_id" in available_cols and q_subtype_id_col is None:
        q_subtype_id_col = "discipline_subtype_id"
        q_cols.append(q_subtype_id_col)
    if "subtype_code" in available_cols and q_subtype_code_col is None and q_subtype_id_col is None:
        q_subtype_code_col = "subtype_code"
        q_cols.append(q_subtype_code_col)
    
    questions = fetch_rows(runtime_conn, f"SELECT {', '.join(q_cols)} FROM {qtbl};")
    
    # Build code->id mapping if we need to convert subtype_code to discipline_subtype_id
    subtype_code_to_id = {}
    if q_subtype_code_col and not q_subtype_id_col:
        # Load mapping from discipline_subtypes
        mapping_rows = fetch_rows(runtime_conn, """
            SELECT code, id 
            FROM public.discipline_subtypes 
            WHERE code IS NOT NULL
        """)
        subtype_code_to_id = {r["code"]: str(r["id"]) for r in mapping_rows}
    
    # Normalize questions: ensure all have discipline_subtype_id (UUID) if possible
    for q in questions:
        if q_subtype_id_col and q.get(q_subtype_id_col):
            # Already has UUID
            q["_discipline_subtype_id"] = str(q[q_subtype_id_col])
        elif q_subtype_code_col and q.get(q_subtype_code_col):
            # Convert code to UUID
            code = q[q_subtype_code_col]
            q["_discipline_subtype_id"] = subtype_code_to_id.get(code)
        else:
            q["_discipline_subtype_id"] = None

    # OFCs (may be in CORPUS for mined candidates)
    # Check for optional columns for external verification
    oinfo = schema["selected_ofc_table"]
    submitted_by_col = oinfo.get("submitted_by_col")
    source_registry_id_col = oinfo.get("source_registry_id_col")
    source_id_col = oinfo.get("source_id_col")
    
    o_cols = [o_id_col, o_text_col]
    if o_subtype_col:
        o_cols.append(o_subtype_col)
    if submitted_by_col:
        o_cols.append(submitted_by_col)
    if source_registry_id_col:
        o_cols.append(source_registry_id_col)
    if source_id_col:
        o_cols.append(source_id_col)
    
    # Check for status column
    o_status_col = None
    available_cols = {c["column_name"] for c in fetch_rows(ofc_conn, f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema='public' AND table_name=%s
    """, (otbl.replace("public.", ""),))}
    if "status" in available_cols:
        o_status_col = "status"
        o_cols.append(o_status_col)
    
    ofcs = fetch_rows(ofc_conn, f"SELECT {', '.join(o_cols)} FROM {otbl};")
    
    # Normalize OFCs: ensure discipline_subtype_id is string
    for o in ofcs:
        if o_subtype_col and o.get(o_subtype_col):
            o["_discipline_subtype_id"] = str(o[o_subtype_col])
        else:
            o["_discipline_subtype_id"] = None

    if not questions or not ofcs:
        runtime_conn.close()
        raise SystemExit(f"FAIL: questions={len(questions)} ofcs={len(ofcs)}; cannot link.")

    # Citation-bound set (OFCs with at least 1 citation row) - citations may be in CORPUS
    # Check if citations use direct FK (document_chunk_id column in OFC table)
    citation_info = schema.get("selected_citation_table", {})
    use_direct_fk = citation_info.get("use_direct_fk", False)
    
    citation_conn = None  # Initialize for cleanup later
    if use_direct_fk:
        # Citations are bound via document_chunk_id column directly in OFC table
        chunk_fk_col = citation_info.get("chunk_fk_col", "document_chunk_id")
        cited_rows = fetch_rows(ofc_conn, f"SELECT DISTINCT {o_id_col} FROM {otbl} WHERE {chunk_fk_col} IS NOT NULL;")
        cited_ofc_ids = set(str(r[o_id_col]) for r in cited_rows if r.get(o_id_col) is not None)
    else:
        # Citations are in separate table
        citation_conn = get_corpus_db() if citation_db == "CORPUS" else runtime_conn
        cited_rows = fetch_rows(citation_conn, f"SELECT DISTINCT {citation_ofc_id_col} FROM {ctbl};")
        cited_ofc_ids = set(str(r[citation_ofc_id_col]) for r in cited_rows if r.get(citation_ofc_id_col) is not None)
    
    # External verification set (IST OFCs with source_registry_id + source_id + ACTIVE status)
    external_verified_ofc_ids = set()
    source_registry_info = schema.get("selected_source_registry")
    if source_registry_info and source_registry_id_col and source_id_col:
        # Check which OFCs have both source_registry_id and source_id
        ofcs_with_sources = [
            o for o in ofcs
            if o.get(source_registry_id_col) and o.get(source_id_col)
        ]
        
        if ofcs_with_sources:
            # Get unique source_registry_ids to check
            source_registry_ids = set(
                str(o[source_registry_id_col])
                for o in ofcs_with_sources
                if o.get(source_registry_id_col)
            )
            
            if source_registry_ids:
                # Check source_registry status in CORPUS
                corpus_conn_for_sr = get_corpus_db()
                sr_table = source_registry_info["name"]
                has_status = source_registry_info.get("has_status_column", False)
                
                if has_status:
                    # Check for ACTIVE status
                    sr_rows = fetch_rows(corpus_conn_for_sr, f"""
                        SELECT id FROM {sr_table}
                        WHERE id = ANY(%s::uuid[]) AND status = 'ACTIVE'
                    """, (list(source_registry_ids),))
                else:
                    # No status column - treat all existing sources as active
                    sr_rows = fetch_rows(corpus_conn_for_sr, f"""
                        SELECT id FROM {sr_table}
                        WHERE id = ANY(%s::uuid[])
                    """, (list(source_registry_ids),))
                
                active_source_registry_ids = set(str(r["id"]) for r in sr_rows)
                
                # Mark OFCs as externally verified if they have active source_registry
                for o in ofcs_with_sources:
                    sr_id = str(o[source_registry_id_col]) if o.get(source_registry_id_col) else None
                    if sr_id in active_source_registry_ids:
                        external_verified_ofc_ids.add(str(o[o_id_col]))
                
                corpus_conn_for_sr.close()
    
    # If citation table uses different OFC ID column than OFC table, we need to map
    # For now, assume they match or citation table has the same ID format

    # Pre-load subtype_id -> discipline_id mapping for hard gates
    subtype_to_discipline = {}
    try:
        subtype_rows = fetch_rows(runtime_conn, """
            SELECT id, discipline_id 
            FROM public.discipline_subtypes
        """)
        subtype_to_discipline = {str(r["id"]): str(r["discipline_id"]) for r in subtype_rows}
    except Exception as e:
        print(f"[WARN] Could not load subtype->discipline mapping: {e}", file=sys.stderr)
    
    # Also add discipline_id to questions if available
    if "discipline_id" in available_cols and "discipline_id" not in q_cols:
        q_cols.append("discipline_id")
        questions = fetch_rows(runtime_conn, f"SELECT {', '.join(q_cols)} FROM {qtbl};")
    
    # Add discipline_id to questions from subtype mapping if missing
    for q in questions:
        q_subtype_id = q.get("_discipline_subtype_id")
        if q_subtype_id and not q.get("discipline_id"):
            q["discipline_id"] = subtype_to_discipline.get(q_subtype_id)
    
    # Build indexes
    ofc_tokens = [tokens(r[o_text_col]) for r in ofcs]
    bm25 = build_bm25(ofc_tokens)
    tfidf = build_tfidf(ofc_tokens)
    ofc_bigrams = [bigrams(t) for t in ofc_tokens]

    # Precompute BM25 normalization per query by max score across corpus (for stable combination)
    # We'll normalize bm25 per question to [0,1] by dividing by max for that query.
    def score_question(qrow: Dict[str, Any]) -> Dict[str, Any]:
        qid = qrow[q_id_col]
        qtxt = qrow[q_text_col] or ""
        qtoks = tokens(qtxt)
        qbis = bigrams(qtoks)
        qvec = tfidf_query_vec(qtoks, tfidf)

        raw_bm25 = [bm25_score(bm25, qtoks, dt) for dt in ofc_tokens]
        max_b = max(raw_bm25) if raw_bm25 else 1.0
        bm25_norm = [(v / (max_b or 1.0)) for v in raw_bm25]

        tfidf_scores = [cosine_sparse(qvec, tfidf.doc_vecs[i]) for i in range(len(ofcs))]
        jac_scores = [jaccard(qbis, ofc_bigrams[i]) for i in range(len(ofcs))]

        # Use normalized UUID for subtype matching
        q_subtype_id = qrow.get("_discipline_subtype_id")
        q_discipline_id = qrow.get("discipline_id")

        scored = []
        skipped_reasons = {
            "question_missing_subtype": 0,
            "ofc_missing_subtype": 0,
            "subtype_mismatch": 0,
            "discipline_mismatch": 0
        }
        
        for i, orow in enumerate(ofcs):
            oid = str(orow[o_id_col])
            o_subtype_id = orow.get("_discipline_subtype_id")
            
            # HARD GATE 1: Question must have subtype
            if not q_subtype_id:
                skipped_reasons["question_missing_subtype"] += 1
                continue
            
            # HARD GATE 2: OFC must have subtype
            if not o_subtype_id:
                skipped_reasons["ofc_missing_subtype"] += 1
                continue
            
            # HARD GATE 3: Subtypes must match
            if q_subtype_id != o_subtype_id:
                skipped_reasons["subtype_mismatch"] += 1
                continue
            
            # HARD GATE 4: Disciplines must match (if both available)
            if q_discipline_id:
                o_discipline_id = orow.get("discipline_id")
                if not o_discipline_id and o_subtype_id:
                    # Get discipline_id from pre-loaded mapping
                    o_discipline_id = subtype_to_discipline.get(o_subtype_id)
                
                if o_discipline_id and q_discipline_id != o_discipline_id:
                    skipped_reasons["discipline_mismatch"] += 1
                    continue
            
            # Check status for promotion eligibility
            o_status = orow.get(o_status_col) if o_status_col else None
            is_approved = (o_status == "APPROVED") if o_status_col else True  # Default to True if no status column (backward compatibility)

            # UUID-to-UUID matching (always true after gates)
            subtype_match = True  # Guaranteed by hard gates above
            citation_bound = oid in cited_ofc_ids
            external_verified = oid in external_verified_ofc_ids
            promote_allowed = (citation_bound or external_verified) and is_approved
            
            # Determine eligibility reason
            if citation_bound:
                eligibility_reason = "CHUNK_CITED"
            elif external_verified:
                eligibility_reason = "IST_EXTERNAL_VERIFIED"
            else:
                eligibility_reason = "INELIGIBLE"

            base = 0.45*bm25_norm[i] + 0.35*tfidf_scores[i] + 0.20*jac_scores[i]
            boost = 0.05 if subtype_match else 0.0
            penalty = 0.0
            if (not promote_allowed) and (not args.allow_reserve):
                penalty -= 0.10

            # token overlap explanation
            otoks = ofc_tokens[i]
            overlap = list((set(qtoks) & set(otoks)))
            overlap = sorted(overlap)[:15]
            
            # Generic OFC penalty: -0.15 if OFC text < 120 chars AND overlap_tokens < 3 AND discipline_subtype_match == false
            penalty_generic = 0.0
            ofc_text_len = len(orow[o_text_col] or "")
            overlap_count = len(overlap)
            if ofc_text_len < 120 and overlap_count < 3 and not subtype_match:
                penalty_generic = -0.15

            final = base + boost + penalty + penalty_generic

            scored.append({
                "question_id": qid,
                "ofc_id": oid,
                "final": float(final),
                "bm25": float(bm25_norm[i]),
                "tfidf": float(tfidf_scores[i]),
                "jaccard": float(jac_scores[i]),
                "boost_subtype": float(boost),
                "penalty_uncited": float(penalty),
                "penalty_generic": float(penalty_generic),
                "citation_bound": bool(citation_bound),
                "external_verified": bool(external_verified),
                "promote_allowed": bool(promote_allowed),
                "is_approved": bool(is_approved),
                "ofc_status": o_status if o_status_col else None,
                "eligibility_reason": eligibility_reason,
                "discipline_subtype_match": bool(subtype_match),
                "overlap_tokens": overlap,
                "overlap_tokens_count": overlap_count,
                "ofc_text_length": ofc_text_len,
                "ofc_text_preview": (orow[o_text_col] or "")[:160]
            })

        scored.sort(key=lambda x: x["final"], reverse=True)
        top = scored[:args.topn]

        promoted = []
        suggested = []
        for item in top:
            can_promote = item["final"] >= args.promote_threshold
            if args.require_subtype_match:
                can_promote = can_promote and item["discipline_subtype_match"]
            if (not args.allow_reserve):
                # Require citation_bound OR external_verified
                can_promote = can_promote and item["promote_allowed"]

            if can_promote:
                promoted.append(item)
            else:
                suggested.append(item)
        
        # Promotion cap: Max 3 promoted OFCs per question (sorted by final score)
        if len(promoted) > 3:
            # Keep top 3, move rest to suggested
            excess = promoted[3:]
            promoted = promoted[:3]
            suggested.extend(excess)

        return {
            "question_id": qid,
            "question_text": qtxt[:220],
            "promoted": promoted,
            "suggested": suggested,
            # For calibration: include all eligible pairs (top 50 pre-threshold)
            "_all_scored": scored[:50] if args.calibrate else None,
            # Skipped counts for diagnostics
            "skipped_question_missing_subtype": skipped_reasons["question_missing_subtype"],
            "skipped_ofc_missing_subtype": skipped_reasons["ofc_missing_subtype"],
            "skipped_subtype_mismatch": skipped_reasons["subtype_mismatch"],
            "skipped_discipline_mismatch": skipped_reasons["discipline_mismatch"],
        }

    results = []
    for q in questions:
        results.append(score_question(q))

    # Calibration mode: collect eligible pairs and compute statistics
    if args.calibrate:
        # Health check: count questions/OFCs with subtype IDs
        questions_with_subtype_id = sum(1 for q in questions if q.get("_discipline_subtype_id"))
        ofcs_with_subtype_id = sum(1 for o in ofcs if o.get("_discipline_subtype_id"))
        
        # Count distinct question subtypes that have matching cited/externally-verified OFCs
        question_subtype_ids = set(q.get("_discipline_subtype_id") for q in questions if q.get("_discipline_subtype_id"))
        eligible_ofc_ids = cited_ofc_ids | external_verified_ofc_ids
        eligible_ofc_subtype_ids = set(o.get("_discipline_subtype_id") for o in ofcs if o.get("_discipline_subtype_id") and str(o[o_id_col]) in eligible_ofc_ids)
        matching_subtypes = question_subtype_ids & eligible_ofc_subtype_ids
        
        # Aggregate skipped counts from all results
        total_skipped_question_missing_subtype = sum(r.get("skipped_question_missing_subtype", 0) for r in results)
        total_skipped_ofc_missing_subtype = sum(r.get("skipped_ofc_missing_subtype", 0) for r in results)
        total_skipped_subtype_mismatch = sum(r.get("skipped_subtype_mismatch", 0) for r in results)
        total_skipped_discipline_mismatch = sum(r.get("skipped_discipline_mismatch", 0) for r in results)
        
        eligible_scores = []
        for r in results:
            if r.get("_all_scored"):
                for item in r["_all_scored"]:
                    # Eligible for promotion: subtype_match == true AND (citation_bound OR external_verified)
                    if item["discipline_subtype_match"] and item["promote_allowed"]:
                        eligible_scores.append(item["final"])
        
        health_check = {
            "questions_total": len(questions),
            "questions_with_discipline_subtype_id": questions_with_subtype_id,
            "ofcs_total": len(ofcs),
            "ofcs_with_discipline_subtype_id": ofcs_with_subtype_id,
            "cited_ofcs_total": len(cited_ofc_ids),
            "external_verified_ofcs_total": len(external_verified_ofc_ids),
            "eligible_ofcs_total": len(eligible_ofc_ids),
            "question_subtypes_distinct": len(question_subtype_ids),
            "eligible_ofc_subtypes_distinct": len(eligible_ofc_subtype_ids),
            "matching_subtypes_count": len(matching_subtypes),
            "join_health_ratio": len(matching_subtypes) / len(question_subtype_ids) if question_subtype_ids else 0.0,
            "skipped_question_missing_subtype": total_skipped_question_missing_subtype,
            "skipped_ofc_missing_subtype": total_skipped_ofc_missing_subtype,
            "skipped_subtype_mismatch": total_skipped_subtype_mismatch,
            "skipped_discipline_mismatch": total_skipped_discipline_mismatch
        }
        
        if not eligible_scores:
            print("=" * 70)
            print("⚠️  CALIBRATION HEALTH CHECK FAILED")
            print("=" * 70)
            print(f"\nQuestions: {health_check['questions_total']} total, {health_check['questions_with_discipline_subtype_id']} with discipline_subtype_id")
            print(f"OFCs: {health_check['ofcs_total']} total, {health_check['ofcs_with_discipline_subtype_id']} with discipline_subtype_id")
            print(f"Cited OFCs: {health_check['cited_ofcs_total']} total")
            print(f"\nJoin Health:")
            print(f"  Question subtypes: {health_check['question_subtypes_distinct']}")
            print(f"  Eligible OFC subtypes: {health_check.get('eligible_ofc_subtypes_distinct', health_check.get('cited_ofc_subtypes_distinct', 0))}")
            print(f"  Matching subtypes: {health_check['matching_subtypes_count']}")
            print(f"  Health ratio: {health_check['join_health_ratio']:.1%}")
            print(f"\nHard Gate Diagnostics:")
            print(f"  Skipped (question missing subtype): {health_check['skipped_question_missing_subtype']}")
            print(f"  Skipped (OFC missing subtype): {health_check['skipped_ofc_missing_subtype']}")
            print(f"  Skipped (subtype mismatch): {health_check['skipped_subtype_mismatch']}")
            print(f"  Skipped (discipline mismatch): {health_check['skipped_discipline_mismatch']}")
            print(f"\n[WARN] No eligible pairs found (subtype_match=true AND (citation_bound=true OR external_verified=true))")
            if health_check['questions_with_discipline_subtype_id'] == 0:
                print("[WARN] → Questions missing discipline_subtype_id - run migration 20260202_add_discipline_subtype_id_to_questions.sql")
            elif health_check['matching_subtypes_count'] == 0:
                print("[WARN] → No question subtypes match cited OFC subtypes - check subtype normalization")
            elif health_check['cited_ofcs_total'] == 0:
                print("[WARN] → No OFCs are citation-bound")
            else:
                print("[WARN] → Check audit_linker_readiness.py output for details")
            
            calibration_report = {
                "link_method": "LEXICAL_HYBRID_V1",
                "eligible_pairs_count": 0,
                "health_check": health_check,
                "diagnosis": "No eligible pairs found - check subtype compatibility and citation coverage",
                "score_statistics": None,
                "suggested_thresholds": None
            }
        else:
            eligible_scores.sort()
            n = len(eligible_scores)
            
            def percentile(scores, p):
                if not scores:
                    return None
                idx = int((p / 100.0) * (len(scores) - 1))
                return scores[idx]
            
            score_stats = {
                "min": float(min(eligible_scores)),
                "median": float(percentile(eligible_scores, 50)),
                "p80": float(percentile(eligible_scores, 80)),
                "p90": float(percentile(eligible_scores, 90)),
                "p95": float(percentile(eligible_scores, 95)),
                "p99": float(percentile(eligible_scores, 99)),
                "max": float(max(eligible_scores)),
                "count": n
            }
            
            suggested_thresholds = {
                "conservative": score_stats["p95"],
                "balanced": score_stats["p90"],
                "aggressive": score_stats["p80"]
            }
            
            calibration_report = {
                "link_method": "LEXICAL_HYBRID_V1",
                "eligible_pairs_count": n,
                "health_check": health_check,
                "score_statistics": score_stats,
                "suggested_thresholds": suggested_thresholds,
                "current_threshold": args.promote_threshold,
                "threshold_assessment": {
                    "current_vs_p90": "above" if args.promote_threshold > score_stats["p90"] else ("below" if args.promote_threshold < score_stats["p90"] else "equal"),
                    "current_vs_p95": "above" if args.promote_threshold > score_stats["p95"] else ("below" if args.promote_threshold < score_stats["p95"] else "equal"),
                    "recommendation": "conservative" if args.promote_threshold > score_stats["p95"] else ("balanced" if args.promote_threshold > score_stats["p90"] else "aggressive")
                }
            }
            
            print("=" * 70)
            print("✓ CALIBRATION HEALTH CHECK PASSED")
            print("=" * 70)
            print(f"\nJoin Health:")
            print(f"  Question subtypes: {health_check['question_subtypes_distinct']}")
            print(f"  Cited OFC subtypes: {health_check.get('cited_ofc_subtypes_distinct', health_check.get('eligible_ofc_subtypes_distinct', 0))}")
            print(f"  Matching subtypes: {health_check['matching_subtypes_count']}")
            print(f"  Health ratio: {health_check['join_health_ratio']:.1%}")
            print(f"\nHard Gate Diagnostics:")
            print(f"  Skipped (question missing subtype): {health_check['skipped_question_missing_subtype']}")
            print(f"  Skipped (OFC missing subtype): {health_check['skipped_ofc_missing_subtype']}")
            print(f"  Skipped (subtype mismatch): {health_check['skipped_subtype_mismatch']}")
            print(f"  Skipped (discipline mismatch): {health_check['skipped_discipline_mismatch']}")
        
        Path("analytics/reports").mkdir(parents=True, exist_ok=True)
        Path("analytics/reports/ofc_link_calibration.json").write_text(
            json.dumps(calibration_report, indent=2), encoding="utf-8"
        )
        
        print("=" * 70)
        print("OFC-Question Linker Calibration")
        print("=" * 70)
        print(f"\nEligible pairs (subtype_match=true AND (citation_bound=true OR external_verified=true)): {calibration_report['eligible_pairs_count']}")
        if calibration_report.get("score_statistics"):
            stats = calibration_report["score_statistics"]
            print(f"\nScore Distribution:")
            print(f"  Min:    {stats['min']:.4f}")
            print(f"  Median: {stats['median']:.4f}")
            print(f"  P80:    {stats['p80']:.4f}")
            print(f"  P90:    {stats['p90']:.4f}")
            print(f"  P95:    {stats['p95']:.4f}")
            print(f"  P99:    {stats['p99']:.4f}")
            print(f"  Max:    {stats['max']:.4f}")
            print(f"\nSuggested Thresholds:")
            thresh = calibration_report["suggested_thresholds"]
            print(f"  Conservative (P95): {thresh['conservative']:.4f}")
            print(f"  Balanced (P90):     {thresh['balanced']:.4f}")
            print(f"  Aggressive (P80):   {thresh['aggressive']:.4f}")
            print(f"\nCurrent threshold: {args.promote_threshold:.4f}")
            assessment = calibration_report["threshold_assessment"]
            print(f"  Assessment: {assessment['recommendation']} (vs P90: {assessment['current_vs_p90']}, vs P95: {assessment['current_vs_p95']})")
        
        print(f"\n[OK] Wrote analytics/reports/ofc_link_calibration.json")
        runtime_conn.close()
        return  # Exit early in calibration mode, no DB writes

    # Coverage report
    total_questions = len(results)
    q_with_promoted = sum(1 for r in results if r["promoted"])
    total_promoted_links = sum(len(r["promoted"]) for r in results)
    total_suggested_links = sum(len(r["suggested"]) for r in results)

    # Top OFCs by times promoted
    prom_counts = Counter()
    for r in results:
        for p in r["promoted"]:
            prom_counts[p["ofc_id"]] += 1

    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/ofc_link_coverage.json").write_text(json.dumps({
        "link_method": "LEXICAL_HYBRID_V1",
        "topn": args.topn,
        "promote_threshold": args.promote_threshold,
        "allow_reserve": bool(args.allow_reserve),
        "require_subtype_match": bool(args.require_subtype_match),
        "questions_total": total_questions,
        "questions_with_promoted": q_with_promoted,
        "promoted_links_total": total_promoted_links,
        "suggested_links_total": total_suggested_links,
        "top_promoted_ofcs": prom_counts.most_common(25),
        "tables": {
            "questions": qtbl,
            "ofcs": otbl,
            "citations": ctbl,
            "link_table": ltbl
        }
    }, indent=2), encoding="utf-8")

    # Optional: candidates output (can be large)
    Path("analytics/reports/ofc_link_candidates_topN.json").write_text(json.dumps({
        "link_method": "LEXICAL_HYBRID_V1",
        "results": results
    }, indent=2), encoding="utf-8")

    # Apply to DB (promoted only by default) - skip in calibration mode
    if args.apply and not args.calibrate:
        if not ltbl:
            runtime_conn.close()
            raise SystemExit("FAIL: --apply requested but no link table was discovered.")
        link_q_col = schema["selected_link_table"]["question_id_col"]
        link_o_col = schema["selected_link_table"]["ofc_id_col"]
        link_score_col = schema["selected_link_table"].get("score_col")
        link_method_col = schema["selected_link_table"].get("method_col")
        link_expl_col = schema["selected_link_table"].get("explanation_col")

        # Link table is likely in RUNTIME (same as questions/OFCs)
        cur = runtime_conn.cursor()

        def upsert_link(qid, oid, score, expl, link_method="LEXICAL_HYBRID_V1"):
            cols = [link_q_col, link_o_col]
            vals = [qid, oid]
            if link_score_col:
                cols.append(link_score_col); vals.append(score)
            if link_method_col:
                cols.append(link_method_col); vals.append(link_method)
            if link_expl_col:
                cols.append(link_expl_col); vals.append(json.dumps(expl))

            placeholders = ", ".join(["%s"]*len(vals))
            collist = ", ".join(cols)

            # Find a usable conflict target: prefer (question_id, ofc_id)
            # We assume a unique constraint exists; if not, insert duplicates is acceptable but not desired.
            sql = f"""
              INSERT INTO {ltbl} ({collist})
              VALUES ({placeholders})
              ON CONFLICT ({link_q_col}, {link_o_col})
              DO UPDATE SET
            """
            sets = []
            if link_score_col:
                sets.append(f"{link_score_col}=EXCLUDED.{link_score_col}")
            if link_method_col:
                sets.append(f"{link_method_col}=EXCLUDED.{link_method_col}")
            if link_expl_col:
                sets.append(f"{link_expl_col}=EXCLUDED.{link_expl_col}")
            if not sets:
                # nothing to update
                sql = f"INSERT INTO {ltbl} ({collist}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
            else:
                sql += ", ".join(sets)

            cur.execute(sql, tuple(vals))

        wrote = 0
        for r in results:
            qid = r["question_id"]
            to_write = r["promoted"]
            if args.apply_suggested:
                to_write = r["promoted"] + r["suggested"]
            for item in to_write:
                expl = {
                    "bm25": item["bm25"],
                    "tfidf": item["tfidf"],
                    "jaccard": item["jaccard"],
                    "boost_subtype": item["boost_subtype"],
                    "penalty_uncited": item["penalty_uncited"],
                    "penalty_generic": item.get("penalty_generic", 0.0),
                    "final": item["final"],
                    "overlap_tokens": item["overlap_tokens"],
                    "overlap_tokens_count": item.get("overlap_tokens_count", len(item.get("overlap_tokens", []))),
                    "ofc_text_length": item.get("ofc_text_length", 0),
                    "citation_bound": item["citation_bound"],
                    "external_verified": item.get("external_verified", False),
                    "eligibility_reason": item.get("eligibility_reason", "UNKNOWN"),
                    "discipline_subtype_match": item["discipline_subtype_match"],
                }
                # Use IST_VERIFIED_LINK_V1 if external_verified, else LEXICAL_HYBRID_V1
                link_method = "IST_VERIFIED_LINK_V1" if item.get("external_verified", False) else "LEXICAL_HYBRID_V1"
                upsert_link(qid, item["ofc_id"], item["final"], expl, link_method)
                wrote += 1

        runtime_conn.commit()
        cur.close()
        print(f"[OK] Wrote links: {wrote} into {ltbl}")

    runtime_conn.close()
    if ofc_conn != runtime_conn:
        ofc_conn.close()
    if citation_conn and citation_conn != runtime_conn and citation_conn != ofc_conn:
        citation_conn.close()
    print("[OK] Wrote analytics/reports/ofc_link_coverage.json")
    print("[OK] Wrote analytics/reports/ofc_link_candidates_topN.json")

if __name__ == "__main__":
    main()
