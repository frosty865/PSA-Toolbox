"""
Humanize and sanitize report text for DOCX export.
- No internal IDs/keys/enum literals in narrative.
- Acronym expansion on first use (e.g. WASD).
- Normalize spacing and remove duplicate sentences.
"""
from __future__ import annotations

import re
from typing import Any

# -----------------------------------------------------------------------------
# Normalize spacing
# -----------------------------------------------------------------------------


def normalize_spacing(s: str) -> str:
    """
    Collapse whitespace, remove duplicate sentence runs within a paragraph,
    remove double spaces after periods.
    """
    if not s or not isinstance(s, str):
        return ""
    s = " ".join(s.split())
    s = re.sub(r"\.\s{2,}", ". ", s)
    # Remove exact duplicate sentences (same sentence repeated)
    parts = re.split(r"(?<=[.!?])\s+", s)
    seen: set[str] = set()
    out: list[str] = []
    for part in parts:
        p = part.strip()
        if not p:
            continue
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return " ".join(out).strip()


def ensure_synthesis_formatting(s: str) -> str:
    """
    Ensure space after ':' and '. ' between sentences (no jammed synthesis text).
    Use for Cross-Infrastructure Synthesis paragraphs and bullet text only.
    """
    if not s or not isinstance(s, str):
        return ""
    s = re.sub(r":(\S)", r": \1", s)  # "Label:Value" -> "Label: Value"
    s = re.sub(r"\.([A-Z])", r". \1", s)  # "Sentence.Next" -> "Sentence. Next"
    return s


def dedupe_sentences(text: str) -> str:
    """
    Remove consecutive duplicate sentences. Split by .!?; trim; drop repeats; rejoin with space.
    Used only for Exposure Description paragraph to avoid "X. X." repetition.
    """
    if not text or not isinstance(text, str):
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    seen: set[str] = set()
    out: list[str] = []
    for part in parts:
        p = part.strip()
        if not p:
            continue
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return " ".join(out).strip()


# -----------------------------------------------------------------------------
# Human labels (key -> friendly text)
# -----------------------------------------------------------------------------

# Known question IDs and internal keys -> stakeholder label
HUMAN_LABEL_MAP: dict[str, str] = {
    "E-3_more_than_one_connection": "Additional electric service connections present",
    "backup_duration_hours": "Backup duration (hours)",
    "time_to_impact_hours": "Time to severe impact (hours)",
    "curve_time_to_impact_hours": "Time to severe impact (hours)",
    "curve_backup_duration_hours": "Backup duration (hours)",
    "comm_restoration_coordination": "Restoration coordination with provider in place",
    "CO-11_restoration_coordination": "Restoration coordination with provider in place",
    "restoration_priority_established": "Priority restoration in place",
    "alternate_present": "Alternate or backup capability present",
    "has_backup": "Backup capability present",
    "has_backup_any": "Backup capability present",
    "redundancy_initiation_mode": "How alternate capability is initiated",
    "entry_diversity": "Service entry diversity",
    "building_entry_diversity": "Building entry diversity",
    "single_provider_or_path": "Single provider or path present",
    "WW_Q2_connection_count": "Wastewater service connection count",
    "W_Q2_connection_count": "Water service connection count",
    "W_Q8_alternate_source": "Alternate water source present",
    "WW_Q8_onsite_pumping": "Onsite pumping present",
    "it_transport_resilience": "Internet transport resilience",
    "no_it_incident_response_owner": "IT incident response owner assigned",
    "network_segmentation": "Network segmentation in place",
    "IT-3_multiple_connections": "Multiple transport connections present",
    "IT-11_restoration_coordination": "Restoration coordination with external IT provider in place",
    "comm_single_point_voice_failure": "Single point of voice failure present",
}

# Strip these prefixes when converting unknown keys to title case
LABEL_STRIP_PREFIXES = ("curve_", "comm_", "IT-", "E-", "W_Q", "WW_Q", "CO-")


def human_label(key: str) -> str:
    """
    Deterministic mapping: known question IDs -> friendly label;
    else convert backend-like key to Title Case (underscore/period to space).
    """
    if not key or not isinstance(key, str):
        return ""
    k = key.strip()
    if k in HUMAN_LABEL_MAP:
        return HUMAN_LABEL_MAP[k]
    # Backend path: replace _ with space, . with " / ", strip known prefixes
    out = k
    for prefix in LABEL_STRIP_PREFIXES:
        if out.lower().startswith(prefix.lower()):
            out = out[len(prefix) :].lstrip("_-")
            break
    out = out.replace("_", " ").replace(".", " / ")
    return out.strip().title() if out else k


