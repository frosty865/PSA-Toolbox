#!/usr/bin/env python3
"""
Solution-focused OFC mining: persist only candidates that align to current questions.

Only persists candidates that:
1) Pass quality filters (meta/preamble, cognitive, vulnerability, etc.)
2) Have high-confidence subtype assignment
3) Align strongly to >= 1 current question (subtype match + similarity >= min_link_score)
"""
import argparse
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Import shared utilities
sys.path.insert(0, str(Path(__file__).parent))
from subtype_lexicon import build_lexicon, classify_subtype

# Import linker scoring functions
RE_PUNCT = re.compile(r"[^a-z0-9\s]+")
RE_WS = re.compile(r"\s+")
RE_SENT_SPLIT = re.compile(r"(?<=[\.\?\!])\s+")

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

def bigrams(toks: List[str]) -> Set[str]:
    return set(f"{toks[i]}_{toks[i+1]}" for i in range(len(toks)-1))

def jaccard(set1: Set[str], set2: Set[str]) -> float:
    if not set1 or not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0

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
            if i is not None:
                vec[i] = c * idf[i]
        doc_vecs.append(vec)
    return TFIDFIndex(vocab=vocab, idf=idf, doc_vecs=doc_vecs)

def tfidf_query_vec(qtoks: List[str], tfidf: TFIDFIndex) -> Dict[int, float]:
    tf = Counter(qtoks)
    vec = {}
    for w, c in tf.items():
        i = tfidf.vocab.get(w)
        if i is not None:
            vec[i] = c * tfidf.idf[i]
    return vec

def cosine_sparse(qvec: Dict[int, float], dvec: Dict[int, float]) -> float:
    if not qvec or not dvec:
        return 0.0
    dot = sum(qvec.get(i, 0) * dvec.get(i, 0) for i in set(qvec.keys()) | set(dvec.keys()))
    qnorm = math.sqrt(sum(v*v for v in qvec.values()))
    dnorm = math.sqrt(sum(v*v for v in dvec.values()))
    if qnorm == 0 or dnorm == 0:
        return 0.0
    return dot / (qnorm * dnorm)

def norm(s: str) -> str:
    s = (s or "").strip()
    s = RE_WS.sub(" ", s)
    return s

def lower(s: str) -> str:
    return (s or "").lower()

# Filter constants and functions (same as miner v3)
RE_NONWORD_HEAVY = re.compile(r"^[\W\d_]+$")
RE_CAPS_LABEL = re.compile(r"^([A-Z][A-Z \-]{3,30})\s+(.*)$")

RECO_WORDS = ["consider", "recommended", "recommend", "should", "may wish to", "an option for consideration"]
CAP_VERBS = [" is ", " are ", " includes ", " provides ", " maintains ", " ensures ", " requires ", " establishes ", " implements "]
CAP_LEXICON = ["system", "systems", "procedure", "procedures", "process", "processes", "capability", "capabilities", "function", "functions", "feature", "features", "component", "components", "mechanism", "mechanisms"]

