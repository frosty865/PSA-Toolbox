"""
Part II (Technical Annex) rendering: summary table, vulnerability blocks, IT tables, designation.
Single entry point: render_part2(doc, data, template_path=None).
"""
from __future__ import annotations

import os
import re
import sys
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph

from constants import (
    CHART_CATEGORIES,
    CATEGORY_DISPLAY,
    SUMMARY_COL_WIDTHS,
    SUMMARY_HEADERS_6,
    SUMMARY_NOT_CONFIRMED_TEXT,
    DEP_SUMMARY_TABLE_ANCHOR,
    TABLE_DEPENDENCY_SUMMARY_ANCHOR,
    IT_TRANSPORT_SECTION_ANCHOR,
    IT_HOSTED_SECTION_ANCHOR,
    STRUCTURAL_PROFILE_SUMMARY_ANCHOR,
    VULNERABILITY_COUNT_SUMMARY_ANCHOR,
    VULNERABILITY_BLOCKS_ANCHOR,
    CROSS_INFRA_ANALYSIS_ANCHOR,
    DESIGNATION_SERVICES_ANCHOR,
    SERVICE_LOSS_DESCRIPTIONS,
    SERVICE_LOSS_MAP,
    IT_SERVICE_ID_TO_PRIMARY_FUNCTION,
    NO_VULNERABILITIES_TRIGGERED,
)
from docx_ops import (
    find_paragraph_by_exact_text,
    insert_paragraph_after,
    remove_paragraph,
    set_paragraph_keep_with_next,
    insert_table_after,
    insert_paragraph_after_block,
    set_table_fixed_widths,
    set_repeat_header_row,
    apply_table_grid_style,
    replace_anchor_with_table_only,
    iter_paragraphs_and_cells,
    inject_text_at_anchor,
    set_table_rows_cant_split,
)
from io_payload import get_part2_from_payload, get_part2_findings
from render_vulns import (
    _render_structured_vulnerabilities,
    inject_themed_findings_at_anchor,
    ensure_ada_vuln_styles,
)
from report_humanize import expand_acronym, expand_acronym_in_text
from sanitize import sanitize_text


def _doc_contains_anchor(doc: Document, token: str, body_only: bool = True) -> bool:
    """Return True if any paragraph (or cell) contains exact text token."""
    return find_paragraph_by_exact_text(doc, token, body_only=body_only) is not None


def _safe_get(d, *keys, default=None):
    """Navigate nested dict by keys; return default if any key missing."""
    cur = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


def _dedupe_rows(rows):
    """Deduplicate rows by normalized tuple (lowercase, stripped); preserve first occurrence order."""
    seen = set()
    out = []
    for r in rows:
        key = tuple((x or "").strip().lower() for x in r)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


_TRANSPORT_ISP_NORMALIZED = frozenset({
    "comcast", "xfinity", "at&t", "att", "at&t internet", "at&t fiber", "att internet", "att fiber",
    "verizon", "verizon fios", "verizon fios internet", "spectrum", "charter", "cox", "centurylink",
    "lumen", "frontier", "windstream", "earthlink", "optimum", "altice", "cogent", "zayo", "level3",
    "l3", "crown castle", "lumen technologies",
})


def _normalize_provider_name(name: str) -> str:
    """Lowercase, collapse spaces, remove common punctuation for lookup."""
    if not name or not isinstance(name, str):
        return ""
    return re.sub(r"\s+", " ", name.lower().strip().replace("&", "").replace(".", ""))


def _is_transport_provider(provider_name: str) -> bool:
    """True if provider is a known transport/ISP."""
    n = _normalize_provider_name(provider_name)
    if not n:
        return False
    if n in _TRANSPORT_ISP_NORMALIZED:
        return True
    for isp in _TRANSPORT_ISP_NORMALIZED:
        if isp in n or n in isp:
            return True
    return False


def _format_path_diversity(path: dict) -> str:
    """Format physical_path_diversity dict to comma-separated labels."""
    if not path or not isinstance(path, dict):
        return ""
    parts = []
    if path.get("same_conduit"):
        parts.append("Same conduit")
    if path.get("separate_conduits"):
        parts.append("Separate conduits")
    if path.get("separate_street_approach"):
        parts.append("Separate street approach")
    if path.get("unknown"):
        parts.append("Unknown")
    return ", ".join(parts) if parts else ""


def _it_transport_table(assessment_json: dict):
    """Build IT Internet Transport Resilience table from it_transport_resilience, or legacy supply.sources."""
    assessment = assessment_json.get("assessment") or assessment_json
    it_cat = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", default={}) or {}
    transport = it_cat.get("it_transport_resilience")
    if transport and isinstance(transport, dict):
        path = transport.get("physical_path_diversity") or {}
        path_str = _format_path_diversity(path)
        row = [
            (transport.get("circuit_count") or "").replace("_", " ").strip() or "—",
            (transport.get("carrier_diversity") or "").replace("_", " ").strip() or "—",
            path_str or "—",
            (transport.get("building_entry_diversity") or "").replace("_", " ").strip() or "—",
            (transport.get("upstream_pop_diversity") or "").replace("_", " ").strip() or "—",
            (transport.get("notes") or "").strip() or "—",
        ]
        return {
            "type": "table",
            "title": "Information Technology – Internet Transport Resilience",
            "headers": ["Circuit Count", "Carrier Diversity", "Path Diversity", "Building Entry", "Upstream POP", "Notes"],
            "rows": [row],
        }
    sources = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", "supply", "sources", default=[]) or []
    if not sources:
        return None
    rows = []
    for s in sources:
        provider = (s.get("provider_name") or "").strip() or "Unknown"
        demarc = (s.get("demarcation_description") or "").strip()
        independence = (s.get("independence") or "").strip() or "UNKNOWN"
        notes = (s.get("notes") or "").strip()
        if provider or demarc or independence or notes:
            rows.append([provider, demarc, independence, notes])
    rows = _dedupe_rows(rows)
    if not rows:
        return None
    return {
        "type": "table",
        "title": "Information Technology – Transport Providers (Internet / Circuits)",
        "headers": ["Provider", "Demarcation / Termination", "Independence", "Notes"],
        "rows": rows,
    }


