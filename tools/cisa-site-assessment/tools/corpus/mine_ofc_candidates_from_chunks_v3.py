#!/usr/bin/env python3
import argparse, json, os, re, sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Import subtype lexicon for classification
try:
    from subtype_lexicon import build_lexicon, classify_subtype
except ImportError:
    # If running from different directory, try relative import
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from subtype_lexicon import build_lexicon, classify_subtype

# Import centralized source kind detection
try:
    from source_kind import is_module_research_source
except ImportError:
    # If running from different directory, try relative import
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from source_kind import is_module_research_source

RE_SENT_SPLIT = re.compile(r"(?<=[\.\?\!])\s+")
RE_WS = re.compile(r"\s+")
RE_NONWORD_HEAVY = re.compile(r"^[\W\d_]+$")
RE_CAPS_LABEL = re.compile(r"^([A-Z][A-Z \-]{3,30})\s+(.*)$")

RECO_WORDS = ["consider", "recommended", "recommend", "should", "may wish to", "an option for consideration"]
CAP_VERBS = [" is ", " are ", " includes ", " provides ", " maintains ", " ensures ", " requires ", " establishes ", " implements "]

# Advisory / recommendation prefixes
OPTION_PREFIXES = [
    "consider", "ensure", "recommend", "recommended", "an option for consideration",
    "it is recommended", "it is advisable", "may wish to"
]

# Modal language anywhere in sentence
OPTION_MODALS = [" should ", " must ", " may ", " recommended", " recommendation"]

# Declarative capability assertions (capability-state anchors)
CAPABILITY_STATE_ANCHORS = [
    " is implemented", " are implemented",
    " is established", " are established",
    " is provided", " are provided",
    " is maintained", " are maintained",
    " is documented", " are documented",
    " is conducted", " are conducted",
    " is in place", " are in place",
    " is used", " are used",
    " is enforced", " are enforced",
    " is controlled", " are controlled",
    " is monitored", " are monitored",
    " is restricted", " are restricted",
    " exists", " are available", " is available"
]

# Action verb signals (kept, but not the only route)
OPTION_VERBS = [
    "establish", "implement", "provide", "maintain", "develop", "conduct",
    "review", "revise", "train", "exercise", "coordinate",
    "control", "monitor", "inspect", "secure", "verify", "enforce",
    "issue", "collect", "destroy", "restrict", "limit"
]

# Observation/finding language (NOT options)
# NOTE: DO NOT include generic "is/are" here; keep it focused on deficiency/state-only phrasing
OBSERVATION_MARKERS = [
    " is limited", " are limited",
    " is lacking", " are lacking",
    " lacks ", " lack ",
    " is insufficient", " are insufficient",
    " is inadequate", " are inadequate",
    " missing ", " absent ",
    " vulnerability", " weakness", " deficiency", " shortfall", " gap"
]

# Definition/explanation patterns (also observations, but separate from deficiency markers)
DEFINITION_MARKERS = [
    " is a ", " are a ", " refers to", " is defined as", " are defined as",
    " is the process of", " is an ability to", " is the capability to",
    " is designed to", " can help", " includes many of", " are different from"
]

# Bullet prefixes for normalization
BULLET_PREFIXES = ["•", "-", "–", "—", "▪", "*"]

# Common imperative verbs in best-practice docs (lowercase)
IMPERATIVE_VERB_PREFIXES = [
    "collect", "destroy", "design", "color-code", "issue", "revoke",
    "schedule", "approve", "verify", "inspect", "monitor", "restrict",
    "control", "secure", "train", "exercise", "review", "revise",
    "establish", "implement", "maintain", "provide", "enforce",
    "coordinate", "document", "record", "report", "limit", "deny",
    "escort", "escort=", "escort ",  # allow variants
]

CAP_LEXICON = [
 "access control","badge","credential","visitor","screening","search","perimeter","fence","gate","lighting","illumination",
 "camera","surveillance","cctv","monitoring","alarm","intrusion","detection","response","patrol","communications",
 "emergency","evacuation","shelter","lockdown","training","exercise","drill","incident","reporting","coordination",
 "command","control","procedures","plans","maintenance","testing","inspection","redundancy","backup","standoff",
 "barrier","bollard","entry","egress","checkpoint","guard","security force","key control"
]

