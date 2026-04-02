#!/usr/bin/env python3
"""
Audit OFC-Question Linker Readiness

Analyzes database state to explain why promotions might be zero:
- Questions: total, with subtype, distinct subtypes
- OFCs: total, with subtype, distinct subtypes  
- Citation-bound OFCs: count cited, cited with subtype
- Join health: for each question subtype, how many cited OFCs share that subtype
"""

import json
import os
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

def get_runtime_db():
    """Get RUNTIME database connection (for questions and OFCs)."""
    import psycopg2  # type: ignore
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
        clean_url = runtime_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            raise SystemExit(f"Could not parse project_ref from RUNTIME_URL: {runtime_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            # Try direct port
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD.")

def fetch_rows(conn, sql: str, params: Tuple[Any, ...]=()) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    out = []
    for row in cur.fetchall():
        out.append({cols[i]: row[i] for i in range(len(cols))})
    cur.close()
    return out

def read_schema_discovery() -> Dict[str, Any]:
    p = Path("analytics/reports/ofc_link_schema_discovery.json")
    if not p.exists():
        raise SystemExit("Missing analytics/reports/ofc_link_schema_discovery.json. Run discover_linking_schema.py first.")
    return json.loads(p.read_text(encoding="utf-8"))

def main():
    schema = read_schema_discovery()
    
    qtbl = schema["selected_question_table"]["name"]
    otbl = schema["selected_ofc_table"]["name"]
    ctbl = schema["selected_citation_table"]["name"]
    
    q_id_col = schema["selected_question_table"]["question_id_col"]
    q_subtype_col = schema["selected_question_table"].get("subtype_col")
    
    o_id_col = schema["selected_ofc_table"]["ofc_id_col"]
    o_subtype_col = schema["selected_ofc_table"].get("subtype_col")
    
    citation_ofc_id_col = schema["selected_citation_table"]["ofc_id_col"]
    
    conn = get_runtime_db()
    
    # A) Questions: total, with subtype populated, subtype distinct count
    questions_total = fetch_rows(conn, f"SELECT COUNT(*) as cnt FROM {qtbl};")[0]["cnt"]
    
    questions_with_subtype = 0
    question_subtypes_distinct = 0
    question_subtype_counts = Counter()
    
    if q_subtype_col:
        q_subtype_data = fetch_rows(conn, f"SELECT {q_subtype_col} FROM {qtbl} WHERE {q_subtype_col} IS NOT NULL;")
        questions_with_subtype = len(q_subtype_data)
        question_subtype_counts = Counter(r[q_subtype_col] for r in q_subtype_data if r[q_subtype_col] is not None)
        question_subtypes_distinct = len(question_subtype_counts)
    else:
        # Check if subtype_code exists even if not detected
        try:
            q_subtype_data = fetch_rows(conn, f"SELECT subtype_code FROM {qtbl} WHERE subtype_code IS NOT NULL;")
            questions_with_subtype = len(q_subtype_data)
            question_subtype_counts = Counter(r["subtype_code"] for r in q_subtype_data if r["subtype_code"] is not None)
            question_subtypes_distinct = len(question_subtype_counts)
            q_subtype_col = "subtype_code"  # Use this for join health
        except Exception:
            pass
    
    # B) OFCs: total, with subtype populated, subtype distinct count
    ofcs_total = fetch_rows(conn, f"SELECT COUNT(*) as cnt FROM {otbl};")[0]["cnt"]
    
    ofcs_with_subtype = 0
    ofc_subtypes_distinct = 0
    ofc_subtype_counts = Counter()
    
    if o_subtype_col:
        o_subtype_data = fetch_rows(conn, f"SELECT {o_subtype_col} FROM {otbl} WHERE {o_subtype_col} IS NOT NULL;")
        ofcs_with_subtype = len(o_subtype_data)
        ofc_subtype_counts = Counter(str(r[o_subtype_col]) for r in o_subtype_data if r[o_subtype_col] is not None)
        ofc_subtypes_distinct = len(ofc_subtype_counts)
    
    # C) Citation-bound OFCs: count cited, cited with subtype populated
    cited_ofc_ids = set()
    cited_rows = fetch_rows(conn, f"SELECT DISTINCT {citation_ofc_id_col} FROM {ctbl} WHERE {citation_ofc_id_col} IS NOT NULL;")
    cited_ofc_ids = set(str(r[citation_ofc_id_col]) for r in cited_rows)
    cited_ofcs_total = len(cited_ofc_ids)
    
    cited_ofcs_with_subtype = 0
    cited_ofc_subtype_counts = Counter()
    
    if o_subtype_col and cited_ofc_ids:
        # Get subtypes for cited OFCs
        placeholders = ",".join(["%s"] * len(cited_ofc_ids))
        cited_subtype_data = fetch_rows(
            conn,
            f"SELECT {o_id_col}, {o_subtype_col} FROM {otbl} WHERE {o_id_col} IN ({placeholders}) AND {o_subtype_col} IS NOT NULL;",
            tuple(cited_ofc_ids)
        )
        cited_ofcs_with_subtype = len(cited_subtype_data)
        cited_ofc_subtype_counts = Counter(str(r[o_subtype_col]) for r in cited_subtype_data if r[o_subtype_col] is not None)
    
    # D) Join health: for each question subtype, how many cited OFCs share that subtype
    join_health = {}
    
    if q_subtype_col and o_subtype_col and question_subtype_counts and cited_ofc_subtype_counts:
        # Check if subtypes can match (same type)
        # Questions might have codes, OFCs might have UUIDs - check compatibility
        for q_subtype, q_count in question_subtype_counts.items():
            # Try direct match
            matching_ofcs = cited_ofc_subtype_counts.get(str(q_subtype), 0)
            if matching_ofcs == 0:
                # Try case-insensitive match
                q_subtype_lower = str(q_subtype).lower()
                for ofc_subtype, ofc_count in cited_ofc_subtype_counts.items():
                    if str(ofc_subtype).lower() == q_subtype_lower:
                        matching_ofcs = ofc_count
                        break
            
            join_health[str(q_subtype)] = {
                "questions_count": q_count,
                "cited_ofcs_matching_subtype": matching_ofcs,
                "coverage_ratio": matching_ofcs / q_count if q_count > 0 else 0.0
            }
    
    # Build audit report
    audit = {
        "questions": {
            "total": questions_total,
            "with_subtype_populated": questions_with_subtype,
            "subtype_population_rate": questions_with_subtype / questions_total if questions_total > 0 else 0.0,
            "subtype_distinct_count": question_subtypes_distinct,
            "subtype_column": q_subtype_col,
            "subtype_sample_counts": dict(question_subtype_counts.most_common(10))
        },
        "ofcs": {
            "total": ofcs_total,
            "with_subtype_populated": ofcs_with_subtype,
            "subtype_population_rate": ofcs_with_subtype / ofcs_total if ofcs_total > 0 else 0.0,
            "subtype_distinct_count": ofc_subtypes_distinct,
            "subtype_column": o_subtype_col,
            "subtype_sample_counts": dict(ofc_subtype_counts.most_common(10))
        },
        "citation_bound_ofcs": {
            "total_cited": cited_ofcs_total,
            "cited_with_subtype_populated": cited_ofcs_with_subtype,
            "cited_subtype_population_rate": cited_ofcs_with_subtype / cited_ofcs_total if cited_ofcs_total > 0 else 0.0,
            "cited_subtype_distinct_count": len(cited_ofc_subtype_counts),
            "cited_subtype_sample_counts": dict(cited_ofc_subtype_counts.most_common(10))
        },
        "join_health": {
            "question_subtypes_analyzed": len(join_health),
            "subtypes_with_matching_ofcs": sum(1 for v in join_health.values() if v["cited_ofcs_matching_subtype"] > 0),
            "subtype_coverage": join_health
        },
        "diagnosis": {
            "subtype_compatibility": "unknown",  # Will be set below
            "bottleneck": []
        }
    }
    
    # Diagnosis
    if not q_subtype_col or not o_subtype_col:
        audit["diagnosis"]["bottleneck"].append("Missing subtype columns in schema discovery")
        audit["diagnosis"]["subtype_compatibility"] = "cannot_determine"
    elif questions_with_subtype == 0:
        audit["diagnosis"]["bottleneck"].append("No questions have subtype populated")
        audit["diagnosis"]["subtype_compatibility"] = "questions_missing_subtype"
    elif cited_ofcs_with_subtype == 0:
        audit["diagnosis"]["bottleneck"].append("No cited OFCs have subtype populated")
        audit["diagnosis"]["subtype_compatibility"] = "ofcs_missing_subtype"
    elif cited_ofcs_total == 0:
        audit["diagnosis"]["bottleneck"].append("No OFCs are citation-bound")
        audit["diagnosis"]["subtype_compatibility"] = "no_citations"
    else:
        # Check if subtypes can match
        matching_count = sum(1 for v in join_health.values() if v["cited_ofcs_matching_subtype"] > 0)
        if matching_count == 0:
            audit["diagnosis"]["bottleneck"].append("Question subtypes and OFC subtypes do not match (likely different types: codes vs UUIDs)")
            audit["diagnosis"]["subtype_compatibility"] = "incompatible_types"
        elif matching_count < len(join_health) * 0.5:
            audit["diagnosis"]["bottleneck"].append(f"Only {matching_count}/{len(join_health)} question subtypes have matching cited OFCs")
            audit["diagnosis"]["subtype_compatibility"] = "partial_match"
        else:
            audit["diagnosis"]["subtype_compatibility"] = "compatible"
            audit["diagnosis"]["bottleneck"].append("Subtype matching appears functional - check threshold/calibration")
    
    # Write report
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/ofc_link_readiness_audit.json").write_text(
        json.dumps(audit, indent=2), encoding="utf-8"
    )
    
    # Print summary
    print("=" * 70)
    print("OFC-Question Linker Readiness Audit")
    print("=" * 70)
    print(f"\nQuestions:")
    print(f"  Total: {questions_total}")
    print(f"  With subtype: {questions_with_subtype} ({audit['questions']['subtype_population_rate']:.1%})")
    print(f"  Distinct subtypes: {question_subtypes_distinct}")
    print(f"  Subtype column: {q_subtype_col or 'NOT FOUND'}")
    
    print(f"\nOFCs:")
    print(f"  Total: {ofcs_total}")
    print(f"  With subtype: {ofcs_with_subtype} ({audit['ofcs']['subtype_population_rate']:.1%})")
    print(f"  Distinct subtypes: {ofc_subtypes_distinct}")
    print(f"  Subtype column: {o_subtype_col or 'NOT FOUND'}")
    
    print(f"\nCitation-bound OFCs:")
    print(f"  Total cited: {cited_ofcs_total}")
    print(f"  Cited with subtype: {cited_ofcs_with_subtype} ({audit['citation_bound_ofcs']['cited_subtype_population_rate']:.1%})")
    print(f"  Distinct cited subtypes: {len(cited_ofc_subtype_counts)}")
    
    print(f"\nJoin Health:")
    print(f"  Question subtypes analyzed: {len(join_health)}")
    print(f"  Subtypes with matching cited OFCs: {audit['join_health']['subtypes_with_matching_ofcs']}")
    
    print(f"\nDiagnosis:")
    print(f"  Subtype compatibility: {audit['diagnosis']['subtype_compatibility']}")
    if audit["diagnosis"]["bottleneck"]:
        print(f"  Bottlenecks:")
        for b in audit["diagnosis"]["bottleneck"]:
            print(f"    - {b}")
    
    print(f"\n[OK] Wrote analytics/reports/ofc_link_readiness_audit.json")
    
    conn.close()

if __name__ == "__main__":
    main()
