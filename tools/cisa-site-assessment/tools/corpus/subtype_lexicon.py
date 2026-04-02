#!/usr/bin/env python3
"""
Deterministic subtype lexicon builder for OFC classification.

Builds token lexicons from subtype names, codes, and curated synonyms.
Used for high-confidence subtype assignment during mining.
"""
import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_runtime_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    raise SystemExit("Missing RUNTIME_DATABASE_URL")

def get_corpus_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    raise SystemExit("Missing CORPUS_DATABASE_URL")

# Curated synonyms map (high-frequency subtypes)
CURATED_SYNONYMS = {
    "VSS_EXTERIOR_CAMERAS": ["cctv", "camera", "cameras", "video", "surveillance", "recording", "monitoring", "camera system"],
    "ILLUMINATION": ["lighting", "lights", "illumination", "light levels", "exterior lighting", "adequate lighting"],
    "EAC": ["badge", "badges", "credential", "credentials", "access card", "proximity", "reader", "readers", "turnstile", "turnstiles"],
    "VISITOR_MANAGEMENT": ["visitor", "visitors", "guest", "guests", "check-in", "badge issuance", "visitor processing"],
    "BARRIERS": ["fence", "fences", "gate", "gates", "bollard", "bollards", "barrier", "barriers", "standoff"],
    "EMERGENCY_COMMUNICATIONS": ["911", "public messaging", "alert", "alerts", "notification", "notifications", "mass notification", "emergency communication"],
    "PERIMETER": ["perimeter", "boundary", "boundaries", "fence line", "property line"],
    "ACCESS_CONTROL": ["access control", "entry control", "entry point", "entry points", "checkpoint", "checkpoints"],
    "PATROL": ["patrol", "patrols", "patrolling", "security patrol", "routine patrol"],
    "LOCKDOWN": ["lockdown", "shelter in place", "secure in place"],
    "EVACUATION": ["evacuation", "evacuate", "evacuating", "exit", "egress"],
    "TRAINING": ["training", "train", "drill", "drills", "exercise", "exercises", "briefing", "briefings"],
    "INSPECTION": ["inspection", "inspections", "inspect", "inspecting", "maintenance", "maintain"],
    "ALARM": ["alarm", "alarms", "intrusion detection", "motion sensor", "motion sensors"],
    "COMMUNICATIONS": ["communication", "communications", "radio", "radios", "two-way radio"],
}

def tokenize_text(text: str) -> List[str]:
    """Tokenize text: lowercase, strip punctuation, split on whitespace."""
    if not text:
        return []
    # Normalize: lowercase, replace punctuation with spaces
    normalized = re.sub(r'[^\w\s]', ' ', text.lower())
    tokens = [t for t in normalized.split() if len(t) >= 2]  # Min 2 chars
    return tokens

def singularize_simple(token: str) -> str:
    """Simple singularization: strip trailing 's' if len > 3."""
    if len(token) > 3 and token.endswith('s'):
        return token[:-1]
    return token

def build_base_tokens(subtype_code: str, subtype_name: str) -> Set[str]:
    """Build base tokens from subtype code and name."""
    tokens = set()
    
    # From code: split on underscore
    code_parts = subtype_code.split('_')
    for part in code_parts:
        if len(part) >= 3:  # Skip short codes
            tokens.add(part.lower())
    
    # From name: tokenize
    name_tokens = tokenize_text(subtype_name)
    for token in name_tokens:
        tokens.add(token)
        # Add singularized version
        singular = singularize_simple(token)
        if singular != token:
            tokens.add(singular)
    
    return tokens