OPTION_PREFIXES = ["consider", "ensure", "recommend", "recommended", "an option for consideration", "it is recommended", "it is advisable", "may wish to"]
OPTION_MODALS = [" should ", " must ", " may ", " recommended", " recommendation"]
CAPABILITY_STATE_ANCHORS = [" is implemented", " are implemented", " is established", " are established", " is provided", " are provided", " is maintained", " are maintained", " is documented", " are documented", " is conducted", " are conducted", " is in place", " are in place", " is used", " are used", " is enforced", " are enforced", " is controlled", " are controlled", " is monitored", " are monitored", " is restricted", " are restricted", " exists", " are available", " is available"]
OPTION_VERBS = ["establish", "implement", "provide", "maintain", "develop", "conduct", "review", "revise", "train", "exercise", "coordinate", "control", "monitor", "inspect", "secure", "verify", "enforce", "issue", "collect", "destroy", "restrict", "limit"]
OBSERVATION_MARKERS = [" is limited", " are limited", " is lacking", " are lacking", " lacks ", " lack ", " is insufficient", " are insufficient", " is inadequate", " are inadequate", " missing ", " absent ", " vulnerability", " weakness", " deficiency", " shortfall", " gap"]
DEFINITION_MARKERS = [" refers to", " is defined as", " means ", " is a ", " are a ", " is an ", " are an ", " is the ", " are the ", " describes ", " explains "]
BULLET_PREFIXES = ["•", "-", "–", "—", "▪", "*"]
IMPERATIVE_VERB_PREFIXES = ["collect", "destroy", "design", "color-code", "issue", "revoke", "schedule", "approve", "verify", "inspect", "monitor", "restrict", "control", "secure", "train", "exercise", "review", "revise", "establish", "implement", "maintain", "provide", "enforce", "coordinate", "document", "record", "report", "limit", "deny", "escort"]
META_PREAMBLE_MARKERS = ["outlined below", "described in", "discussed in", "see section", "see figure", "see table", "as shown", "as illustrated", "as noted", "as mentioned", "as stated", "as indicated"]
VULNERABILITY_MARKERS_STRONG = [" vulnerability", " weakness", " deficiency", " shortfall", " gap", " lacks ", " lack ", " missing ", " absent ", " insufficient", " inadequate"]
FORBIDDEN_IMPL = ["brand", "vendor", "manufacturer", "model", "version", "cost", "price", "budget", "timeline", "schedule", "deadline", "step-by-step", "how to", "install", "configure", "setup", "implementation guide"]
COGNITIVE_PREFIXES = ["understand", "recognize", "be aware", "know", "appreciate", "comprehend"]
CONDITIONAL_COGNITIVE_PREFIXES = ["should understand", "should recognize", "should be aware", "should know"]
AUDITABLE_ANCHORS = ["procedure", "procedures", "process", "plan", "plans", "training", "program", "criteria", "guidance", "policy", "policies", "defined", "documented", "is defined", "are defined", "exists", "is provided", "are provided", "established", "communicated"]

def norm_ws(s: str) -> str:
    return " ".join((s or "").split()).strip()

def is_pdfish_noise(s: str) -> bool:
    t = norm(s)
    if len(t) < 10:
        return True
    if RE_NONWORD_HEAVY.match(t):
        return True
    return False

def is_forbidden(s: str) -> Optional[str]:
    t = lower(s)
    for w in FORBIDDEN_IMPL:
        if w in t:
            return w
    return None

def contains_lexicon(s: str) -> bool:
    t = lower(s)
    return any(k in t for k in CAP_LEXICON)

def is_reco_sentence(s: str) -> bool:
    t = lower(s)
    return any(w in t for w in RECO_WORDS)

def is_capability_sentence(s: str) -> bool:
    t = lower(s)
    if not any(v in t for v in CAP_VERBS):
        return False
    return contains_lexicon(t)

def is_meta_preamble(text: str) -> bool:
    t = lower(norm(text))
    return any(m in t for m in META_PREAMBLE_MARKERS)

def is_vulnerability_statement(text: str) -> bool:
    t = lower(" " + norm(text) + " ")
    return any(m in t for m in VULNERABILITY_MARKERS_STRONG)

def starts_with_any(text: str, prefixes: list) -> bool:
    t = lower(norm(text))
    return any(t.startswith(p) for p in prefixes)

def contains_any(s: str, needles: list) -> bool:
    t = lower(norm_ws(s))
    return any(n in t for n in needles)

def strip_leading_bullets(s: str) -> str:
    t = norm_ws(s)
    t = t.lstrip("".join(BULLET_PREFIXES) + " \t")
    m = RE_CAPS_LABEL.match(t)
    if m:
        label = m.group(1).strip()
        rest = m.group(2).strip()
        if any(c.islower() for c in rest):
            t = rest
    return t

def starts_with_imperative_verb(s: str) -> bool:
    t = lower(strip_leading_bullets(s))
    return any(t.startswith(v + " ") or t == v for v in IMPERATIVE_VERB_PREFIXES)