FORBIDDEN_IMPL = [
 "install","purchase","vendor","model","brand","cost","$","timeline","within ","comply with","regulation","statute",
 "hipaa","pci","nist","cjis"
]

VULNERABILITY_MARKERS_STRONG = [
  " is limited", " are limited",
  " is lacking", " are lacking",
  " is insufficient", " are insufficient",
  " is inadequate", " are inadequate",
  " does not have ", " do not have ",
  " lacks ", " lack ",
  " missing ", " absent ",
  " vulnerability", " weakness", " deficiency", " shortfall", " gap"
]

# Meta/preamble scaffolding that is not an OFC
META_PREAMBLE_MARKERS = [
  "are outlined below", "is outlined below", "outlined below", "as outlined below",
  "the following recommended practices", "recommended practices",
  "are described below", "is described below",
  "this section provides", "this section describes", "the following", "see below"
]

# Cognitive/state-vulnerability prefixes (reject unless anchored to auditable capability)
COGNITIVE_PREFIXES = ["understand", "recognize", "be aware", "know", "learn", "remember"]
CONDITIONAL_COGNITIVE_PREFIXES = ["identify", "detect", "notice", "observe", "watch for", "look for"]

# Auditable anchors that make cognitive statements acceptable (they reference concrete capabilities)
AUDITABLE_ANCHORS = [
  "procedure", "procedures", "process", "plan", "plans", "training", "program", "criteria", "guidance",
  "policy", "policies", "defined", "documented", "is defined", "are defined", "exists",
  "is provided", "are provided", "established", "communicated"
]

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def norm(s: str) -> str:
    s = (s or "").strip()
    s = RE_WS.sub(" ", s)
    return s

def norm_ws(s: str) -> str:
    """Normalize whitespace only (for option language checks)."""
    return " ".join((s or "").split()).strip()

def lower(s: str) -> str:
    return (s or "").lower()

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
    """
    Reject statements that read like a deficiency/finding rather than a capability.
    Uses strong markers only.
    """
    t = lower(" " + norm(text) + " ")
    return any(m in t for m in VULNERABILITY_MARKERS_STRONG)

def starts_with_any(text: str, prefixes: list) -> bool:
    """Check if text starts with any of the given prefixes."""
    t = lower(norm(text))
    return any(t.startswith(p) for p in prefixes)

def contains_any(s: str, needles: list) -> bool:
    """Check if text contains any of the given needles."""
    t = lower(norm_ws(s))
    return any(n in t for n in needles)

def strip_leading_bullets(s: str) -> str:
    """Remove leading bullet characters and all-caps labels."""
    t = norm_ws(s)
    # Remove common bullet chars and leading whitespace
    t = t.lstrip("".join(BULLET_PREFIXES) + " \t")
    # Remove leading all-caps labels (e.g., "BEST PRACTICE", "REVIEW THE PLAN")
    # but only if followed by a space and then mixed/lowercase content
    m = RE_CAPS_LABEL.match(t)
    if m:
        label = m.group(1).strip()
        rest = m.group(2).strip()
        # avoid stripping if the entire line is caps
        if any(c.islower() for c in rest):
            t = rest
    return t

def starts_with_imperative_verb(s: str) -> bool:
    """Check if sentence starts with an imperative verb (after bullet stripping)."""
    t = lower(strip_leading_bullets(s))
    return any(t.startswith(v + " ") or t == v for v in IMPERATIVE_VERB_PREFIXES)

def looks_like_option(s: str) -> bool:
    """
    Deterministic "option language" test.
    Accept if:
    - starts with advisory prefix; OR
    - contains modals (should/must/may/recommended); OR
    - contains declarative capability-state anchors (is implemented/are in place/etc.); OR
    - starts with imperative verb (Collect..., Design..., Schedule...); OR
    - contains an action verb and does not look like an observation/finding/definition
    """
    t = lower(norm_ws(s))
    
    # Check for option prefixes (strongest signal)
    if starts_with_any(t, OPTION_PREFIXES):
        return True
    
    # Check for modals anywhere in sentence (strong signal)
    if any(m in f" {t} " for m in OPTION_MODALS):
        return True
    
    # Check for declarative capability-state anchors
    if any(a in t for a in CAPABILITY_STATE_ANCHORS):
        # But reject if it's a definition/explanation pattern
        if contains_any(t, DEFINITION_MARKERS):
            return False
        return True
    
    # Check for imperative verbs (bullet fragments, list items)
    if starts_with_imperative_verb(s):
        # Imperatives are options unless they are deficiency/definition/meta/etc.
        if contains_any(t, OBSERVATION_MARKERS):
            return False
        if contains_any(t, DEFINITION_MARKERS):
            return False
        return True
    
    # Action verb signal: must include at least one option verb
    if any(v in t for v in OPTION_VERBS):
        # Reject if it reads like an observation/finding/definition
        if contains_any(t, OBSERVATION_MARKERS):
            return False
        if contains_any(t, DEFINITION_MARKERS):
            return False
        return True
    
    return False