def _diversity_status_from_transport(transport: dict) -> str:
    """Derive diversity label from it_transport_resilience."""
    if not transport or not isinstance(transport, dict):
        return "Single-path exposure"
    circuit = (transport.get("circuit_count") or "").strip().upper().replace("-", "_")
    if circuit in ("ONE", "1"):
        return "Single-path exposure"
    carriers = (transport.get("carrier_diversity") or "").strip().upper()
    entry = (transport.get("building_entry_diversity") or "").strip().upper()
    if (carriers == "DIFFERENT_CARRIERS" and entry == "SEPARATE_ENTRIES") or carriers == "DIFFERENT_CARRIERS":
        return "Diverse transport"
    if circuit in ("TWO", "THREE_PLUS", "2", "3"):
        return "Partial diversity"
    return "Single-path exposure"


def _format_tti_for_table(val) -> str:
    """Format time-to-severe-impact for table cell."""
    if val is None:
        return "—"
    if isinstance(val, (int, float)) and val == val:
        return str(int(val)) if val == int(val) else str(val)
    s = (val or "").strip()
    return s if s else "—"


def _get_it_isp_names_from_curve(assessment: dict) -> list[str]:
    """Source of truth for ISP provider names: Internet/Data Connectivity curve fields only."""
    it_cat = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", default={}) or {}
    primary = (it_cat.get("curve_primary_provider") or "")
    secondary = (it_cat.get("curve_secondary_provider") or "")
    if isinstance(primary, str):
        primary = primary.strip()
    else:
        primary = str(primary).strip() if primary is not None else ""
    if isinstance(secondary, str):
        secondary = secondary.strip()
    else:
        secondary = str(secondary).strip() if secondary is not None else ""
    return [p for p in [primary, secondary] if p]


def _format_it_internet_connectivity_narrative(assessment: dict) -> str:
    """Narrative sentence using ISP names from curve only."""
    isp_names = _get_it_isp_names_from_curve(assessment)
    if not isp_names:
        return "The facility did not report primary or secondary internet connectivity providers in the assessment."
    if len(isp_names) == 1:
        return f"The facility receives primary internet connectivity from {isp_names[0]}."
    return (
        f"The facility receives primary internet connectivity from {isp_names[0]} "
        f"with a secondary connection provided by {isp_names[1]}."
    )


def _normalize_provider_name_for_hosted(s: str) -> str:
    """Normalize provider names for matching (delegates to canonical reporter normalization)."""
    return _normalize_provider_name(s)


def _compact_provider_name_for_hosted(s: str) -> str:
    """Compact provider names for fuzzy matching (alnum only)."""
    return re.sub(r"[^a-z0-9]", "", _normalize_provider_name_for_hosted(s))


def _humanize_transport_independence(value) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    upper = raw.upper()
    labels = {
        "DIFFERENT_LOOP_OR_PATH": "Different loop/path (resilient)",
        "SAME_LOOP_OR_PATH": "Same loop/path (correlated risk)",
        "UNKNOWN": "Unknown",
        "CONFIRMED": "Confirmed",
        "NOT_CONFIRMED": "Not confirmed",
    }
    return labels.get(upper, raw)


def _it_supply_source_lookup(it_cat: dict) -> dict:
    """Build lookup from normalized provider_name to supply source."""
    out = {"by_name": {}, "by_compact": {}, "sources": []}
    supply = it_cat.get("supply")
    if not supply or not isinstance(supply, dict):
        answers = it_cat.get("answers") or {}
        if isinstance(answers, dict) and "supply" in answers:
            supply = answers.get("supply")
    sources = (supply or {}).get("sources") if isinstance(supply, dict) else []
    if not isinstance(sources, list):
        return out
    out["sources"] = sources
    for src in sources:
        if not src or not isinstance(src, dict):
            continue
        name = (src.get("provider_name") or "").strip()
        if not name:
            continue
        out["by_name"][_normalize_provider_name_for_hosted(name)] = src
        out["by_compact"][_compact_provider_name_for_hosted(name)] = src
    return out


def _format_demarcation(src: dict) -> str:
    """Format demarcation from source: description, or 'lat, lon', or blank when missing."""
    if not src or not isinstance(src, dict):
        return ""
    desc = (src.get("demarcation_description") or "").strip()
    if desc:
        return desc
    lat = src.get("demarcation_lat")
    lon = src.get("demarcation_lon")
    if lat is not None and lon is not None:
        return f"{lat}, {lon}"
    return ""


