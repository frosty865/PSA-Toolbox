"""
Export QC gate: fail fast on encoding, unresolved anchors, limits, and required sections.
Single source of truth for narrative-only export validation.
Called from main.py AFTER all injection (executive snapshot, synthesis, priority actions, VULN_NARRATIVE). Part I: charts only; no INFRA_*.
No-assumptions rule: report must not contain non-traceable narrative (inferred intent, predictive phrasing).
"""
import re

from docx import Document
from docx.oxml.ns import qn

# Prohibited phrases: non-traceable narrative. If detected, raise ERROR: Non-traceable narrative detected.
PROHIBITED_NARRATIVE_PHRASES = [
    "is expected",
    "will cause",
    "eliminates supply",
    "automatic failover",
    "manual failover",
    "vendor initiated",
    "vendor-initiated failover",
    "active-passive",
    "dynamic routing",
    "immediate degradation is expected",
    "Not identified",
    "rely on a single provider",  # use sector-specific traceable language (E-3, W_Q2, etc.) instead
    "redundant path",  # only when independence true; otherwise not documented
    "cannot be ruled out",
    "suggests",
    "likely",
    "probably",
]

# Unresolved anchor pattern (must not appear in output)
ANCHOR_RE = re.compile(r"\[\[[A-Z0-9_]+\]\]")

# Encoding artifact patterns (single source of truth: main.py replaces these in-doc before QC)
ENCODING_ARTIFACT_PATTERNS = [
    "â€\"",     # mojibake for em dash
    "â€",       # common fragment
    "Ã",        # common fragment (e.g. Ã©)
    "\uFFFD",   # replacement char
]

MAX_PRIORITY_ACTIONS = 5
MAX_OFCS_PER_VULNERABILITY = 4

REQUIRED_SECTION_ANCHORS = (
    "[[SNAPSHOT_POSTURE]]",
    "[[SNAPSHOT_MATRIX]]",
    "[[SYNTHESIS]]",
    "[[PRIORITY_ACTIONS]]",
    "[[VULNERABILITY_BLOCKS]]",
)

# Map section anchor to payload key; only enforce non-empty when payload has this key.
INFRA_ANCHOR_TO_PAYLOAD_KEY = {
    "[[VULNERABILITY_BLOCKS]]": "vulnerability_blocks",
}

# Legacy anchor must not appear in output (Franklin typography uses [[VULNERABILITY_BLOCKS]] only).
LEGACY_VULN_NARRATIVE_ANCHOR = "[[VULN_NARRATIVE]]"

# Vulnerability section: required ADA_* styles when vulnerability content is present.
# ADA_Vuln_Meta is optional (used by blocks path; themed path uses Header/Severity/Label/Body/Bullets only).
ADA_VULN_STYLES_REQUIRED = (
    "ADA_Vuln_Header",
    "ADA_Vuln_Severity",
    "ADA_Vuln_Label",
    "ADA_Vuln_Body",
)


def _norm_style(x: str | None) -> str:
    """Normalize for style name/styleId comparison (strip only)."""
    return (x or "").strip()


def check_prohibited_narrative_phrases(doc: Document) -> None:
    """Raise ValueError if any prohibited (non-traceable) phrase appears in document text."""
    for text in _iter_text_in_doc(doc):
        lower = text.lower()
        for phrase in PROHIBITED_NARRATIVE_PHRASES:
            if phrase.lower() in lower:
                raise ValueError(
                    f"ERROR: Non-traceable narrative detected. Prohibited phrase: {phrase!r}. "
                    "Report must use only input-traceable declarative language."
                )


def _has_provider_in_category(inp: dict, category: str) -> bool:
    """True if category has any provider (supply.sources, E-1_utility_providers, IT-1, curve_primary_provider)."""
    if not inp or category == "CRITICAL_PRODUCTS":
        return False
    supply = inp.get("supply") or {}
    sources = supply.get("sources") or []
    if any(
        (s or {}).get("provider_name") and str((s or {}).get("provider_name", "")).strip()
        or (s or {}).get("service_provider") and str((s or {}).get("service_provider", "")).strip()
        for s in sources
    ):
        return True
    if (inp.get("curve_primary_provider") or "").strip():
        return True
    if category == "ELECTRIC_POWER":
        providers = inp.get("E-1_utility_providers") or []
        if isinstance(providers, list) and any(
            (p or {}).get("provider_name") and str((p or {}).get("provider_name", "")).strip()
            for p in providers
        ):
            return True
    if category == "INFORMATION_TECHNOLOGY":
        if (inp.get("IT-1_can_identify_providers") or "").strip().lower() in ("yes", "true", "1"):
            return True
        it1 = inp.get("IT-1_service_providers") or []
        if isinstance(it1, list) and any(
            (p or {}).get("provider_name") and str((p or {}).get("provider_name", "")).strip()
            for p in it1
        ):
            return True
    return False