def is_observation(s: str) -> bool:
    """
    Check if sentence is an observation/state description, not an option.
    Catches both deficiency/finding phrasing and definition/explanation patterns.
    """
    t = lower(norm_ws(s))
    # If it's clearly deficiency/finding language and not clearly an option, reject as observation
    if contains_any(t, OBSERVATION_MARKERS) and not looks_like_option(t):
        return True
    # Also reject definition/explanation patterns unless they're clearly options
    if contains_any(t, DEFINITION_MARKERS) and not looks_like_option(t):
        return True
    return False

def run_selftest() -> Tuple[int, int]:
    """Run internal test cases for option language detection."""
    test_cases = [
        # (sentence, expected_reject_reason, expected_accept)
        ("CCTV coverage is limited at entryways and creates blind spots.", "observation_not_option", False),  # Extended to meet 7-word threshold
        ("Consider establishing a process to review the plan annually.", None, True),
        ("Exterior lighting is implemented for critical areas and approaches.", None, True),  # Extended to meet 7-word threshold
        ("An EAP is a detailed plan designed to guide emergency response procedures.", "observation_not_option", False),  # Extended
        ("Organizations should establish visitor management procedures and access controls.", None, True),  # Extended to meet 7-word threshold
        ("The facility lacks adequate perimeter barriers and security measures.", "observation_not_option", False),  # Extended
        ("Ensure that access control systems are maintained regularly.", None, True),
        ("Video surveillance refers to the use of cameras for monitoring purposes.", "observation_not_option", False),  # Extended
        ("Security personnel must conduct regular patrols and inspections daily.", None, True),  # Extended to meet 7-word threshold
        ("Emergency procedures are outlined below in the following sections.", "meta_preamble", False),  # Extended
        # New: Bullet and imperative tests
        ("• Collect and destroy expired credentials on a regular schedule.", None, True),  # Bullet + imperative (8 words)
        ("- Design access control systems to restrict entry to authorized personnel only.", None, True),  # Bullet + imperative (11 words)
        ("BEST PRACTICE Schedule regular security training exercises for all staff members.", None, True),  # Label + imperative (10 words)
        ("Collect expired credentials.", "short_fragment", False),  # Too short (2 words)
        ("Design systems.", "short_fragment", False),  # Too short (2 words)
    ]
    
    passed = 0
    failed = 0
    
    for sentence, expected_reject, expected_accept in test_cases:
        s0 = strip_leading_bullets(sentence)
        is_obs = is_observation(s0)
        is_option = looks_like_option(s0)
        is_meta = is_meta_preamble(sentence)
        is_short = len(s0.split()) < 7
        
        # Determine actual result
        if is_meta:
            actual_reject = "meta_preamble"
            actual_accept = False
        elif is_short:
            actual_reject = "short_fragment"
            actual_accept = False
        elif is_obs:
            actual_reject = "observation_not_option"
            actual_accept = False
        elif not is_option:
            actual_reject = "no_option_language"
            actual_accept = False
        else:
            actual_reject = None
            actual_accept = True
        
        # Check if result matches expectation
        if expected_accept:
            if actual_accept and actual_reject is None:
                passed += 1
            else:
                failed += 1
                print(f"[FAIL] '{sentence[:50]}...' - Expected ACCEPT, got reject={actual_reject}", file=sys.stderr)
        else:
            if not actual_accept and actual_reject == expected_reject:
                passed += 1
            else:
                failed += 1
                print(f"[FAIL] '{sentence[:50]}...' - Expected reject={expected_reject}, got accept={actual_accept} reject={actual_reject}", file=sys.stderr)
    
    return passed, failed