def _internet_transport_table(assessment_json: dict) -> dict:
    """BLOCK 2: INTERNET TRANSPORT. Single consolidated table. Always returns a block."""
    assessment = assessment_json.get("assessment") or assessment_json
    it_cat = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", default={}) or {}
    isp_names = _get_it_isp_names_from_curve(assessment)
    primary_raw = (it_cat.get("curve_primary_provider") or "").strip() if isinstance(it_cat.get("curve_primary_provider"), str) else ""
    secondary_raw = (it_cat.get("curve_secondary_provider") or "").strip() if isinstance(it_cat.get("curve_secondary_provider"), str) else ""
    if (primary_raw or secondary_raw) and not isp_names:
        raise RuntimeError(
            "ISP provider names not mapped from curve inputs. Ensure assessment.categories.INFORMATION_TECHNOLOGY "
            "contains curve_primary_provider and curve_secondary_provider."
        )
    source_lookup = _it_supply_source_lookup(it_cat)
    source_by_name = source_lookup.get("by_name") or {}
    source_by_compact = source_lookup.get("by_compact") or {}
    source_list = source_lookup.get("sources") or []
    answers = it_cat.get("answers") if isinstance(it_cat.get("answers"), dict) else {}
    it_connections = it_cat.get("IT-4_service_connections")
    if not isinstance(it_connections, list):
        it_connections = answers.get("IT-4_service_connections") if isinstance(answers, dict) else []
    if not isinstance(it_connections, list):
        it_connections = []
    transport = it_cat.get("it_transport_resilience")
    if not isinstance(transport, dict) and isinstance(answers, dict):
        transport = answers.get("it_transport_resilience")
    if not isinstance(transport, dict):
        transport = {}

    def _empty_to_not_provided(v: str) -> str:
        return v.strip() if isinstance(v, str) and v.strip() else "Not provided"

    def _find_source_for_provider(provider: str, idx: int):
        n = _normalize_provider_name_for_hosted(provider)
        c = _compact_provider_name_for_hosted(provider)
        src = source_by_name.get(n)
        if src:
            return src
        src = source_by_compact.get(c)
        if src:
            return src
        for s in source_list:
            candidate = str((s or {}).get("provider_name") or "")
            nc = _normalize_provider_name_for_hosted(candidate)
            cc = _compact_provider_name_for_hosted(candidate)
            if (nc and (nc in n or n in nc)) or (cc and (cc in c or c in cc)):
                return s
        return None

    def _find_connection_for_provider(provider: str, idx: int):
        n = _normalize_provider_name_for_hosted(provider)
        c = _compact_provider_name_for_hosted(provider)
        for conn in it_connections:
            assoc = str((conn or {}).get("associated_provider") or "")
            if _normalize_provider_name_for_hosted(assoc) == n:
                return conn
        for conn in it_connections:
            assoc = str((conn or {}).get("associated_provider") or "")
            nc = _normalize_provider_name_for_hosted(assoc)
            cc = _compact_provider_name_for_hosted(assoc)
            if (nc and (nc in n or n in nc)) or (cc and (cc in c or c in cc)):
                return conn
        return None

    headers = ["Role", "Provider", "Demarcation", "Independence", "Notes"]
    rows = []
    if isp_names:
        roles = ["Primary Internet Provider", "Secondary Internet Provider"]
        for i, provider in enumerate(isp_names[:2]):
            role = roles[i]
            src = _find_source_for_provider(provider, i)
            conn = _find_connection_for_provider(provider, i)
            demarc_from_source = _format_demarcation(src) if isinstance(src, dict) else ""
            demarc_from_conn = str((conn or {}).get("facility_entry_location") or "").strip()
            demarc = _empty_to_not_provided(demarc_from_source or demarc_from_conn)

            indep_source = _humanize_transport_independence((src or {}).get("independence"))
            route_ind = _humanize_transport_independence((transport or {}).get("transport_route_independence"))
            phys_sep_raw = str(it_cat.get("IT-4_physically_separated") or "").strip().lower()
            if not phys_sep_raw and isinstance(answers, dict):
                phys_sep_raw = str(answers.get("IT-4_physically_separated") or "").strip().lower()
            phys_sep = "Physically separated" if phys_sep_raw == "yes" else "Not physically separated" if phys_sep_raw == "no" else ""
            indep = _empty_to_not_provided(indep_source or route_ind or phys_sep)

            notes_raw = str((src or {}).get("notes") or "").strip()
            if not notes_raw and isinstance(src, dict):
                notes_raw = str(src.get("demarcation_description") or "").strip()
            notes = notes_raw if notes_raw else ("Reported sources: 1" if (demarc != "Not provided" or indep != "Not provided") else "—")
            rows.append([role, provider, demarc, indep, notes])
    if not rows:
        rows.append(["Primary Internet Provider", "Not provided", "Not provided", "Not provided", "—"])
    return {
        "type": "table",
        "title": "INTERNET TRANSPORT",
        "headers": headers,
        "rows": rows,
    }


def _hosted_continuity_label_for_summary(entry: dict) -> str:
    """4-state continuity for Dependency Summary."""
    if not entry or not isinstance(entry, dict):
        return "Not assessed"
    survivability = entry.get("survivability")
    if survivability == "NO_CONTINUITY" or survivability == "NONE":
        return "No continuity"
    if survivability == "LOCAL_MIRROR_OR_CACHE" or survivability == "LOCAL_MIRROR":
        return "Local mirror/cache"
    if survivability == "ALTERNATE_PLATFORM_OR_PROVIDER" or survivability == "MANUAL_FALLBACK":
        return "Alternate platform/provider"
    if survivability == "UNKNOWN":
        return "Unknown"
    if entry.get("local_mirror_or_offline_fallback") or entry.get("local_data_export"):
        return "Local mirror/cache"
    if (
        entry.get("continuity_mechanism_in_place")
        or entry.get("offline_fallback")
        or entry.get("origin_failover")
        or entry.get("multi_pop")
        or entry.get("secondary_dns")
    ):
        return "Alternate platform/provider"
    return "Not assessed"


def _service_loss_description(service_id: str) -> str:
    """Return Service Loss column value."""
    key = (service_id or "").strip().lower()
    if not key or key == "other":
        return "Hosted Application Service"
    return SERVICE_LOSS_DESCRIPTIONS.get(key, SERVICE_LOSS_MAP.get(key, "Hosted Application Service"))