def looks_like_option(s: str) -> bool:
    t = lower(norm_ws(s))
    if starts_with_any(t, OPTION_PREFIXES):
        return True
    if any(m in f" {t} " for m in OPTION_MODALS):
        return True
    if any(a in t for a in CAPABILITY_STATE_ANCHORS):
        if contains_any(t, DEFINITION_MARKERS):
            return False
        return True
    if starts_with_imperative_verb(s):
        if contains_any(t, OBSERVATION_MARKERS):
            return False
        if contains_any(t, DEFINITION_MARKERS):
            return False
        return True
    if any(v in t for v in OPTION_VERBS):
        if contains_any(t, OBSERVATION_MARKERS):
            return False
        if contains_any(t, DEFINITION_MARKERS):
            return False
        return True
    return False

def is_observation(s: str) -> bool:
    t = lower(norm_ws(s))
    if contains_any(t, OBSERVATION_MARKERS) and not looks_like_option(t):
        return True
    if contains_any(t, DEFINITION_MARKERS) and not looks_like_option(t):
        return True
    return False

def has_auditable_anchor(text: str) -> bool:
    t = lower(norm(text))
    return any(a in t for a in AUDITABLE_ANCHORS)

def is_state_vulnerability(text: str) -> bool:
    t = lower(norm(text))
    if starts_with_any(t, COGNITIVE_PREFIXES) and not has_auditable_anchor(t):
        return True
    if starts_with_any(t, CONDITIONAL_COGNITIVE_PREFIXES) and not has_auditable_anchor(t):
        return True
    return False

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
    raise SystemExit("Missing CORPUS_DATABASE_URL")

def get_runtime_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    raise SystemExit("Missing RUNTIME_DATABASE_URL")