def has_auditable_anchor(text: str) -> bool:
    """Check if text contains auditable capability anchors."""
    t = lower(norm(text))
    return any(a in t for a in AUDITABLE_ANCHORS)

def is_state_vulnerability(text: str) -> bool:
    """
    Reject cognitive/state-vulnerability imperatives unless anchored to auditable capability.
    Examples of rejects: "Understand the threat", "Be aware of risks"
    Examples of accepts: "Understand the emergency procedures", "Be aware of documented policies"
    """
    t = lower(norm(text))
    if starts_with_any(t, COGNITIVE_PREFIXES) and not has_auditable_anchor(t):
        return True
    if starts_with_any(t, CONDITIONAL_COGNITIVE_PREFIXES) and not has_auditable_anchor(t):
        return True
    return False

def to_ofc_text(s: str) -> str:
    t = norm(s)
    lt = lower(t)
    if lt.startswith("consider") or lt.startswith("an option for consideration"):
        return t
    # deterministic prefix only; do not add how/tech
    # keep sentence as-is, only ensure it reads as a consideration
    first = t[0].lower() + t[1:] if t else t
    return "An option for consideration is to ensure that " + first

def split_sentences(chunk_text: str) -> List[str]:
    raw = norm(chunk_text)
    if not raw:
        return []
    parts = RE_SENT_SPLIT.split(raw)
    return [p.strip() for p in parts if p and p.strip()]

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

def get_db():
    import psycopg2  # type: ignore
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    # Fallback to SUPABASE_CORPUS_URL + password pattern
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
    p = Path("analytics/reports/ofc_mining_targets.json")
    if not p.exists():
        die("Missing analytics/reports/ofc_mining_targets.json. Run discover_ofc_mining_targets.py first.")
    return json.loads(p.read_text(encoding="utf-8"))