def _it_critical_hosted_table(assessment_json: dict) -> dict:
    """BLOCK 3: CRITICAL HOSTED SERVICES. Single table; only hosted dependencies (no IT-1/ISP rows)."""
    assessment = assessment_json.get("assessment") or assessment_json
    it_cat = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", default={}) or {}
    it_answers = _safe_get(assessment_json, "sessions", "INFORMATION_TECHNOLOGY", "answers", default={}) or {}
    upstream_raw = it_cat.get("IT-2_upstream_assets") or it_answers.get("IT-2_upstream_assets") or []
    upstream = [u for u in (upstream_raw if isinstance(upstream_raw, list) else list((upstream_raw or {}).values())) if isinstance(u, dict)]
    tti = it_cat.get("time_to_impact_hours") or it_cat.get("curve_time_to_impact_hours")
    tti_str = _format_tti_for_table(tti)
    headers = ["Service", "Provider", "Operational Impact (Time to Severe Impact)", "Service Loss"]
    rows = []
    for u in upstream:
        provider = (u.get("service_provider") or "").strip() or "Not provided"
        if _is_transport_provider(provider):
            if os.environ.get("ADA_REPORTER_DEBUG", "").strip().lower() in ("1", "true", "yes"):
                print(f"[reporter] Routing guard: excluding transport provider from Critical Hosted Services: {provider!r}", file=sys.stderr)
            continue
        service_id = (u.get("service_id") or "").strip()
        service_other = (u.get("service_other") or "").strip()
        service_label = service_other if service_other and str(service_id).lower() == "other" else (service_id or "Unknown service")
        dep_id = (service_id or "").lower() if str(service_id).lower() != "other" else ""
        service_loss = _service_loss_description(dep_id or service_id)
        rows.append([service_label, provider, tti_str, service_loss])
    if not rows:
        rows.append(["No critical hosted services identified.", "—", "—", "—"])
    for row in rows:
        if len(row) >= 2 and row[1] not in ("—", ""):
            if _is_transport_provider(str(row[1])):
                raise RuntimeError("ISP rendered as hosted service; routing bug.")
    return {
        "type": "table",
        "title": "CRITICAL HOSTED SERVICES",
        "headers": headers,
        "rows": rows,
    }


def _it_primary_function(upstream_entry: dict) -> str:
    """Return primary function for an IT-2 upstream entry."""
    sid = (upstream_entry.get("service_id") or "").strip().lower()
    if sid == "other":
        other = (upstream_entry.get("service_other") or "").strip()
        return other if other else "Other"
    return IT_SERVICE_ID_TO_PRIMARY_FUNCTION.get(sid) or "Unknown"