def check_provider_identified_vs_input(doc: Document, assessment: dict) -> None:
    """If provider_name (or equivalent) exists in assessment for a category, doc must not show 'Not identified'.
    Raises: ERROR: Narrative exceeds documented input fields."""
    categories = assessment.get("categories") or {}
    any_has_provider = any(
        _has_provider_in_category(inp if isinstance(inp, dict) else {}, code)
        for code, inp in categories.items()
        if code != "CRITICAL_PRODUCTS"
    )
    if not any_has_provider:
        return
    for text in _iter_text_in_doc(doc):
        if "Not identified" in text:
            raise ValueError(
                "ERROR: Narrative exceeds documented input fields. "
                "Provider exists in assessment but document contains 'Not identified'."
            )


def _redundancy_documented_and_tested(ra: dict | None) -> bool:
    """True if redundancy_activation has documented_and_tested explicitly True."""
    if not ra or not isinstance(ra, dict):
        return False
    v = ra.get("documented_and_tested")
    return v is True


def check_redundancy_activation_narrative_consistency(doc: Document, assessment: dict) -> None:
    """If any category has redundancy_activation.documented_and_tested = true, doc must not say procedures are not documented as tested.
    Raises: ERROR: Narrative exceeds documented input fields."""
    categories = assessment.get("categories") or {}
    any_documented_tested = False
    for inp in categories.values():
        if not isinstance(inp, dict):
            continue
        ra = inp.get("redundancy_activation")
        if _redundancy_documented_and_tested(ra):
            any_documented_tested = True
            break
    if not any_documented_tested:
        return
    contradict = "not documented as tested"
    for text in _iter_text_in_doc(doc):
        if contradict in text.lower():
            raise ValueError(
                "ERROR: Narrative exceeds documented input fields. "
                "redundancy_activation.documented_and_tested is true in assessment but document contains 'not documented as tested'."
            )


def _collect_assessment_field_paths(obj: dict, prefix: str = "") -> set[str]:
    """Recursively collect all dict keys (field names) from assessment categories. Flatten to snake_case segments."""
    out: set[str] = set()
    if not isinstance(obj, dict):
        return out
    for k, v in obj.items():
        if not isinstance(k, str):
            continue
        # Add this key (with optional prefix)
        full = f"{prefix}_{k}" if prefix else k
        out.add(k)
        out.add(full)
        if isinstance(v, dict) and v and k not in ("sources", "edges"):
            out.update(_collect_assessment_field_paths(v, k))
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            for i, item in enumerate(v[:3]):
                if isinstance(item, dict):
                    out.update(_collect_assessment_field_paths(item, k))
    return out


def check_narrative_field_paths(doc: Document, assessment: dict) -> None:
    """If narrative contains a token that looks like a field path (snake_case) not present in assessment, raise.
    Raises: ERROR: Narrative exceeds documented input fields."""
    categories = assessment.get("categories") or {}
    allowed: set[str] = set()
    for code, inp in categories.items():
        if isinstance(inp, dict):
            allowed.add(code)
            allowed.update(_collect_assessment_field_paths(inp))
            # Top-level keys only for quick match
            for k in inp:
                if isinstance(k, str):
                    allowed.add(k)
    # Known template field names that may appear in report (even if not in this assessment)
    allowed.update({
        "E-3_more_than_one_connection", "backup_duration_hours", "curve_backup_duration_hours", "has_backup", "curve_backup_available",
        "restoration_priority_established", "alternate_present", "redundancy_initiation_mode",
        "W_Q2_connection_count", "W_Q8_alternate_source", "WW_Q2_connection_count", "WW_Q8_onsite_pumping",
        "comm_single_point_voice_failure", "comm_restoration_coordination", "time_to_impact_hours",
        "it_transport_resilience", "building_entry_diversity", "physical_path_diversity", "carrier_diversity",
        "documented_and_tested", "activation_delay_min", "redundancy_activation", "supply", "entry_diversity",
        "single_provider_or_path", "network_segmentation", "no_it_incident_response_owner", "IT-3_multiple_connections",
    })
    # Only flag "field = value" or "field =" where field is not in allowed (deterministic template style)
    field_equals = re.compile(r"\b([a-zA-Z][a-zA-Z0-9_]*(?:_[a-zA-Z0-9_]+)+)\s*=")
    for text in _iter_text_in_doc(doc):
        for m in field_equals.finditer(text):
            token = m.group(1)
            if token in allowed:
                continue
            raise ValueError(
                f"ERROR: Narrative exceeds documented input fields. "
                f"Claim contains term not present in assessment schema: {token!r}."
            )