def build_lexicon() -> Dict[str, Dict[str, any]]:
    """
    Build subtype lexicon from database.
    
    Returns:
        dict[subtype_id] = {
            "code": str,
            "name": str,
            "tokens": set[str]
        }
    """
    # Try CORPUS DB first (discipline_subtypes might be there)
    conn = None
    try:
        conn = get_corpus_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, code, name
            FROM public.discipline_subtypes
            WHERE is_active = true
            ORDER BY code
        """)
        rows = cur.fetchall()
        cur.close()
    except Exception:
        # Try RUNTIME DB
        if conn:
            conn.close()
        conn = get_runtime_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, code, name
            FROM public.discipline_subtypes
            WHERE is_active = true
            ORDER BY code
        """)
        rows = cur.fetchall()
        cur.close()
    
    lexicon = {}
    all_tokens = Counter()
    
    for subtype_id, code, name in rows:
        subtype_id_str = str(subtype_id)
        
        # Build base tokens
        tokens = build_base_tokens(code, name or "")
        
        # Add curated synonyms if available
        if code in CURATED_SYNONYMS:
            for synonym in CURATED_SYNONYMS[code]:
                synonym_tokens = tokenize_text(synonym)
                tokens.update(synonym_tokens)
                # Add singularized versions
                for st in synonym_tokens:
                    singular = singularize_simple(st)
                    if singular != st:
                        tokens.add(singular)
        
        lexicon[subtype_id_str] = {
            "code": code,
            "name": name or "",
            "tokens": tokens
        }
        
        # Track token frequency
        for token in tokens:
            all_tokens[token] += 1
    
    conn.close()
    
    # Generate stats report
    stats = {
        "total_subtypes": len(lexicon),
        "avg_token_count": sum(len(l["tokens"]) for l in lexicon.values()) / len(lexicon) if lexicon else 0,
        "top_tokens_by_frequency": dict(all_tokens.most_common(50))
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    stats_path = Path("analytics/reports/subtype_lexicon_stats.json")
    stats_path.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    
    return lexicon

def score_text_against_lexicon(text: str, tokens: Set[str]) -> float:
    """
    Score text against a subtype lexicon.
    
    Returns normalized score (token hits / sqrt(text_length)).
    """
    if not text or not tokens:
        return 0.0
    
    text_tokens = set(tokenize_text(text))
    
    # Count token hits
    hits = len(text_tokens & tokens)
    
    # Check for exact phrase hits (multiword synonyms)
    text_lower = text.lower()
    phrase_hits = 0
    for token in tokens:
        # If token is multiword (contains space), check for exact phrase match
        if ' ' in token and token in text_lower:
            phrase_hits += 1
    
    # Score = token hits + (2 * phrase hits)
    raw_score = hits + (2 * phrase_hits)
    
    # Normalize by text length (sqrt to reduce impact of very long texts)
    text_token_count = len(text_tokens)
    if text_token_count == 0:
        return 0.0
    
    normalized_score = raw_score / (text_token_count ** 0.5)
    
    return normalized_score

def classify_subtype(
    text: str,
    lexicon_map: Dict[str, Dict[str, any]],
    min_score: float = 0.35,
    margin: float = 1.35
) -> Tuple[Optional[str], Dict[str, any]]:
    """
    Classify text to a subtype using lexicon scoring.
    
    Returns:
        (subtype_id or None, explanation_dict)
    """
    if not text or not lexicon_map:
        return None, {"reason": "empty_text_or_lexicon"}
    
    scores = []
    text_tokens = set(tokenize_text(text))
    
    for subtype_id, subtype_info in lexicon_map.items():
        tokens = subtype_info["tokens"]
        score = score_text_against_lexicon(text, tokens)
        
        if score > 0:
            # Find hit tokens for explanation
            hit_tokens = list(text_tokens & tokens)[:12]
            scores.append({
                "subtype_id": subtype_id,
                "subtype_code": subtype_info["code"],
                "score": score,
                "hit_tokens": hit_tokens
            })
    
    if not scores:
        return None, {"reason": "no_matches"}
    
    # Sort by score descending
    scores.sort(key=lambda x: x["score"], reverse=True)
    
    best = scores[0]
    best_score = best["score"]
    
    # Check minimum score threshold
    if best_score < min_score:
        return None, {
            "reason": "below_min_score",
            "best_subtype_code": best["subtype_code"],
            "best_score": best_score,
            "min_score": min_score
        }
    
    # Check margin threshold (best must be significantly better than second)
    if len(scores) > 1:
        second_best_score = scores[1]["score"]
        if second_best_score > 0 and (best_score / second_best_score) < margin:
            return None, {
                "reason": "insufficient_margin",
                "best_subtype_code": best["subtype_code"],
                "best_score": best_score,
                "second_best_subtype_code": scores[1]["subtype_code"],
                "second_best_score": second_best_score,
                "margin_ratio": best_score / second_best_score if second_best_score > 0 else 0,
                "required_margin": margin
            }
    
    # Confident assignment
    explanation = {
        "best_subtype_code": best["subtype_code"],
        "best_score": best_score,
        "second_best_score": scores[1]["score"] if len(scores) > 1 else 0.0,
        "hit_tokens": best["hit_tokens"]
    }
    
    return best["subtype_id"], explanation

if __name__ == "__main__":
    # Test lexicon building
    lexicon = build_lexicon()
    print(f"[INFO] Built lexicon for {len(lexicon)} subtypes")
    
    # Test classification
    test_texts = [
        "Exterior lighting is implemented for critical areas and approaches.",
        "CCTV cameras are installed at entry points for surveillance.",
        "Badge readers are used at access control points.",
        "Visitor check-in procedures are established at the main entrance.",
        "Fences and gates provide perimeter security barriers.",
        "Emergency notification systems alert occupants during incidents.",
    ]
    
    print("\n[TEST] Classification examples:")
    for text in test_texts:
        subtype_id, explanation = classify_subtype(text, lexicon)
        if subtype_id:
            subtype_info = lexicon[subtype_id]
            print(f"  '{text[:60]}...' -> {subtype_info['code']} (score: {explanation['best_score']:.3f})")
        else:
            print(f"  '{text[:60]}...' -> None ({explanation.get('reason', 'unknown')})")