# -----------------------------------------------------------------------------
# Human values (enum/boolean -> display)
# -----------------------------------------------------------------------------

BOOLEAN_MAP = {
    True: "Yes",
    False: "No",
    "true": "Yes",
    "false": "No",
    "yes": "Yes",
    "no": "No",
    "unknown": "Unknown",
    "na": "Not applicable",
}

ENUM_LABEL_MAP: dict[str, str] = {
    "MANUAL_ONSITE": "Manual (on-site)",
    "MANUAL_REMOTE": "Manual (remote)",
    "VENDOR_REQUIRED": "Vendor required",
    "AUTOMATIC": "Automatic",
    "UNKNOWN": "Unknown",
    "SAME_ENTRY": "Same entry",
    "SEPARATE_ENTRY": "Separate entries",
    "SEPARATE_ENTRIES": "Separate entries",
    "SAME_DEMARCATION": "Same demarcation",
    "DIFFERENT_DEMARCATION_SAME_UPSTREAM": "Different demarcation, same upstream",
    "DIFFERENT_LOOP_OR_PATH": "Different loop or path",
    "YES": "Yes",
    "NO": "No",
}


def human_value(val: Any, label: str = "") -> str:
    """
    Booleans/yes-no -> Yes/No/Unknown/Not applicable.
    Enums -> friendly label. Numbers as-is; add "hours" when label contains "(hours)".
    """
    if val is None:
        return "Unknown"
    if isinstance(val, bool):
        return BOOLEAN_MAP.get(val, "Yes" if val else "No")
    if isinstance(val, (int, float)) and val == val:
        out = str(int(val) if val == int(val) else val)
        if label and "(hours)" in label and "hour" not in out.lower():
            return f"{out} hours"
        return out
    s = str(val).strip()
    lower = s.lower()
    if lower in BOOLEAN_MAP:
        return BOOLEAN_MAP[lower]
    if s.upper() in ENUM_LABEL_MAP:
        return ENUM_LABEL_MAP[s.upper()]
    return s


# -----------------------------------------------------------------------------
# Sanitize backend evidence in narrative
# -----------------------------------------------------------------------------

# Pattern: "Assessment input records" or "Input records" then key=value
_PATTERN_ASSESSMENT_INPUT = re.compile(
    r"\bAssessment input records\b|\bInput records\b",
    re.IGNORECASE,
)
# Question ID leak: E-3_, IT-1_, etc.
_PATTERN_QUESTION_ID = re.compile(r"\b[A-Z]{1,4}-\d+_[a-z_]+\b", re.IGNORECASE)
# key = value (backend dump)
_PATTERN_KEY_EQ = re.compile(r"(\b[a-z][a-z0-9_]*\s*=\s*[^\s.;]+)", re.IGNORECASE)
# Category:key=value (synthesis dump)
_PATTERN_CAT_KEY_VAL = re.compile(
    r"([A-Za-z\s]+):\s*([a-z_][a-z0-9_]*)\s*=\s*([^\s;]+)(?:\s*;\s*)?",
    re.IGNORECASE,
)


def _rewrite_key_value_phrase(match: re.Match) -> str:
    """Rewrite a single key=value or key = value into 'Label is value.'"""
    full = match.group(0)
    parts = full.split("=", 1)
    if len(parts) != 2:
        return full
    k, v = parts[0].strip(), parts[1].strip()
    label = human_label(k)
    # Try numeric for v
    try:
        n = int(v)
        val = human_value(n, label)
    except ValueError:
        try:
            n = float(v)
            val = human_value(n, label)
        except ValueError:
            val = human_value(v)
    if not label:
        return full
    return f"{label} is {val}."


def _rewrite_cat_key_val(match: re.Match) -> str:
    """Rewrite 'Category: key = value' into 'Category: Label is value.'"""
    cat, key, val = match.group(1).strip(), match.group(2).strip(), match.group(3).strip()
    label = human_label(key)
    try:
        n = int(val)
        val_h = human_value(n, label)
    except ValueError:
        try:
            n = float(val)
            val_h = human_value(n, label)
        except ValueError:
            val_h = human_value(val)
    if not label:
        return match.group(0)
    return f"{cat}: {label} is {val_h}."