def _iter_text_in_doc(doc: Document):
    """Yield text of each paragraph in body and in table cells."""
    body = doc.element.body
    for child in body:
        if child.tag == qn("w:p"):
            parts = []
            for el in child.iter():
                if el.tag == qn("w:t") and el.text:
                    parts.append(el.text)
            yield "".join(parts)
        elif child.tag == qn("w:tbl"):
            for row in child.iter(qn("w:tr")):
                for cell in row.iter(qn("w:tc")):
                    for p_el in cell.iter(qn("w:p")):
                        parts = []
                        for el in p_el.iter():
                            if el.tag == qn("w:t") and el.text:
                                parts.append(el.text)
                        yield "".join(parts)


def check_unresolved_anchors(doc: Document) -> list[str]:
    """Return list of unresolved anchor strings found in document."""
    found = []
    for text in _iter_text_in_doc(doc):
        for m in ANCHOR_RE.finditer(text):
            found.append(m.group())
    return found


def check_encoding_artifacts(doc: Document) -> list[tuple[str, str]]:
    """Return list of (pattern, snippet) for encoding artifacts."""
    found = []
    for text in _iter_text_in_doc(doc):
        for pat in ENCODING_ARTIFACT_PATTERNS:
            if pat in text:
                idx = text.find(pat)
                snippet = text[max(0, idx - 20) : idx + len(pat) + 20]
                found.append((pat, snippet))
    return found


def check_priority_actions_limit(priority_actions: list) -> None:
    """Raise if more than MAX_PRIORITY_ACTIONS."""
    if priority_actions is None:
        return
    n = len(priority_actions) if isinstance(priority_actions, list) else 0
    if n > MAX_PRIORITY_ACTIONS:
        raise ValueError(
            f"Export QC: at most {MAX_PRIORITY_ACTIONS} Priority Actions allowed, got {n}"
        )


def check_ofcs_per_vulnerability_limit(blocks: list) -> None:
    """Raise if any vulnerability block has more than MAX_OFCS_PER_VULNERABILITY OFCs."""
    if not blocks:
        return
    for i, block in enumerate(blocks):
        ofcs = block.get("ofcs") or block.get("option_for_consideration") or []
        if isinstance(ofcs, list) and len(ofcs) > MAX_OFCS_PER_VULNERABILITY:
            raise ValueError(
                f"Export QC: at most {MAX_OFCS_PER_VULNERABILITY} OFCs per vulnerability, "
                f"block {i} has {len(ofcs)}"
            )


def check_no_legacy_vuln_narrative(doc: Document) -> None:
    """Raise if legacy anchor [[VULN_NARRATIVE]] appears in output (use [[VULNERABILITY_BLOCKS]] only)."""
    for text in _iter_text_in_doc(doc):
        if LEGACY_VULN_NARRATIVE_ANCHOR in text:
            raise ValueError(
                f"Export QC: legacy anchor {LEGACY_VULN_NARRATIVE_ANCHOR!r} must not appear in output"
            )


def check_no_safe_in_output(doc: Document) -> None:
    """Raise if the word SAFE appears in output (federal-style report; no SAFE framework)."""
    for text in _iter_text_in_doc(doc):
        if "SAFE" in text:
            raise ValueError("Export QC: output must not contain 'SAFE'; federal-style report only.")