def _normalize_provider_list(raw) -> list:
    """Ensure IT-1_service_providers is a list of dicts."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [p for p in raw if isinstance(p, dict)]
    if isinstance(raw, dict):
        return [v for v in raw.values() if isinstance(v, dict)]
    return []


def _hosted_continuity_label(entry: dict) -> str:
    """Format it_hosted_resilience entry to 4-state continuity label."""
    if not entry or not isinstance(entry, dict):
        return "Not assessed"
    survivability = entry.get("survivability")
    if survivability == "NO_CONTINUITY" or survivability == "NONE":
        return "No continuity"
    if survivability == "LOCAL_MIRROR_OR_CACHE" or survivability == "LOCAL_MIRROR":
        return "Local mirror/cache"
    if survivability == "ALTERNATE_PLATFORM_OR_PROVIDER" or survivability == "MANUAL_FALLBACK":
        return "Alternate platform/provider"
    if survivability == "UNKNOWN":
        return "Unknown"
    if entry.get("local_mirror_or_offline_fallback") or entry.get("local_data_export"):
        return "Local mirror/cache"
    if (
        entry.get("continuity_mechanism_in_place")
        or entry.get("offline_fallback")
        or entry.get("origin_failover")
        or entry.get("multi_pop")
        or entry.get("secondary_dns")
    ):
        return "Alternate platform/provider"
    return "Not assessed"


def _it_hosted_table(assessment_json: dict):
    """Build IT hosted/upstream dependencies table from IT-2 and IT-1."""
    assessment = assessment_json.get("assessment") or assessment_json
    it_cat = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", default={}) or {}
    it_answers = _safe_get(assessment_json, "sessions", "INFORMATION_TECHNOLOGY", "answers", default={}) or {}
    upstream_raw = it_cat.get("IT-2_upstream_assets") or it_answers.get("IT-2_upstream_assets") or []
    upstream = [u for u in (upstream_raw if isinstance(upstream_raw, list) else list((upstream_raw or {}).values())) if isinstance(u, dict)]
    providers = _normalize_provider_list(it_cat.get("IT-1_service_providers") or it_answers.get("IT-1_service_providers"))
    hosted_resilience = it_cat.get("it_hosted_resilience") or {}
    if not isinstance(hosted_resilience, dict):
        hosted_resilience = {}
    rows = []
    for u in upstream:
        service_id = (u.get("service_id") or "").strip()
        service_other = (u.get("service_other") or "").strip()
        service_label = service_other if service_other and str(service_id).lower() == "other" else (service_id or "Unknown service")
        provider = (u.get("service_provider") or "").strip() or "Unknown provider"
        primary_fn = _it_primary_function(u)
        dep_id = f"other_{service_other}" if (service_id or "").lower() == "other" else (service_id or "")
        indicators = _hosted_continuity_label(hosted_resilience.get(dep_id))
        rows.append([service_label, provider, primary_fn, indicators])
    for p in providers:
        provider_name = (p.get("provider_name") or "").strip()
        if not provider_name:
            continue
        dep_id = f"provider_{provider_name}"
        indicators = _hosted_continuity_label(hosted_resilience.get(dep_id))
        rows.append(["IT service provider", provider_name, "Internet and data connectivity; outage affects all external access and dependent services", indicators])
    rows = _dedupe_rows(rows)
    if not rows:
        return None
    return {
        "type": "table",
        "title": "Information Technology – Hosted / Upstream Dependencies",
        "headers": ["Dependency / Service", "Provider", "Primary function", "Continuity"],
        "rows": rows,
    }


def build_it_hosted_dependencies_block(assessment_json: dict):
    """Uses IT-2_upstream_assets and IT-1_service_providers to render hosted/SaaS dependencies."""
    assessment = assessment_json.get("assessment") or assessment_json
    it_cat = _safe_get(assessment, "categories", "INFORMATION_TECHNOLOGY", default={}) or {}
    it_answers = _safe_get(assessment_json, "sessions", "INFORMATION_TECHNOLOGY", "answers", default={}) or {}
    upstream_raw = it_cat.get("IT-2_upstream_assets") or it_answers.get("IT-2_upstream_assets") or []
    upstream = [u for u in (upstream_raw if isinstance(upstream_raw, list) else list((upstream_raw or {}).values())) if isinstance(u, dict)]
    providers = _normalize_provider_list(it_cat.get("IT-1_service_providers") or it_answers.get("IT-1_service_providers"))
    rows = []
    for u in upstream:
        service_id = (u.get("service_id") or "").strip()
        service_provider = (u.get("service_provider") or "").strip()
        service_other = (u.get("service_other") or "").strip()
        service_label = service_other if service_id in ("other", "OTHER") else service_id
        service_label = service_label or "Unknown service"
        primary_fn = _it_primary_function(u)
        rows.append([service_label, service_provider or "Unknown provider", primary_fn])
    for p in providers:
        provider_name = (p.get("provider_name") or "").strip()
        if provider_name:
            rows.append(["IT service provider", provider_name, "Internet and data connectivity; outage affects all external access and dependent services"])
    rows = _dedupe_rows(rows)
    if not rows:
        return None
    return {
        "type": "table",
        "title": "Hosted / Upstream IT Dependencies",
        "headers": ["Dependency / Service", "Provider", "Primary function"],
        "rows": rows,
    }


def _append_it_hosted_clause_to_vuln_blocks(vuln_blocks_str: str, assessment_json: dict) -> str:
    """No-op; phrasing is applied by the web export per vuln type."""
    return vuln_blocks_str or ""


def build_it_transport_providers_block(assessment_json: dict):
    """ISP provider names from curve only. Returns table block or None if no providers."""
    assessment = assessment_json.get("assessment") or assessment_json
    isp_names = _get_it_isp_names_from_curve(assessment)
    if not isp_names:
        return None
    rows = []
    if len(isp_names) >= 1:
        rows.append(["Primary Internet Provider", isp_names[0], "", "UNKNOWN", ""])
    if len(isp_names) >= 2:
        rows.append(["Secondary Internet Provider", isp_names[1], "", "UNKNOWN", ""])
    rows = _dedupe_rows(rows)
    if not rows:
        return None
    return {
        "type": "table",
        "title": "IT Transport Providers (Internet / Circuits)",
        "headers": ["Role", "Provider", "Demarcation / Termination", "Independence", "Notes"],
        "rows": rows,
    }


def _set_cell_no_wrap(cell) -> None:
    """Add w:noWrap to cell so text does not wrap."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    if tcPr.find(qn("w:noWrap")) is None:
        tcPr.append(OxmlElement("w:noWrap"))


def _set_tbl_layout_fixed(table) -> None:
    """Set w:tblLayout type='fixed' for fixed table layout."""
    tbl = table._tbl
    tblPr = tbl.find(qn("w:tblPr"))
    if tblPr is None:
        tblPr = OxmlElement("w:tblPr")
        tbl.insert(0, tblPr)
    tblLayout = tblPr.find(qn("w:tblLayout"))
    if tblLayout is None:
        tblLayout = OxmlElement("w:tblLayout")
        tblLayout.set(qn("w:type"), "fixed")


def _infer_table_col_widths(block: dict, num_cols: int) -> list[float] | None:
    """Return table width profile (inches) for known dependency-summary tables."""
    title = (block.get("title") or "").strip().upper()
    headers = [str(h).strip().lower() for h in (block.get("headers") or [])]
    if num_cols == 6 and headers[:2] == ["category", "provider identified"]:
        return SUMMARY_COL_WIDTHS
    if num_cols == 5 and title == "INTERNET TRANSPORT":
        return [1.2, 1.1, 1.6, 1.1, 1.5]
    if num_cols == 5 and title == "CRITICAL HOSTED SERVICES":
        return [1.4, 1.0, 1.7, 1.2, 1.2]
    if num_cols == 5 and headers[:2] == ["role", "provider"]:
        return [1.2, 1.1, 1.6, 1.1, 1.5]
    if num_cols == 5 and headers[:2] == ["service", "provider"]:
        return [1.4, 1.0, 1.7, 1.2, 1.2]
    return None


def _normalize_table_paragraph_spacing(table) -> None:
    """Normalize cell paragraph spacing for dense, readable report tables."""
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                try:
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(0)
                    p.paragraph_format.line_spacing = 1.0
                except Exception:
                    pass
        tblPr.append(tblLayout)
    else:
        tblLayout.set(qn("w:type"), "fixed")