def fetch(cur, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def table_has_column(cur, table: str, column: str) -> bool:
    table_name = table.replace("public.", "")
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s AND column_name=%s
        )
    """, (table_name, column))
    return cur.fetchone()[0]

def load_current_questions(runtime_conn) -> Dict[str, List[Dict[str, Any]]]:
    """Load current questions grouped by discipline_subtype_id."""
    cur = runtime_conn.cursor()
    
    # Check for baseline_spines_runtime
    if table_has_column(cur, "baseline_spines_runtime", "canon_id"):
        questions = fetch(cur, """
            SELECT canon_id as question_id, question_text, discipline_subtype_id
            FROM public.baseline_spines_runtime
            WHERE active = true AND discipline_subtype_id IS NOT NULL
        """)
    else:
        # Fallback: try other question tables
        questions = []
    
    cur.close()
    
    # Group by subtype_id
    by_subtype: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for q in questions:
        subtype_id = str(q.get("discipline_subtype_id") or "")
        if subtype_id:
            by_subtype[subtype_id].append(q)
    
    return dict(by_subtype)

def score_candidate_against_questions(
    candidate_text: str,
    candidate_subtype_id: str,
    questions_by_subtype: Dict[str, List[Dict[str, Any]]],
    question_tokens_map: Dict[str, List[str]],
    question_bigrams_map: Dict[str, Set[str]],
    question_index_map: Dict[str, int],
    bm25_index: BM25Index,
    tfidf_index: TFIDFIndex
) -> Tuple[Optional[str], float]:
    """
    Score candidate against questions of the same subtype.
    Returns (best_question_id, best_score) or (None, 0.0) if no match.
    """
    if not candidate_subtype_id or candidate_subtype_id not in questions_by_subtype:
        return None, 0.0
    
    candidate_tokens = tokens(candidate_text)
    candidate_bigrams_set = bigrams(candidate_tokens)
    candidate_tfidf_vec = tfidf_query_vec(candidate_tokens, tfidf_index)
    
    best_score = 0.0
    best_question_id = None
    
    subtype_questions = questions_by_subtype[candidate_subtype_id]
    
    # Get max BM25 for normalization
    all_bm25_scores = [bm25_score(bm25_index, candidate_tokens, dt) for dt in bm25_index.docs_tokens]
    max_b = max(all_bm25_scores + [1.0])
    
    for q in subtype_questions:
        qid = str(q["question_id"])
        qtoks = question_tokens_map.get(qid, [])
        qbis = question_bigrams_map.get(qid, set())
        
        if not qtoks:
            continue
        
        # Get question index from map
        q_idx = question_index_map.get(qid)
        if q_idx is None or q_idx >= len(tfidf_index.doc_vecs):
            continue
        
        # Compute scores (same formula as linker)
        raw_bm25 = bm25_score(bm25_index, candidate_tokens, qtoks)
        bm25_norm = (raw_bm25 / (max_b or 1.0)) if max_b > 0 else 0.0
        
        tfidf_score = cosine_sparse(candidate_tfidf_vec, tfidf_index.doc_vecs[q_idx])
        jac_score = jaccard(candidate_bigrams_set, qbis)
        
        # Weighted combination (same as linker)
        base = 0.45 * bm25_norm + 0.35 * tfidf_score + 0.20 * jac_score
        boost = 0.05  # subtype match always true here
        
        final = base + boost
        
        if final > best_score:
            best_score = final
            best_question_id = qid
    
    return best_question_id, best_score

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--source-set", type=str, default=None)
    ap.add_argument("--max-chunks", type=int, default=None)
    ap.add_argument("--min-link-score", type=float, default=0.22)
    ap.add_argument("--subtype-min-score", type=float, default=0.35)
    ap.add_argument("--subtype-margin", type=float, default=1.35)
    ap.add_argument("--calibrate", action="store_true", help="Sample candidates and recommend min-link-score")
    args = ap.parse_args()
    
    # SAFETY GUARD
    if args.apply and os.environ.get("ALLOW_MINER_APPLY") != "YES":
        print("[FAIL] Miner --apply blocked. Set ALLOW_MINER_APPLY=YES environment variable to enable.", file=sys.stderr)
        sys.exit(1)
    
    # Load subtype lexicon
    print("[INFO] Building subtype lexicon...", file=sys.stderr)
    subtype_lexicon = build_lexicon()
    print(f"[INFO] Loaded lexicon for {len(subtype_lexicon)} subtypes", file=sys.stderr)
    
    # Load current questions
    runtime_conn = get_runtime_db()
    print("[INFO] Loading current questions...", file=sys.stderr)
    questions_by_subtype = load_current_questions(runtime_conn)
    print(f"[INFO] Loaded {sum(len(qs) for qs in questions_by_subtype.values())} questions across {len(questions_by_subtype)} subtypes", file=sys.stderr)
    
    # Build question indexes for scoring
    question_tokens_map: Dict[str, List[str]] = {}
    question_bigrams_map: Dict[str, Set[str]] = {}
    all_question_tokens: List[List[str]] = []
    question_index_map: Dict[str, int] = {}  # Map question_id to index in all_question_tokens
    
    idx = 0
    for subtype_id, questions in questions_by_subtype.items():
        for q in questions:
            qid = str(q["question_id"])
            qtxt = q.get("question_text", "") or ""
            qtoks = tokens(qtxt)
            question_tokens_map[qid] = qtoks
            question_bigrams_map[qid] = bigrams(qtoks)
            all_question_tokens.append(qtoks)
            question_index_map[qid] = idx
            idx += 1
    
    # Build BM25 and TF-IDF indexes
    print("[INFO] Building scoring indexes...", file=sys.stderr)
    bm25_index = build_bm25(all_question_tokens)
    tfidf_index = build_tfidf(all_question_tokens)
    
    # Load mining targets
    targets_path = Path("analytics/reports/ofc_mining_targets.json")
    if not targets_path.exists():
        print("[FAIL] Missing analytics/reports/ofc_mining_targets.json. Run discover_ofc_mining_targets.py first.", file=sys.stderr)
        sys.exit(1)
    
    targets = json.loads(targets_path.read_text(encoding="utf-8"))
    dest = targets["destination"]
    cite = targets["citations"]
    doc_chunks = targets["document_chunks"]
    
    dest_table = dest["table"]
    dest_id_col = dest["id_col"]
    dest_text_col = dest["text_col"]
    
    chunks_table = doc_chunks["table"]
    chunk_id_col = doc_chunks["chunk_id_col"]
    chunk_text_col = doc_chunks["chunk_text_col"]
    chunk_doc_id_col = doc_chunks.get("chunk_doc_id_col") or doc_chunks.get("document_id_col")
    
    cite_table = cite["table"]
    cite_ofc_fk_col = cite["ofc_fk_col"]
    cite_chunk_fk_col = cite["chunk_fk_col"]
    use_direct_fk = cite.get("use_direct_fk", False)
    
    # Get chunk FK column name if using direct FK
    dest_chunk_fk_col = None
    if use_direct_fk:
        dest_chunk_fk_col = cite_chunk_fk_col
    
    corpus_conn = get_corpus_db()
    corpus_cur = corpus_conn.cursor()
    
    # Discover schema
    dest_cols_check = fetch(corpus_cur, f"""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
    """, (dest_table.replace("public.", ""),))
    dest_cols = {r["column_name"] for r in dest_cols_check}
    
    needs_source_id = "source_id" in dest_cols
    has_submitted_by = "submitted_by" in dest_cols
    has_status = "status" in dest_cols
    has_discipline_subtype_id = "discipline_subtype_id" in dest_cols
    
    # Check document_role filtering
    has_document_role = table_has_column(corpus_cur, "corpus_documents", "document_role")
    
    # Build query for chunks
    where = []
    params: List[Any] = []
    
    # Only filter by OFC_SOURCE if documents are marked; otherwise allow all for testing
    if has_document_role:
        # Check if any OFC_SOURCE documents exist
        ofc_source_count = fetch(corpus_cur, """
            SELECT COUNT(*) as cnt FROM public.corpus_documents WHERE document_role = 'OFC_SOURCE'
        """)
        if ofc_source_count and ofc_source_count[0]["cnt"] > 0:
            where.append("cd.document_role = 'OFC_SOURCE'")
        # else: allow all documents (for testing when none are marked as OFC_SOURCE)
    
    if args.source_set:
        where.append(f"dc.source_set = %s")
        params.append(args.source_set)
    
    where_sql = "WHERE " + " AND ".join(where) if where else ""
    limit_sql = f"LIMIT {args.max_chunks}" if args.max_chunks else ""
    
    if has_document_role:
        join_clause = f"JOIN public.corpus_documents cd ON dc.{chunk_doc_id_col} = cd.id"
        if needs_source_id:
            chunks_query = f"""
                SELECT dc.{chunk_id_col}, dc.{chunk_text_col}, dc.{chunk_doc_id_col},
                       COALESCE(cs.source_id, d.source_id) AS source_id
                FROM {chunks_table} dc
                {join_clause}
                LEFT JOIN public.source_registry sr ON cd.source_registry_id = sr.id
                LEFT JOIN public.canonical_sources cs ON sr.source_key = cs.source_key
                LEFT JOIN public.documents d ON dc.{chunk_doc_id_col} = d.document_id
                {where_sql} {limit_sql}
            """
        else:
            chunks_query = f"""
                SELECT dc.{chunk_id_col}, dc.{chunk_text_col}, dc.{chunk_doc_id_col}
                FROM {chunks_table} dc
                {join_clause}
                {where_sql} {limit_sql}
            """
    else:
        if needs_source_id:
            chunks_query = f"""
                SELECT dc.{chunk_id_col}, dc.{chunk_text_col}, dc.{chunk_doc_id_col}, d.source_id
                FROM {chunks_table} dc
                LEFT JOIN public.documents d ON dc.{chunk_doc_id_col} = d.document_id
                {where_sql} {limit_sql}
            """
        else:
            chunks_query = f"""
                SELECT dc.{chunk_id_col}, dc.{chunk_text_col}, dc.{chunk_doc_id_col}
                FROM {chunks_table} dc
                {where_sql} {limit_sql}
            """
    
    chunks = fetch(corpus_cur, chunks_query, tuple(params))
    
    if not chunks:
        print("[INFO] No chunks found to process", file=sys.stderr)
        sys.exit(0)
    
    print(f"[INFO] Processing {len(chunks)} chunks...", file=sys.stderr)
    
    # Process chunks (reuse miner filters - import from mine_ofc_candidates_from_chunks_v3)
    # For brevity, I'll include key filter functions inline
    
    # Import filter functions from miner v3
    # (In production, you'd import these, but for now we'll define minimal versions)
    
    # Processing stats
    chunks_scanned = len(chunks)
    candidates_seen_after_filters = 0
    subtype_assigned = 0
    candidates_persisted = 0
    candidates_dropped_no_subtype = 0
    candidates_dropped_no_question_match = 0
    rejects = Counter()
    subtype_assigned_by_code = Counter()
    sample_persisted = []
    
    # Existing dedupe set
    existing = set()
    if use_direct_fk and dest_chunk_fk_col:
        existing_rows = fetch(corpus_cur, f"SELECT {dest_chunk_fk_col} AS chunk_id, {dest_text_col} AS txt FROM {dest_table};")
        existing = {(str(r["chunk_id"]), norm(r["txt"])) for r in existing_rows}
    
    # Process chunks with filters (same as miner v3)
    for ch in chunks:
        cid = str(ch[chunk_id_col])
        doc_id = str(ch[chunk_doc_id_col])
        text = ch.get(chunk_text_col) or ""
        
        if not text or is_pdfish_noise(text):
            rejects["empty_or_noise"] += 1
            continue
        
        sents = split_sentences(text)
        for s in sents:
            if len(s) < 40:
                continue
            
            # Apply filters (same as miner v3)
            forbidden_reason = is_forbidden(s)
            if forbidden_reason:
                rejects["forbidden_impl_detail"] += 1
                continue
            
            if is_meta_preamble(s):
                rejects["meta_preamble"] += 1
                continue
            
            if is_vulnerability_statement(s):
                rejects["vulnerability_finding"] += 1
                continue
            
            if is_state_vulnerability(s):
                rejects["state_vulnerability_cognitive"] += 1
                continue
            
            # Normalize: strip bullets and labels
            s0 = strip_leading_bullets(s)
            
            # Minimum content threshold
            if len(s0.split()) < 7:
                rejects["short_fragment"] += 1
                continue
            
            # Hard reject observations
            if is_observation(s0):
                rejects["observation_not_option"] += 1
                continue
            
            # Hard require option language
            if not looks_like_option(s0):
                rejects["no_option_language"] += 1
                continue
            
            if not (is_reco_sentence(s0) or is_capability_sentence(s0)):
                continue
            
            # Verbatim text
            ofc_txt = norm(s0)
            
            # Length bounds (40 chars minimum; no maximum)
            if len(ofc_txt) < 40:
                rejects["length_after_norm"] += 1
                continue
            
            # Dedupe check
            key = (cid, norm(ofc_txt))
            if key in existing:
                rejects["duplicate"] += 1
                continue
            
            candidates_seen_after_filters += 1
            
            # Classify subtype
            assigned_subtype_id, subtype_explanation = classify_subtype(
                ofc_txt,
                subtype_lexicon,
                min_score=args.subtype_min_score,
                margin=args.subtype_margin
            )
            
            if not assigned_subtype_id:
                candidates_dropped_no_subtype += 1
                continue
            
            subtype_assigned += 1
            subtype_code = subtype_lexicon[assigned_subtype_id]["code"]
            subtype_assigned_by_code[subtype_code] += 1
            
            # Score against questions of same subtype
            best_question_id, best_score = score_candidate_against_questions(
                ofc_txt,
                assigned_subtype_id,
                questions_by_subtype,
                question_tokens_map,
                question_bigrams_map,
                question_index_map,
                bm25_index,
                tfidf_index
            )
            
            if not best_question_id or best_score < args.min_link_score:
                candidates_dropped_no_question_match += 1
                continue
            
            # Candidate qualifies: persist
            if not args.apply:
                candidates_persisted += 1
                if len(sample_persisted) < 10:
                    sample_persisted.append({
                        "candidate_text": ofc_txt[:200],
                        "subtype_code": subtype_code,
                        "best_question_id": best_question_id,
                        "score": best_score,
                        "chunk_id": cid
                    })
                continue
            
            # Insert candidate
            insert_cols = [dest_text_col]
            insert_vals = [ofc_txt]
            
            if use_direct_fk and dest_chunk_fk_col:
                insert_cols.append(dest_chunk_fk_col)
                insert_vals.append(cid)
            
            if needs_source_id:
                source_id_val = ch.get("source_id")
                if not source_id_val:
                    # Use default source_id (same as miner v3)
                    default_source_result = fetch(corpus_cur, """
                        SELECT source_id FROM public.canonical_sources
                        WHERE title = 'UNKNOWN SOURCE' AND publisher = 'MISC'
                        LIMIT 1
                    """)
                    if default_source_result:
                        source_id_val = default_source_result[0]["source_id"]
                    else:
                        corpus_cur.execute("""
                            INSERT INTO public.canonical_sources 
                            (title, publisher, source_type, citation_text)
                            VALUES ('UNKNOWN SOURCE', 'MISC', 'OTHER', 'UNKNOWN SOURCE, MISC')
                            RETURNING source_id
                        """)
                        source_id_val = corpus_cur.fetchone()[0]
                        corpus_conn.commit()
                
                insert_cols.append("source_id")
                insert_vals.append(source_id_val)
            
            if has_submitted_by:
                insert_cols.append("submitted_by")
                insert_vals.append("MINED")
            
            if has_status:
                insert_cols.append("status")
                insert_vals.append("PENDING")
            
            if has_discipline_subtype_id:
                insert_cols.append("discipline_subtype_id")
                insert_vals.append(assigned_subtype_id)
            
            # Insert candidate
            if use_direct_fk and dest_chunk_fk_col:
                corpus_cur.execute(
                    f"INSERT INTO {dest_table} ({', '.join(insert_cols)}) VALUES ({', '.join(['%s'] * len(insert_vals))}) RETURNING {dest_id_col};",
                    tuple(insert_vals)
                )
                new_id = corpus_cur.fetchone()[0]
            else:
                corpus_cur.execute(
                    f"INSERT INTO {dest_table} ({', '.join(insert_cols)}) VALUES ({', '.join(['%s'] * len(insert_vals))}) RETURNING {dest_id_col};",
                    tuple(insert_vals)
                )
                new_id = corpus_cur.fetchone()[0]
                # Bind citation
                corpus_cur.execute(
                    f"INSERT INTO {cite_table} ({cite_ofc_fk_col}, {cite_chunk_fk_col}) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                    (new_id, cid)
                )
            
            existing.add(key)
            candidates_persisted += 1
            
            if len(sample_persisted) < 10:
                sample_persisted.append({
                    "candidate_text": ofc_txt[:200],
                    "subtype_code": subtype_code,
                    "best_question_id": best_question_id,
                    "score": best_score,
                    "chunk_id": cid
                })
    
    if args.apply:
        corpus_conn.commit()
        print(f"[INFO] Persisted {candidates_persisted} candidates", file=sys.stderr)
    
    # Generate report
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "chunks_scanned": chunks_scanned,
        "candidates_seen_after_filters": candidates_seen_after_filters,
        "subtype_assigned": subtype_assigned,
        "candidates_persisted": candidates_persisted,
        "candidates_dropped_no_subtype": candidates_dropped_no_subtype,
        "candidates_dropped_no_question_match": candidates_dropped_no_question_match,
        "rejected_counts_by_reason": dict(rejects),
        "top_subtypes_persisted": dict(subtype_assigned_by_code.most_common(20)),
        "sample_persisted": sample_persisted[:10],
        "min_link_score": args.min_link_score,
        "subtype_thresholds": {
            "min_score": args.subtype_min_score,
            "margin": args.subtype_margin
        }
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/ofc_solution_focused_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    corpus_cur.close()
    corpus_conn.close()
    runtime_conn.close()

if __name__ == "__main__":
    main()