def fetch(cur, sql: str, params: Tuple[Any,...]=()) -> List[Dict[str, Any]]:
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit-docs", type=int, default=None)
    ap.add_argument("--source-set", type=str, default=None)
    ap.add_argument("--document-id", type=str, default=None)
    ap.add_argument("--max-chunks", type=int, default=None)
    ap.add_argument("--selftest", action="store_true", help="Run internal test cases for option language detection")
    ap.add_argument("--allow-authority", action="store_true", help="Allow processing AUTHORITY_SOURCE documents (testing only)")
    ap.add_argument("--allow-module-research", action="store_true", help="Allow mining from MODULE RESEARCH canonical sources (normally blocked)")
    ap.add_argument("--assign-subtype", action="store_true", default=True, help="Assign discipline_subtype_id during mining (default: true)")
    ap.add_argument("--no-assign-subtype", dest="assign_subtype", action="store_false", help="Disable subtype assignment")
    ap.add_argument("--subtype-min-score", type=float, default=0.35, help="Minimum score threshold for subtype assignment")
    ap.add_argument("--subtype-margin", type=float, default=1.35, help="Margin ratio (best/second) required for subtype assignment")
    args = ap.parse_args()
    
    # Run selftest if requested
    if args.selftest:
        passed, failed = run_selftest()
        print(f"[SELFTEST] Passed: {passed}, Failed: {failed}")
        sys.exit(0 if failed == 0 else 1)
    
    # SAFETY GUARD: Prevent accidental miner runs
    if args.apply and os.environ.get("ALLOW_MINER_APPLY") != "YES":
        die("Miner --apply blocked. Set ALLOW_MINER_APPLY=YES environment variable to enable.")

    # Load subtype lexicon if assignment is enabled
    subtype_lexicon = None
    if args.assign_subtype:
        try:
            print("[INFO] Building subtype lexicon...", file=sys.stderr)
            subtype_lexicon = build_lexicon()
            print(f"[INFO] Loaded lexicon for {len(subtype_lexicon)} subtypes", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] Failed to load subtype lexicon: {e}. Subtype assignment disabled.", file=sys.stderr)
            args.assign_subtype = False

    targets = load_targets()
    dest = targets["destination"]
    cite = targets["citations"]
    doc_chunks = targets["document_chunks"]

    dest_table = dest["table"]
    cite_table = cite["table"]
    chunks_table = doc_chunks["table"]

    chunk_id_col = doc_chunks["chunk_id_col"]
    chunk_text_col = doc_chunks["chunk_text_col"]
    chunk_doc_id_col = doc_chunks["document_id_col"]
    chunk_source_set_col = doc_chunks.get("source_set_col")
    chunk_locator_type_col = doc_chunks.get("locator_type_col")
    chunk_locator_col = doc_chunks.get("locator_col")

    dest_id_col = dest["id_col"]
    dest_text_col = dest["text_col"]
    dest_chunk_fk_col = dest.get("document_chunk_id_col")  # may be None

    cite_ofc_fk_col = cite["ofc_fk_col"]
    cite_chunk_fk_col = cite["chunk_fk_col"]
    use_direct_fk = cite.get("use_direct_fk", False)

    conn = get_db()
    cur = conn.cursor()

    # Check if destination table requires source_id and has submitted_by/status columns
    dest_cols_check = fetch(cur, f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema='public' AND table_name=%s
    """, (dest_table.replace("public.", ""),))
    dest_cols = {r["column_name"] for r in dest_cols_check}
    needs_source_id = "source_id" in dest_cols
    has_submitted_by = "submitted_by" in dest_cols
    has_status = "status" in dest_cols
    has_discipline_subtype_id = "discipline_subtype_id" in dest_cols
    # ofc_origin is now REQUIRED for ofc_candidate_queue (NOT NULL + CHECK)
    # Always include it when inserting into ofc_candidate_queue
    is_ofc_candidate_queue = dest_table == "public.ofc_candidate_queue" or dest_table == "ofc_candidate_queue"
    
    # Check if corpus_documents table exists and has document_role column
    corpus_docs_check = fetch(cur, """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema='public' 
        AND table_name='corpus_documents'
        AND column_name='document_role'
    """)
    has_document_role = len(corpus_docs_check) > 0
    
    # Build WHERE clause (always use table alias for safety)
    where = []
    params: List[Any] = []
    
    # HARD GUARD: Only mine from OFC_SOURCE documents (unless --allow-authority for testing)
    if has_document_role and not args.allow_authority:
        # Join to corpus_documents and filter by document_role = 'OFC_SOURCE'
        where.append("cd.document_role = 'OFC_SOURCE'")
    elif has_document_role and args.allow_authority:
        # Testing mode: allow AUTHORITY_SOURCE documents
        print("[WARN] --allow-authority enabled: processing AUTHORITY_SOURCE documents (testing only)", file=sys.stderr)
    else:
        # If document_role column doesn't exist, warn but allow (backward compatibility)
        print("[WARN] corpus_documents.document_role column not found. Mining from all documents.", file=sys.stderr)
    
    if args.source_set and chunk_source_set_col:
        where.append(f"dc.{chunk_source_set_col}=%s")
        params.append(args.source_set)
    if args.document_id:
        where.append(f"dc.{chunk_doc_id_col}=%s")
        params.append(args.document_id)
        # If document_id is specified, verify it's OFC_SOURCE (unless --allow-authority)
        if has_document_role and not args.allow_authority:
            doc_role_check = fetch(cur, """
                SELECT document_role 
                FROM public.corpus_documents 
                WHERE id = %s
            """, (args.document_id,))
            if doc_role_check and doc_role_check[0].get("document_role") != "OFC_SOURCE":
                die(f"Document {args.document_id} is not OFC_SOURCE (role: {doc_role_check[0].get('document_role', 'NULL')}). Mining blocked.")

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    limit_sql = f"LIMIT {int(args.max_chunks)}" if args.max_chunks else ""
    
    # Build query: join to corpus_documents for document_role filtering
    if has_document_role:
        # Join to corpus_documents for role filtering (LEFT JOIN if --allow-authority for testing)
        join_type = "LEFT JOIN" if args.allow_authority else "JOIN"
        join_clause = f"{join_type} public.corpus_documents cd ON dc.{chunk_doc_id_col} = cd.id"
        
        if needs_source_id:
            # Try multiple paths to get source_id:
            # 1. corpus_documents -> source_registry -> canonical_sources (preferred)
            # 2. documents table (legacy)
            chunks_query = f"""
                SELECT dc.{chunk_id_col}, dc.{chunk_text_col}, dc.{chunk_doc_id_col}, 
                       COALESCE(cs.source_id, d.source_id) AS source_id,
                       cs.source_kind AS source_kind,
                       cs.title AS source_title,
                       cs.citation_text AS source_citation_text
                {f', dc.{chunk_locator_type_col}' if chunk_locator_type_col else ''}
                {f', dc.{chunk_locator_col}' if chunk_locator_col else ''}
                FROM {chunks_table} dc
                {join_clause}
                LEFT JOIN public.source_registry sr ON cd.source_registry_id = sr.id
                LEFT JOIN public.canonical_sources cs ON sr.source_key = cs.source_key
                LEFT JOIN public.documents d ON dc.{chunk_doc_id_col} = d.document_id
                {where_sql} {limit_sql}
            """
        else:
            chunk_cols = [chunk_id_col, chunk_text_col, chunk_doc_id_col]
            if chunk_locator_type_col: chunk_cols.append(chunk_locator_type_col)
            if chunk_locator_col: chunk_cols.append(chunk_locator_col)
            chunks_query = f"""
                SELECT {', '.join(chunk_cols)} 
                FROM {chunks_table} dc
                {join_clause}
                {where_sql} {limit_sql}
            """
    else:
        # Fallback: no document_role filtering (backward compatibility)
        if needs_source_id:
            chunks_query = f"""
                SELECT dc.{chunk_id_col}, dc.{chunk_text_col}, dc.{chunk_doc_id_col}, 
                       d.source_id,
                       cs.source_kind AS source_kind,
                       cs.title AS source_title,
                       cs.citation_text AS source_citation_text
                {f', dc.{chunk_locator_type_col}' if chunk_locator_type_col else ''}
                {f', dc.{chunk_locator_col}' if chunk_locator_col else ''}
                FROM {chunks_table} dc
                LEFT JOIN public.documents d ON dc.{chunk_doc_id_col} = d.document_id
                LEFT JOIN public.canonical_sources cs ON d.source_id = cs.source_id
                {where_sql} {limit_sql}
            """
        else:
            chunk_cols = [chunk_id_col, chunk_text_col, chunk_doc_id_col]
            if chunk_locator_type_col: chunk_cols.append(chunk_locator_type_col)
            if chunk_locator_col: chunk_cols.append(chunk_locator_col)
            chunks_query = f"SELECT {', '.join(chunk_cols)} FROM {chunks_table} dc {where_sql} {limit_sql};"
    
    chunks = fetch(cur, chunks_query, tuple(params))

    if not chunks:
        if has_document_role and not args.allow_authority:
            die("No document_chunks matched the selection. Ensure at least one document has document_role = 'OFC_SOURCE'.")
        else:
            die("No document_chunks matched the selection.")

    # Existing dedupe set by (chunk_id, normalized_ofc_text)
    # If destination supports document_chunk_id FK, dedupe by it; else dedupe by citation table existence later.
    existing = set()
    if dest_chunk_fk_col:
        rows = fetch(cur, f"SELECT {dest_chunk_fk_col} AS chunk_id, {dest_text_col} AS txt FROM {dest_table};")
        for r in rows:
            if r["chunk_id"] is None or r["txt"] is None:
                continue
            existing.add((str(r["chunk_id"]), norm(r["txt"])))
    else:
        # Dedupe by checking citations table for existing bindings
        rows = fetch(cur, f"SELECT {cite_ofc_fk_col} AS ofc_id FROM {cite_table};")
        existing_ofc_ids = {str(r["ofc_id"]) for r in rows if r["ofc_id"] is not None}
        if existing_ofc_ids:
            placeholders = ",".join(["%s"] * len(existing_ofc_ids))
            existing_rows = fetch(cur, f"SELECT {dest_text_col} AS txt FROM {dest_table} WHERE {dest_id_col} IN ({placeholders});", tuple(existing_ofc_ids))
            for r in existing_rows:
                if r["txt"] is None:
                    continue
                existing.add(("_any", norm(r["txt"])))  # Use "_any" as placeholder since we can't match by chunk_id

    rejects = Counter()
    inserts = 0
    extracted = 0
    docs_scanned = set()
    doc_candidate_counts = Counter()
    needs_source_id = "source_id" in dest_cols
    subtype_assigned_count = 0
    subtype_unassigned_count = 0
    subtype_assigned_by_code = Counter()
    skipped_module_research = 0

    for ch in chunks:
        cid = str(ch[chunk_id_col])
        doc_id = str(ch[chunk_doc_id_col])
        docs_scanned.add(doc_id)
        
        # GUARDRAIL: Block MODULE RESEARCH sources unless explicitly allowed
        if not args.allow_module_research and needs_source_id:
            source_kind = ch.get("source_kind")
            source_title = ch.get("source_title")
            source_citation = ch.get("source_citation_text")
            # Use centralized detection (prefers source_kind, falls back to string matching)
            if is_module_research_source(source_kind, source_title, source_citation):
                skipped_module_research += 1
                rejects["module_research_blocked"] += 1
                continue
        
        text = ch.get(chunk_text_col) or ""
        if not text or is_pdfish_noise(text):
            rejects["empty_or_noise"] += 1
            continue

        sents = split_sentences(text)
        for s in sents:
            if len(s) < 40 or len(s) > 350:
                continue

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

            # Normalize: strip bullets and labels first
            s0 = strip_leading_bullets(s)

            # Minimum content threshold: reject trivial fragments
            if len(s0.split()) < 7:
                rejects["short_fragment"] += 1
                continue

            # Hard reject observations (state descriptions) unless clearly an option
            if is_observation(s0):
                rejects["observation_not_option"] += 1
                continue

            # Hard require option language (pass s0, but looks_like_option will handle bullet stripping internally)
            if not looks_like_option(s0):
                rejects["no_option_language"] += 1
                continue

            if not (is_reco_sentence(s0) or is_capability_sentence(s0)):
                continue

            # VERBATIM: Use normalized sentence (with bullets/labels stripped) directly, no boilerplate prefixing
            ofc_txt = norm(s0)
            
            # Length bounds (40 chars minimum; no maximum - store full text)
            # NOTE: Removed 400 char max to prevent truncation. Full text is stored verbatim.
            if len(ofc_txt) < 40:
                rejects["length_after_norm"] += 1
                continue

            key = (cid, norm(ofc_txt))
            if key in existing:
                rejects["duplicate"] += 1
                continue

            extracted += 1
            doc_candidate_counts[doc_id] += 1

            # Classify subtype if enabled
            assigned_subtype_id = None
            subtype_explanation = None
            if args.assign_subtype and subtype_lexicon:
                assigned_subtype_id, subtype_explanation = classify_subtype(
                    ofc_txt,
                    subtype_lexicon,
                    min_score=args.subtype_min_score,
                    margin=args.subtype_margin
                )
                if assigned_subtype_id:
                    subtype_assigned_count += 1
                    subtype_code = subtype_lexicon[assigned_subtype_id]["code"]
                    subtype_assigned_by_code[subtype_code] += 1
                else:
                    subtype_unassigned_count += 1

            if not args.apply:
                continue

            # Insert candidate with submitted_by='MINED' and status='PENDING' if columns exist
            insert_cols = [dest_text_col]
            insert_vals = [ofc_txt]
            
            # Add subtype_id if column exists and we have an assignment
            if has_discipline_subtype_id and assigned_subtype_id:
                insert_cols.append("discipline_subtype_id")
                insert_vals.append(assigned_subtype_id)
            
            if use_direct_fk:
                insert_cols.append(cite_chunk_fk_col)
                insert_vals.append(cid)
            
            if needs_source_id:
                source_id_val = ch.get("source_id")
                if not source_id_val:
                    # Try to get or create a default "UNKNOWN" source_id for chunks without proper source linkage
                    # This allows mining to proceed even when source_registry → canonical_sources linkage is missing
                    default_source_result = fetch(cur, """
                        SELECT source_id FROM public.canonical_sources
                        WHERE title = 'UNKNOWN SOURCE' AND publisher = 'MISC'
                        LIMIT 1
                    """)
                    if default_source_result:
                        source_id_val = default_source_result[0]["source_id"]
                    else:
                        # Create default source if it doesn't exist
                        cur.execute("""
                            INSERT INTO public.canonical_sources 
                            (title, publisher, source_type, citation_text, source_kind)
                            VALUES ('UNKNOWN SOURCE', 'MISC', 'OTHER', 'UNKNOWN SOURCE, MISC', 'CORPUS')
                            RETURNING source_id
                        """)
                        source_id_val = cur.fetchone()[0]
                        conn.commit()  # Commit the default source creation
                    
                    rejects["missing_source_id"] += 1  # Still count as missing for reporting
                    # But continue with default source_id instead of skipping
                
                insert_cols.append("source_id")
                insert_vals.append(source_id_val)
            
            if has_submitted_by:
                insert_cols.append("submitted_by")
                insert_vals.append("MINED")
            
            if has_status:
                insert_cols.append("status")
                insert_vals.append("PENDING")
            
            # CRITICAL: Force ofc_origin='CORPUS' for all CORPUS mining operations
            # ofc_origin is now REQUIRED (NOT NULL + CHECK) - always set for ofc_candidate_queue
            if is_ofc_candidate_queue:
                insert_cols.append("ofc_origin")
                insert_vals.append("CORPUS")
            
            if use_direct_fk:
                # Citation binding via direct FK column in destination table
                cur.execute(
                    f"INSERT INTO {dest_table} ({', '.join(insert_cols)}) VALUES ({', '.join(['%s'] * len(insert_vals))}) RETURNING {dest_id_col};",
                    tuple(insert_vals)
                )
                new_id = cur.fetchone()[0]
                # No separate citation insert needed - FK column handles it
            elif dest_chunk_fk_col:
                # Destination table has chunk FK but we still need separate citation table
                if dest_chunk_fk_col not in insert_cols:
                    insert_cols.append(dest_chunk_fk_col)
                    insert_vals.append(cid)
                cur.execute(
                    f"INSERT INTO {dest_table} ({', '.join(insert_cols)}) VALUES ({', '.join(['%s'] * len(insert_vals))}) RETURNING {dest_id_col};",
                    tuple(insert_vals)
                )
                new_id = cur.fetchone()[0]
                # Bind citation to chunk via citation table
                cur.execute(
                    f"INSERT INTO {cite_table} ({cite_ofc_fk_col}, {cite_chunk_fk_col}) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                    (new_id, cid)
                )
            else:
                # No chunk FK in destination - insert candidate then bind via citation table
                cur.execute(
                    f"INSERT INTO {dest_table} ({', '.join(insert_cols)}) VALUES ({', '.join(['%s'] * len(insert_vals))}) RETURNING {dest_id_col};",
                    tuple(insert_vals)
                )
                new_id = cur.fetchone()[0]
                # Bind citation to chunk
                cur.execute(
                    f"INSERT INTO {cite_table} ({cite_ofc_fk_col}, {cite_chunk_fk_col}) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                    (new_id, cid)
                )

            existing.add(key)
            inserts += 1

    if args.apply:
        conn.commit()

    # Log MODULE RESEARCH guardrail status
    if skipped_module_research > 0:
        print(f"[GUARDRAIL] Skipped {skipped_module_research} chunks from MODULE RESEARCH sources (use --allow-module-research to include)", file=sys.stderr)

    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "chunks_scanned": len(chunks),
        "documents_scanned": len(docs_scanned),
        "candidates_extracted": extracted,
        "candidates_inserted": inserts,
        "rejected_counts_by_reason": dict(rejects),
        "skipped_module_research": skipped_module_research,
        "top_documents_by_candidates": dict(doc_candidate_counts.most_common(20)),
        "subtype_assignment": {
            "enabled": args.assign_subtype,
            "subtype_assigned_count": subtype_assigned_count if args.assign_subtype else 0,
            "subtype_unassigned_count": subtype_unassigned_count if args.assign_subtype else 0,
            "top_assigned_subtypes": dict(subtype_assigned_by_code.most_common(20)) if args.assign_subtype else {}
        } if args.assign_subtype else None,
        "selection": {
            "source_set": args.source_set,
            "document_id": args.document_id,
            "max_chunks": args.max_chunks
        },
        "tables": {
            "document_chunks": chunks_table,
            "destination": dest_table,
            "citations": cite_table
        }
    }
    Path("analytics/reports/ofc_mining_v3_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("[OK] OFC mining v3 complete.")
    print(json.dumps(report, indent=2))

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