def sanitize_backend_evidence(text: str) -> str:
    """
    If text contains "Assessment input records" or backend key=value patterns,
    rewrite into stakeholder language. Remove repeated clauses.
    """
    if not text or not isinstance(text, str):
        return ""
    t = text
    # Category:key=value; key=value (synthesis-style)
    if "=" in t and (";" in t or ":" in t):
        t = _PATTERN_CAT_KEY_VAL.sub(_rewrite_cat_key_val, t)
    # Standalone key = value phrases (e.g. "backup_duration_hours = 48")
    t = _PATTERN_KEY_EQ.sub(_rewrite_key_value_phrase, t)
    # Remove "Assessment input records" / "Input records" and fix following clause
    if _PATTERN_ASSESSMENT_INPUT.search(t):
        t = re.sub(r"\bAssessment input records\s+", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\bInput records\s+", "", t, flags=re.IGNORECASE)
    # Question ID leaks: replace E-3_more_than_one_connection etc. with label
    def _replace_question_id(m: re.Match) -> str:
        return human_label(m.group(0)) or m.group(0)

    t = _PATTERN_QUESTION_ID.sub(_replace_question_id, t)
    # Tool-derived value based on backup_duration_hours: ...
    t = re.sub(
        r"Tool-derived value based on backup_duration_hours:\s*",
        "Shortest alternate sustainment: ",
        t,
        flags=re.IGNORECASE,
    )
    return normalize_spacing(t)


# Boilerplate phrase replacements for Part II vulnerability narrative (no inferential language).
_DEBOT_REPLACEMENTS = [
    (r"\bmay experience longer restoration timelines\b", "restoration coordination is not established; escalation may be delayed"),
    (r"\bare reflected\b", "are indicated"),
    (r"\bcannot be ruled out\b", "is not confirmed"),
    (r"\bindicates\b", "shows"),
    (r"\bsuggests\b", "shows"),
]


def debot_vulnerability_narrative(text: str) -> str:
    """
    Replace boilerplate phrases in Part II vulnerability text with shorter, direct wording.
    Only refactors narrative tone; does not change executive section.
    """
    if not text or not isinstance(text, str):
        return ""
    t = text
    for pattern, repl in _DEBOT_REPLACEMENTS:
        t = re.sub(pattern, repl, t, flags=re.IGNORECASE)
    return t


def _it_transport_diversity_confirmed(assessment: dict) -> bool:
    """
    True only when IT transport has explicit route independence and/or building-entry diversity
    confirmed in assessment (so we may state mitigation benefits). Otherwise do not claim "reduces".
    """
    if not assessment or not isinstance(assessment, dict):
        return False
    categories = assessment.get("categories") or {}
    it_cat = categories.get("INFORMATION_TECHNOLOGY") or {}
    if not isinstance(it_cat, dict):
        return False
    transport = it_cat.get("it_transport_resilience") or {}
    if isinstance(transport, dict):
        carriers = (transport.get("carrier_diversity") or "").strip().upper()
        entry = (transport.get("building_entry_diversity") or "").strip().upper()
        if carriers == "DIFFERENT_CARRIERS" or entry == "SEPARATE_ENTRIES":
            return True
    sources = (it_cat.get("supply") or {}).get("sources") if isinstance(it_cat.get("supply"), dict) else []
    if isinstance(sources, list):
        for s in sources:
            if not isinstance(s, dict):
                continue
            ind = (s.get("independence") or "").strip()
            if ind and ind not in ("UNKNOWN", "Not provided", ""):
                return True
    return False


# Phrases that state definitive mitigation; removed when IT diversity/independence not confirmed.
_IT_MITIGATION_DEFINITIVE = [
    re.compile(r"\bLast-mile diversity reduces concentrated failure exposure\.?", re.I),
    re.compile(r"\bPath diversity reduces (concentrated failure |operational )?exposure\.?", re.I),
    re.compile(r"\bSingle-path dependency concentrates risk; path diversity reduces operational exposure\.?", re.I),
    re.compile(r"\bRedundancy reduces operational exposure\.?", re.I),
    re.compile(r"\b(?:Multiple providers or paths )?reduce[s]? concentrated failure exposure\.?", re.I),
]

# Replace "Concentrated failure exposure cannot be ruled out" / "is not confirmed" with factual sentence.
_IT_UNCONFIRMED_REPLACEMENT = (
    "Route independence and building-entry diversity are not confirmed; "
    "a common-corridor failure could affect multiple connections."
)


def strip_it_transport_mitigation_when_unconfirmed(text: str, assessment: dict) -> str:
    """
    When IT route independence / building-entry diversity are NOT confirmed: remove definitive
    mitigation sentences (e.g. "Last-mile diversity reduces ...") and replace "cannot be ruled out"
    / "is not confirmed" concentration phrasing with factual wording. When confirmed, return text unchanged.
    """
    if not text or not isinstance(text, str):
        return text or ""
    if _it_transport_diversity_confirmed(assessment):
        return text
    t = text
    # Replace concentration sentence with factual wording
    t = re.sub(
        r"\bConcentrated failure exposure (?:cannot be ruled out|is not confirmed)\.?",
        _IT_UNCONFIRMED_REPLACEMENT,
        t,
        flags=re.IGNORECASE,
    )
    # Remove definitive mitigation sentences
    for pat in _IT_MITIGATION_DEFINITIVE:
        t = pat.sub("", t)
    return normalize_spacing(t)


# -----------------------------------------------------------------------------
# Acronym expansion (first use only)
# -----------------------------------------------------------------------------

ACRONYM_EXPANSIONS: dict[str, str] = {
    "WASD": "Miami-Dade Water and Sewer Department (WASD)",
}


def expand_acronym(value: str, seen: set[str]) -> str:
    """
    If value is exactly a known acronym and not in seen, return expanded form and add to seen.
    Otherwise return value unchanged.
    """
    if not value or not isinstance(value, str):
        return value
    v = value.strip()
    if not v:
        return value
    if v in ACRONYM_EXPANSIONS:
        if v not in seen:
            seen.add(v)
            return ACRONYM_EXPANSIONS[v]
    return value


def expand_acronym_in_text(text: str, seen: set[str]) -> str:
    """
    Replace first occurrence of each known acronym in text with expanded form (and add to seen).
    Use for cells that may contain the acronym as a word (e.g. notes).
    """
    if not text or not isinstance(text, str):
        return text
    out = text
    for acronym, expanded in ACRONYM_EXPANSIONS.items():
        if acronym not in seen:
            pattern = re.compile(r"\b" + re.escape(acronym) + r"\b")
            if pattern.search(out):
                seen.add(acronym)
                out = pattern.sub(expanded, out, count=1)
                break
    return out


# -----------------------------------------------------------------------------
# Regression guard: fail export if leaked patterns present
# -----------------------------------------------------------------------------

LEAK_PATTERNS = [
    ("Assessment input records", re.compile(r"\bAssessment input records\b", re.IGNORECASE)),
    ("Question ID leak (E/IT/W prefix)", re.compile(r"\b[EIT]{1,2}-\d+_", re.IGNORECASE)),
    ("time_to_impact_hours", re.compile(r"\btime_to_impact_hours\b")),
    ("backup_duration_hours", re.compile(r"\bbackup_duration_hours\b")),
]

# Only flag uppercase tokens that look like backend keys (contain underscore)
_UPPER_WITH_UNDERSCORE = re.compile(r"\b[A-Z][A-Z0-9_]*_[A-Z0-9_]+\b")


def _collect_doc_text(doc) -> str:
    """Concatenate all paragraph and table cell text from doc (body)."""
    parts: list[str] = []
    for p in doc.paragraphs:
        if p.text:
            parts.append(p.text)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text:
                    parts.append(cell.text)
    return "\n".join(parts)


def assert_no_backend_leak(doc) -> None:
    """
    Raise RuntimeError with clear message if any leaked pattern is present
    in paragraph and table cell text. Call before saving DOCX.
    Only flags specific LEAK_PATTERNS and backend-style UPPER_SNAKE tokens
    (e.g. SINGLE_POINT), not normal report uppercase (EXECUTIVE, HIGH, FEMA).
    """
    text = _collect_doc_text(doc)
    leaked: list[str] = []
    for name, pattern in LEAK_PATTERNS:
        if pattern.search(text):
            leaked.append(name)
    # Only flag backend-style keys (uppercase with underscore), not headings/acronyms
    for m in _UPPER_WITH_UNDERSCORE.finditer(text):
        leaked.append(f"BACKEND_KEY:{m.group(0)}")
    if leaked:
        raise RuntimeError(
            "Export failed: backend leakage detected. The following should not appear in the report: "
            + ", ".join(leaked)
        )