def _render_table_block_after(
    doc: Document, block: dict, after_block, *, omit_title: bool = False
) -> DocxParagraph:
    """Render a table block (optionally title + table) after the given paragraph or table."""
    title = (block.get("title") or "").strip()
    headers = block.get("headers") or []
    rows = block.get("rows") or []
    if not headers and not rows:
        return after_block
    if omit_title:
        if hasattr(after_block, "_tbl"):
            ref_para = insert_paragraph_after_block(doc, after_block, "", style="Normal")
        else:
            ref_para = after_block
        set_paragraph_keep_with_next(ref_para)
    else:
        if hasattr(after_block, "_tbl"):
            title_para = insert_paragraph_after_block(doc, after_block, sanitize_text(title), style="Heading 4")
        else:
            title_para = insert_paragraph_after(after_block, sanitize_text(title))
            try:
                title_para.style = "Heading 4"
            except Exception:
                pass
        set_paragraph_keep_with_next(title_para)
        ref_para = title_para
    num_cols = max(len(headers), max(len(r) for r in rows) if rows else 0)
    if num_cols == 0:
        return ref_para
    tbl = insert_table_after(doc, ref_para, 1 + len(rows), num_cols)
    apply_table_grid_style(tbl)
    _set_tbl_layout_fixed(tbl)
    widths = _infer_table_col_widths(block, num_cols)
    if widths:
        set_table_fixed_widths(tbl, widths)
    for c, h in enumerate(headers):
        if c < num_cols:
            tbl.rows[0].cells[c].text = sanitize_text(str(h))
    set_repeat_header_row(tbl.rows[0])
    set_table_rows_cant_split(tbl)
    for r_idx, row in enumerate(rows):
        for c_idx, cell_val in enumerate(row):
            if c_idx < num_cols and r_idx + 1 < len(tbl.rows):
                tbl.rows[r_idx + 1].cells[c_idx].text = sanitize_text(str(cell_val))
    _normalize_table_paragraph_spacing(tbl)
    return insert_paragraph_after_block(doc, tbl, "", style="Normal")


def category_no_break(s: str) -> str:
    """Replace spaces with non-breaking spaces so category labels don't split mid-word."""
    return (s or "").replace(" ", "\u00A0").strip()


def _effective_has_backup(inp: dict) -> bool:
    """True if has_backup_any or has_backup is True."""
    if inp.get("has_backup_any") is True:
        return True
    return inp.get("has_backup", False) is True


def _sources_summary(supply: dict | None) -> str | None:
    """Descriptive only: list explicit provider/service names."""
    if supply is None or not isinstance(supply, dict):
        return None
    sources = supply.get("sources") or []
    if not sources:
        return None
    parts = []
    for s in sources:
        if not isinstance(s, dict):
            continue
        name = (s.get("provider_name") or s.get("service_provider") or s.get("provider") or "").strip()
        if name:
            role = (s.get("role") or "").strip()
            parts.append(f"{name}" + (f" ({role})" if role else ""))
    if not parts:
        return None
    return "; ".join(parts)


def normalize_note_text(x) -> str:
    """Force notes to a clean human string."""
    if x is None:
        return ""
    if isinstance(x, (int, float)):
        return ""
    if isinstance(x, (list, tuple)):
        parts = [str(p).strip() for p in x if isinstance(p, (str, int, float)) and str(p).strip()]
        if parts and all(p.isdigit() for p in parts):
            return ""
        return "; ".join(parts)
    s = str(x).replace("\u00a0", " ").strip()
    if s.isdigit():
        return ""
    return s


def _primary_provider_identified(inp: dict, category: str) -> str:
    """Provider Identified = YES if ANY of sources/curve_primary/E-1/IT-1; NO only if none exist."""
    if category == "CRITICAL_PRODUCTS":
        return "No"
    supply = inp.get("supply") or {}
    sources = supply.get("sources") or []
    has_in_sources = any(
        (s or {}).get("provider_name") and str((s or {}).get("provider_name", "")).strip()
        or (s or {}).get("service_provider") and str((s or {}).get("service_provider", "")).strip()
        or (s or {}).get("provider") and str((s or {}).get("provider", "")).strip()
        for s in sources
    )
    if has_in_sources:
        return "Yes"
    curve_primary = (inp.get("curve_primary_provider") or "").strip()
    if curve_primary:
        return "Yes"
    if category == "ELECTRIC_POWER":
        providers = inp.get("E-1_utility_providers") or []
        if isinstance(providers, list) and any(
            (p or {}).get("provider_name") and str((p or {}).get("provider_name", "")).strip()
            for p in providers
        ):
            return "Yes"
    if category == "INFORMATION_TECHNOLOGY":
        if (inp.get("IT-1_can_identify_providers") or "").strip().lower() in ("yes", "true", "1"):
            return "Yes"
        it1 = inp.get("IT-1_service_providers") or []
        if isinstance(it1, list) and any(
            (p or {}).get("provider_name") and str((p or {}).get("provider_name", "")).strip()
            for p in it1
        ):
            return "Yes"
        if isinstance(it1, dict):
            for p in (it1 or {}).values():
                if isinstance(p, dict) and (p.get("provider_name") or "").strip():
                    return "Yes"
    return "No"


def _independence_note_suffix(inp: dict, provider: str) -> str:
    """When provider is Yes but all sources have independence UNKNOWN or missing, return suffix for notes."""
    if provider != "Yes":
        return ""
    supply = inp.get("supply") or {}
    sources = supply.get("sources") or []
    if not sources:
        return ""
    all_unknown = all(
        (s or {}).get("independence") in (None, "", "UNKNOWN")
        for s in sources
    )
    if not all_unknown:
        return ""
    return " Provider identified; independence not provided."