def check_vulnerability_section_styles(doc: Document) -> None:
    """When vulnerability section uses ADA_* styles, require all required paragraph styles present.
    Detects by style name OR style_id (normalized strip); only paragraph styles count.
    Scans only body paragraphs (doc.paragraphs); tables/headers/footers are not included.
    """
    present = set()
    for p in doc.paragraphs:
        try:
            if not p.style:
                continue
            present.add(_norm_style(getattr(p.style, "name", None)))
            present.add(_norm_style(getattr(p.style, "style_id", None)))
        except Exception:
            pass
    if _norm_style("ADA_Vuln_Header") not in present:
        return  # No vulnerability blocks styled; skip
    missing = [s for s in ADA_VULN_STYLES_REQUIRED if _norm_style(s) not in present]
    if missing:
        ada_in_present = sorted(k for k in present if k and "ADA_Vuln" in k)
        print(f"[QC] vulnerability section styles present (ADA_*): {ada_in_present!r}")
        raise ValueError(
            f"Export QC: vulnerability section must apply ADA styles; missing: {missing!r}. "
            "Template is missing required paragraph styles. Open report template.docx and add the styles with exact names "
            "(e.g. ADA_Vuln_Severity, ADA_Vuln_Label), or run: python apps/reporter/add_ada_vuln_styles_to_template.py."
        )


CANONICAL_TEMPLATE_SUFFIX = "ADA/report template.docx"


def assert_template_canonical(template_path: str) -> None:
    """Fail if template is not the canonical anchor template. Skip if path empty."""
    if not template_path:
        return
    normalized = (template_path or "").replace("\\", "/")
    if not normalized.endswith(CANONICAL_TEMPLATE_SUFFIX):
        raise ValueError(
            "Wrong template: export must use /ADA/report template.docx. "
            f"Got: {template_path!r}"
        )


def _section_required_for_qc(anchor: str, payload: dict | None) -> bool:
    """Only enforce non-empty INFRA section when payload has that key (sector included)."""
    if payload is None:
        return True
    key = INFRA_ANCHOR_TO_PAYLOAD_KEY.get(anchor)
    if key is None:
        return True
    v = payload.get(key)
    return bool(v and (v if isinstance(v, str) else "").replace("\u00a0", " ").strip())


def run_export_qc(
    doc: Document,
    template_path: str,
    *,
    priority_actions: list | None = None,
    vulnerability_blocks: list | None = None,
    required_sections_filled: dict[str, bool] | None = None,
    payload: dict | None = None,
    assessment_json: dict | None = None,
) -> None:
    """
    Run all export QC checks. Raises on first failure.
    - Unresolved anchors in doc
    - Encoding artifacts in doc
    - Template path must be ADA/report template.docx
    - Priority actions <= 5
    - OFCs per vulnerability <= 4
    - Required sections (optional): only enforce INFRA sections when payload has that key (sector included).
    """
    assert_template_canonical(template_path)

    anchors = check_unresolved_anchors(doc)
    if anchors:
        unique = sorted(set(anchors))
        raise ValueError(
            "Template anchors not fully replaced: " + ", ".join(unique[:20])
            + (f" ... and {len(unique) - 20} more" if len(unique) > 20 else "")
        )

    check_no_legacy_vuln_narrative(doc)
    check_no_safe_in_output(doc)
    check_prohibited_narrative_phrases(doc)
    if assessment_json:
        assn = assessment_json.get("assessment") or assessment_json
        check_provider_identified_vs_input(doc, assn)
        check_redundancy_activation_narrative_consistency(doc, assn)
        check_narrative_field_paths(doc, assn)
    check_vulnerability_section_styles(doc)

    artifacts = check_encoding_artifacts(doc)
    if artifacts:
        pat, snippet = artifacts[0]
        raise ValueError(
            f"Export QC: encoding artifact {pat!r} in output. Snippet: ...{snippet}..."
        )

    check_priority_actions_limit(priority_actions)

    if vulnerability_blocks:
        check_ofcs_per_vulnerability_limit(vulnerability_blocks)

    if required_sections_filled:
        empty = [
            k
            for k, v in required_sections_filled.items()
            if not v and _section_required_for_qc(k, payload)
        ]
        if empty:
            raise ValueError(
                f"Export QC: required sections empty: {empty!r}"
            )