def build_summary(assessment: dict) -> list[dict]:
    """One row per category for template summary table (D1 format). Critical Products always last."""
    categories = dict(assessment.get("categories") or {})
    categories.pop("CRITICAL_PRODUCTS", None)
    order = list(CHART_CATEGORIES)
    seen = set()
    rows = []
    for category in order:
        if category not in categories:
            continue
        seen.add(category)
        raw_inp = categories[category]
        inp = dict(raw_inp) if isinstance(raw_inp, dict) else {}
        has_backup = _effective_has_backup(inp)
        time_impact = inp.get("time_to_impact_hours")
        recovery = inp.get("recovery_time_hours")
        s = _sources_summary(inp.get("supply"))
        notes = normalize_note_text(s)
        provider = _primary_provider_identified(inp, category)
        if not notes or notes.strip() == SUMMARY_NOT_CONFIRMED_TEXT.strip():
            notes = "Provider identified." if provider == "Yes" else SUMMARY_NOT_CONFIRMED_TEXT
        elif len(notes) > 80:
            notes = notes[:77] + "..."
        notes_final = notes + _independence_note_suffix(inp, provider)
        if len(notes_final) > 80:
            notes_final = notes_final[:77] + "..."
        rows.append({
            "category": CATEGORY_DISPLAY.get(category, category),
            "primary_provider": provider,
            "backup_present": "Yes" if has_backup else "No",
            "time_to_severe_impact_hrs": "N/A" if time_impact is None else str(time_impact),
            "recovery_time_hrs": "N/A" if recovery is None else str(recovery),
            "notes": notes_final,
        })
    for category, raw_inp in categories.items():
        if category in seen:
            continue
        inp = dict(raw_inp) if isinstance(raw_inp, dict) else {}
        s = _sources_summary(inp.get("supply"))
        notes = normalize_note_text(s)
        provider = _primary_provider_identified(inp, category)
        if not notes or notes.strip() == SUMMARY_NOT_CONFIRMED_TEXT.strip():
            notes = "Provider identified." if provider == "Yes" else SUMMARY_NOT_CONFIRMED_TEXT
        notes_final = notes + _independence_note_suffix(inp, provider)
        if len(notes_final) > 80:
            notes_final = notes_final[:77] + "..."
        rows.append({
            "category": CATEGORY_DISPLAY.get(category, category),
            "primary_provider": provider,
            "backup_present": "No",
            "time_to_severe_impact_hrs": "N/A",
            "recovery_time_hrs": "N/A",
            "notes": notes_final,
        })
    rows.append({
        "category": "Critical Products",
        "primary_provider": "N/A",
        "backup_present": "N/A",
        "time_to_severe_impact_hrs": "N/A",
        "recovery_time_hrs": "N/A",
        "notes": "—",
    })
    return rows


def build_summary_table_at_anchor(
    doc: Document,
    summary_rows: list[dict],
    anchor: str = DEP_SUMMARY_TABLE_ANCHOR,
    assessment_json: dict | None = None,
    part2: dict | None = None,
) -> None:
    """
    Insert 6-col summary table at anchor. Fixed layout, noWrap on Category.
    When part2 provided, use part2 internet_transport_rows and critical_hosted_services_rows
    with "Not provided" or "—" for empty table cells where specified.
    """
    p = find_paragraph_by_exact_text(doc, anchor, body_only=False)
    if p is None and anchor != DEP_SUMMARY_TABLE_ANCHOR:
        p = find_paragraph_by_exact_text(doc, DEP_SUMMARY_TABLE_ANCHOR, body_only=False)
    if p is None:
        raise RuntimeError(
            f"DEPENDENCY SUMMARY anchor not found: {anchor} or {DEP_SUMMARY_TABLE_ANCHOR}. "
            "Export requires one of these in the template."
        )
    if not summary_rows:
        summary_rows = [{"category": "No summary data", "primary_provider": "No", "backup_present": "No", "time_to_severe_impact_hrs": "", "recovery_time_hrs": "", "notes": SUMMARY_NOT_CONFIRMED_TEXT}]
    set_paragraph_keep_with_next(p)
    num_rows = 1 + len(summary_rows)
    table = insert_table_after(doc, p, num_rows, 6)
    apply_table_grid_style(table)
    table.autofit = False
    _set_tbl_layout_fixed(table)
    set_table_fixed_widths(table, SUMMARY_COL_WIDTHS)
    for c, h in enumerate(SUMMARY_HEADERS_6):
        table.rows[0].cells[c].text = h
        if c == 0:
            _set_cell_no_wrap(table.rows[0].cells[0])
    set_repeat_header_row(table.rows[0])
    set_table_rows_cant_split(table)
    acronyms_seen: set = set()
    for r, row_data in enumerate(summary_rows, start=1):
        cat_cell = table.rows[r].cells[0]
        cat_cell.text = sanitize_text(category_no_break(str(row_data.get("category", ""))))
        _set_cell_no_wrap(cat_cell)
        provider_raw = str(row_data.get("primary_provider", "No"))
        provider_cell = expand_acronym(provider_raw, acronyms_seen)
        table.rows[r].cells[1].text = sanitize_text(provider_cell)
        table.rows[r].cells[2].text = sanitize_text(str(row_data.get("backup_present", "No")))
        table.rows[r].cells[3].text = sanitize_text(str(row_data.get("time_to_severe_impact_hrs", "Unknown")))
        table.rows[r].cells[4].text = sanitize_text(str(row_data.get("recovery_time_hrs", "Unknown")))
        notes_raw = str(row_data.get("notes", SUMMARY_NOT_CONFIRMED_TEXT))
        notes_cell = expand_acronym_in_text(notes_raw, acronyms_seen)
        table.rows[r].cells[5].text = sanitize_text(notes_cell)
    insert_paragraph_after(p, "")
    remove_paragraph(p)

    safe_assessment = assessment_json or {}
    if part2 and isinstance(part2, dict):
        transport_rows = part2.get("internet_transport_rows") or []

        def _transport_cell(r: dict, key: str, use_not_provided_for_empty: bool = False) -> str:
            val = (r.get(key) or "").strip()
            if use_not_provided_for_empty and not val:
                return "Not provided"
            return val or "—"

        transport_block = {
            "type": "table",
            "title": "INTERNET TRANSPORT",
            "headers": ["Role", "Provider", "Demarcation", "Independence", "Notes"],
            "rows": [[r.get("role", ""), r.get("provider", ""), _transport_cell(r, "demarcation", use_not_provided_for_empty=True), _transport_cell(r, "independence", use_not_provided_for_empty=True), _transport_cell(r, "notes", use_not_provided_for_empty=True)] for r in transport_rows],
        }
        hosted_rows = part2.get("critical_hosted_services_rows") or []
        if not hosted_rows:
            hosted_rows = [{"service": "No critical hosted services identified.", "provider": "—", "service_loss_effect": "—", "continuity_strategy": "—", "notes": "—"}]
        hosted_block = {
            "type": "table",
            "title": "CRITICAL HOSTED SERVICES",
            "headers": ["Service", "Provider", "Service Loss", "Continuity Strategy", "Notes"],
            "rows": [[r.get("service", ""), r.get("provider", ""), r.get("service_loss_effect", ""), r.get("continuity_strategy", ""), r.get("notes", "—")] for r in hosted_rows],
        }
    else:
        transport_block = _internet_transport_table(safe_assessment)
        hosted_block = _it_critical_hosted_table(safe_assessment)
    replaced_transport = replace_anchor_with_table_only(doc, IT_TRANSPORT_SECTION_ANCHOR, transport_block)
    replaced_hosted = replace_anchor_with_table_only(doc, IT_HOSTED_SECTION_ANCHOR, hosted_block)
    if not replaced_transport or not replaced_hosted:
        insert_after = table
        if not replaced_transport:
            insert_after = _render_table_block_after(doc, transport_block, insert_after, omit_title=True)
        if not replaced_hosted:
            insert_after = _render_table_block_after(doc, hosted_block, insert_after, omit_title=True)


def _count_rendered_vulnerability_blocks(doc: Document) -> int:
    """Count vulnerability blocks actually rendered in the document (ADA_Vuln_Header paragraphs)."""
    count = 0
    for p, _ in iter_paragraphs_and_cells(doc):
        try:
            if getattr(p, "style", None) and getattr(p.style, "name", None) == "ADA_Vuln_Header":
                count += 1
        except Exception:
            continue
    return count


def _correct_vulnerability_count_summary(doc: Document, rendered_count: int) -> None:
    """Replace 'Total findings: N' in the vulnerability count summary paragraph with the rendered block count."""
    pattern = re.compile(r"Total findings:\s*\d+", re.IGNORECASE)
    replacement = f"Total findings: {rendered_count}"
    for p, _ in iter_paragraphs_and_cells(doc):
        text = p.text or ""
        if "Total findings:" in text and pattern.search(text):
            new_text = pattern.sub(replacement, text)
            if new_text != text:
                p.clear()
                p.add_run(sanitize_text(new_text))
            break


def render_part2(doc: Document, data: dict, template_path: str | None = None) -> int:
    """
    Part II (Technical Annex): summary table, structural profile, vulnerability count, vulnerability blocks,
    cross-infra, designation block. Then correct vulnerability count summary.
    Returns rendered vulnerability block count.
    """
    part2, use_vm = get_part2_from_payload(data)
    assessment = data.get("assessment") or {}

    ensure_ada_vuln_styles(doc)

    # Summary table at [[TABLE_DEPENDENCY_SUMMARY]]
    if use_vm and part2.get("dependency_summary_rows"):
        summary_rows = part2["dependency_summary_rows"]
    else:
        summary_rows = build_summary(assessment)
    assert any(
        (r.get("category") or "").strip() in ("Critical Products", "CRITICAL_PRODUCTS")
        for r in summary_rows
    ), "build_summary must include Critical Products row (verifier requirement)"
    build_summary_table_at_anchor(doc, summary_rows, anchor=TABLE_DEPENDENCY_SUMMARY_ANCHOR, assessment_json=data, part2=part2 if use_vm else None)

    # Part II federal-style anchors
    for anchor, key in [
        (STRUCTURAL_PROFILE_SUMMARY_ANCHOR, "structural_profile_summary"),
        (VULNERABILITY_COUNT_SUMMARY_ANCHOR, "vulnerability_count_summary"),
        (VULNERABILITY_BLOCKS_ANCHOR, "vulnerability_blocks"),
        (CROSS_INFRA_ANALYSIS_ANCHOR, "cross_infra_analysis"),
    ]:
        if _doc_contains_anchor(doc, anchor):
            val = data.get(key) or ""
            if key == "vulnerability_blocks":
                vm_vulns = part2.get("vulnerabilities") if use_vm else None
                if use_vm and isinstance(vm_vulns, list) and len(vm_vulns) > 0:
                    _render_structured_vulnerabilities(doc, anchor, vm_vulns, body_only=True)
                else:
                    themed = get_part2_findings(assessment)
                    inject_themed_findings_at_anchor(doc, anchor, themed, body_only=True)
            else:
                inject_text_at_anchor(doc, anchor, (val or "").replace("\u00a0", " ").strip(), body_only=True)

    rendered_vuln_count = _count_rendered_vulnerability_blocks(doc)
    _correct_vulnerability_count_summary(doc, rendered_vuln_count)

    # Designation block
    if _doc_contains_anchor(doc, DESIGNATION_SERVICES_ANCHOR):
        asset = assessment.get("asset") or {}
        services = [s.strip() for s in (asset.get("services_provided") or []) if (s or "").strip()]
        if services:
            designation_text = "This facility provides: " + ", ".join(services) + "."
        else:
            designation_text = "None specified."
        inject_text_at_anchor(doc, DESIGNATION_SERVICES_ANCHOR, designation_text, body_only=True)

    return rendered_vuln_count
