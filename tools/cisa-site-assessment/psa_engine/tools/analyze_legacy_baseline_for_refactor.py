#!/usr/bin/env python3
"""
Deterministic analyzer for legacy baseline questions.
Produces a DROP/MOVE map for refactoring baseline canon.

No DB writes; reports only.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from enum import Enum

# Import linter
try:
    from tools.lint.question_linter import lint_question
except ImportError:
    # Fallback if running from different directory
    import sys
    from pathlib import Path
    # Add parent directory to path to allow relative import
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from tools.lint.question_linter import lint_question

# Reason codes (fixed enum)
class ReasonCode(str, Enum):
    FORBIDDEN_PHRASE_BASIC_FUNCTION = "FORBIDDEN_PHRASE_BASIC_FUNCTION"
    FORBIDDEN_QUALITY_ADJECTIVE = "FORBIDDEN_QUALITY_ADJECTIVE"
    SUBTYPE_LEVEL_PROCEDURE_QUESTION = "SUBTYPE_LEVEL_PROCEDURE_QUESTION"
    SUBTYPE_LEVEL_ROLES_QUESTION = "SUBTYPE_LEVEL_ROLES_QUESTION"
    SOLUTION_ARTIFACT_IN_QUESTION = "SOLUTION_ARTIFACT_IN_QUESTION"
    UNANCHORED_NO_BOUNDARY = "UNANCHORED_NO_BOUNDARY"
    SUBJECTIVE_JUDGMENT_REQUIRED = "SUBJECTIVE_JUDGMENT_REQUIRED"
    SECTOR_SUBSECTOR_CONTEXT_REQUIRED = "SECTOR_SUBSECTOR_CONTEXT_REQUIRED"
    DUPLICATE_OF_CANON_SPINE = "DUPLICATE_OF_CANON_SPINE"

# Outcome types
class Outcome(str, Enum):
    REWRITE_TO_CONTROL_ASSERTION = "REWRITE_TO_CONTROL_ASSERTION"
    MOVE_TO_SMG = "MOVE_TO_SMG"
    MOVE_TO_COMPONENT_CHECKLIST = "MOVE_TO_COMPONENT_CHECKLIST"
    MOVE_TO_EXPANSION = "MOVE_TO_EXPANSION"
    DROP = "DROP"

# Forbidden patterns
FORBIDDEN_PATTERNS = {
    ReasonCode.FORBIDDEN_PHRASE_BASIC_FUNCTION: [
        r"perform\s+their\s+basic\s+function",
        r"perform\s+its\s+basic\s+function",
        r"basic\s+function",
    ],
    ReasonCode.FORBIDDEN_QUALITY_ADJECTIVE: [
        r"\beffective\b",
        r"\badequate\b",
        r"\bsufficient\b",
        r"\bproperly\b",
        r"\bappropriately\b",
    ],
    ReasonCode.SUBTYPE_LEVEL_PROCEDURE_QUESTION: [
        r"documented\s+procedures\s+in\s+place\s+for",
        r"procedures\s+established\s+for\s+\[?subtype",
        r"procedures\s+for\s+\[?system",
    ],
    ReasonCode.SUBTYPE_LEVEL_ROLES_QUESTION: [
        r"roles\s+and\s+responsibilities\s+defined\s+for",
        r"roles\s+and\s+responsibilities\s+for\s+\[?subtype",
    ],
    ReasonCode.SOLUTION_ARTIFACT_IN_QUESTION: [
        r"\bNVR\b",
        r"\bDVR\b",
        r"\bIP\s+camera\b",
        r"\bONVIF\b",
        r"\bvideo\s+wall\b",
        r"\bbiometric\s+modality\b",
    ],
}

# Component-level depth indicators (for MOVE_TO_COMPONENT_CHECKLIST)
COMPONENT_DEPTH_INDICATORS = [
    r"\bretention\b",
    r"\bredundancy\b",
    r"\bfrequency\b",
    r"\bcoverage\s+percentage\b",
    r"\bstaffing\s+levels\b",
    r"\btesting\s+intervals\b",
    r"\bbackup\s+counts\b",
    r"\bbackup\b",
    r"\binterval\b",
    r"\bpercentage\b",
    r"\bcoverage\b",
]

# Sector/subsector context indicators
SECTOR_CONTEXT_TERMS = [
    r"\bcrowd\b",
    r"\bVIP\b",
    r"\balcohol\b",
    r"\bevent\b",
    r"\bstadium\b",
    r"\bvenue\b",
    r"\bconference\b",
    r"\bexhibition\b",
    r"\bretail\b",
    r"\bhealthcare\b",
    r"\beducation\b",
    r"\btransportation\b",
]

# Discipline prefixes that are inherently procedural (allow procedure questions)
PROCEDURAL_DISCIPLINE_PREFIXES = {
    "EAP",  # Emergency Action Plans
    "EMR",  # Emergency Management/Resilience
    "SMG",  # Security Management/Governance
    "ISC",  # Information Sharing/Coordination
    "SFO",  # Security Force Operations
}

# Rewrite templates by subtype_code
REWRITE_TEMPLATES: Dict[str, str] = {
    # ACS (Access Control) - boundary-anchored control assertions (baseline spine candidates, SYSTEMS only)
    "ACS_BIOMETRIC_ACCESS": "Are biometric identity verification decisions made at controlled entry points before access is granted?",
    "ACS_CREDENTIAL_BADGE_SYSTEMS": "Are access credential decisions made at controlled entry points based on presented credentials?",
    "ACS_CREDENTIALING_BADGING": "Are access credentials issued and managed as the basis for making access decisions at controlled entry points?",
    "ACS_ENTRY_CONTROL_POINTS": "Are entry points to the facility identified and controlled as access decision points?",
    "ACS_INTERIOR_ACCESS_CONTROL": "Is access to interior controlled areas managed through defined access decision points?",
    "ACS_LOCKS_HARDWARE": "Are door access points controlled through physical locking mechanisms where access decisions are required?",
    "ACS_MANUAL_ACCESS_CONTROL": "Are access decisions made at controlled entry points based on authorization?",
    "ACS_PEDESTRIAN_ENTRY_POINTS": "Are pedestrian entry points identified and controlled as access decision points?",
    "ACS_RESTRICTED_AREAS": "Are restricted areas defined and controlled using access decisions at their entry points?",
    "ACS_TURNSTILES_PORTALS": "Are pedestrian access portals controlled where access decisions are required?",
    "ACS_VEHICLE_ENTRY_POINTS": "Are vehicle entry points identified and controlled as access decision points?",
    "ACS_VISITOR_MANAGEMENT": "Is visitor access controlled through a defined process at controlled entry points?",
    
    # IDS (Intrusion Detection) - boundary-anchored control assertions (baseline spine candidates, SYSTEMS only)
    "IDS_ALARM_MONITORING": "Are intrusion alarms monitored at a defined monitoring point where alarm events are received?",
    "IDS_ALARM_GENERATION_NOTIFICATION": "Are intrusion detection zones defined and monitored such that alarm conditions generate an alert at the monitoring point?",
    "IDS_INTRUSION_DETECTION": "Are unauthorized entry attempts detected at defined detection zones where alerts are generated?",
    "IDS_INTEGRATION_OTHER_SYSTEMS": "Are intrusion alarm events integrated into security monitoring workflows at the monitoring point?",
    "IDS_SYSTEM_RELIABILITY_TAMPER": "Are intrusion detection devices and circuits monitored for tamper conditions at the monitoring point?",
    
    # VSS (Video Surveillance) - EXACTLY 3 baseline spines (all others are depth)
    "VSS_EXTERIOR_CAMERAS": "Do cameras cover exterior areas where video monitoring is needed for security?",
    "VSS_INTERIOR_CAMERAS": "Do cameras cover interior areas where video monitoring is needed for security?",
    "VSS_RECORDING_STORAGE_NVR_DVR": "Is video recorded from cameras that cover areas monitored for security?",
    
    # PER (Perimeter) - boundary-anchored control assertions (baseline spine candidates)
    "PER_BOLLARDS_BARRIERS": "Are vehicle approach points or vulnerable perimeter segments identified and controlled using vehicle-stopping or vehicle-channeling measures?",
    "PER_BOUNDARY_DEMARCATION": "Is the site perimeter or property boundary clearly identified and controlled as a defined security boundary?",
    "PER_CLEAR_ZONES": "Are clear zones established and controlled along the site perimeter to support observation and deter unauthorized approach?",
    "PER_FENCING": "Is the site perimeter boundary controlled through defined barriers that limit or channel access?",
    "PER_GATES": "Are perimeter vehicle and pedestrian gates identified and controlled as access points to the site?",
    "PER_PERIMETER_SIGNAGE": "Is perimeter signage used to identify controlled boundaries and communicate access restrictions at the site perimeter?",
    "PER_PERIMETER_LIGHTING": "Is exterior/perimeter lighting provided and controlled to support perimeter observation at night or during low-light conditions?",
    "PER_PHYSICAL_BARRIERS": "Are physical barriers present that delay unauthorized entry at the perimeter?",
    "PER_PERIMETER_DEFINITION": "Is the site perimeter clearly defined and identifiable?",
    "PER_VEHICLE_ACCESS_CONTROL_POINTS": "Are vehicle access points identified and controlled at the site perimeter?",
    
    # INT (Interior) - boundary-anchored control assertions (baseline spine candidates, SYSTEMS only)
    "INT_ACCESS_RESTRICTED_AREAS": "Are restricted areas entered only through entry points where access rules are enforced?",
    "INT_HARD_INTERIOR_BARRIERS": "Are interior barriers controlled to restrict movement between areas?",
    "INT_INTERIOR_DOORS": "Are interior doors controlled to restrict movement between areas?",
    "INT_INTERIOR_LIGHTING": "Is interior lighting controlled to support observation in restricted areas?",
    "INT_SAFE_ROOMS": "Are safe rooms controlled at their entry points?",
    "INT_SECURE_ROOMS": "Are secure rooms controlled at their entry points?",
    "INT_SENSITIVE_ITEM_STORAGE": "Is sensitive item storage controlled at its entry points?",
    
    # FAC (Facility Hardening)
    
    # KEY (Key Control)
    "KEY_DISTRIBUTION_CONTROL": "Is key distribution and custody controlled with accountability maintained?",
    
    # COM (Communications)
    "COM_INTERNAL_COMMUNICATIONS": "Can security personnel communicate internally when needed?",
    "COM_EXTERNAL_COMMUNICATIONS": "Can security personnel communicate with external partners when needed?",
    
    # EAP (Emergency Action Plans)
    "EAP_EVACUATION_PROCEDURES": "Are evacuation procedures established and available?",
    "EAP_LOCKDOWN_PROCEDURES": "Are lockdown procedures established and available?",
    "EAP_SHELTER_IN_PLACE": "Are shelter-in-place procedures established and available?",
    "EAP_DRILLS": "Are emergency response drills conducted?",
    
    # EMR (Emergency Management/Resilience)
    "EMR_CRISIS_MANAGEMENT": "Is crisis management capability established and coordination frameworks available?",
    "EMR_CONTINUITY_PLANNING": "Is continuity planning established and available?",
    
    # ISC (Information Sharing/Coordination)
    "ISC_COORDINATION_CHANNELS": "Are information sharing channels established for coordination and reporting?",
    "ISC_LIAISONS": "Are liaison relationships established for coordination?",
    
    # SFO (Security Force Operations)
    "SFO_SECURITY_PRESENCE": "Is security presence established at designated areas?",
    "SFO_PATROLS": "Are security patrols conducted and incidents reported?",
    "SFO_RESPONSE_CAPABILITY": "Is security response capability established for incidents?",
    
    # SMG (Security Management/Governance)
    "SMG_OVERSIGHT": "Is security oversight assigned and policies established?",
    "SMG_PROCEDURES": "Are security procedures documented and available?",
    "SMG_RISK_ASSESSMENT": "Is a risk assessment process established?",
    "SMG_TRAINING": "Is security training provided to personnel?",
    
    # CPTED (Crime Prevention Through Environmental Design)
    "CPTED_VISIBILITY": "Do environmental features support visibility and movement control?",
    "CPTED_TERRITORIAL_CUES": "Are territorial cues and wayfinding elements present?",
}

# Optional seed templates keyed to real VSS subtype codes.
# Empty templates are ignored (must be filled manually).
# Use relative path from script location
_script_dir = Path(__file__).parent
VSS_TEMPLATE_SEED_PATH = _script_dir.parent / "doctrine" / "baseline_canon" / "review_packets" / "VSS_templates.seed.json"

# Optional seed templates keyed to real INT subtype codes.
# Empty templates are ignored (must be filled manually).
INT_TEMPLATE_SEED_PATH = _script_dir.parent / "doctrine" / "baseline_canon" / "review_packets" / "INT_templates.seed.json"

# Optional seed templates keyed to real KEY subtype codes.
# Empty templates are ignored (must be filled manually).
KEY_TEMPLATE_SEED_PATH = _script_dir.parent / "doctrine" / "baseline_canon" / "review_packets" / "KEY_templates.seed.json"

# Optional seed templates keyed to real COM subtype codes.
# Empty templates are ignored (must be filled manually).
COM_TEMPLATE_SEED_PATH = _script_dir.parent / "doctrine" / "baseline_canon" / "review_packets" / "COM_templates.seed.json"

def _merge_seed_templates():
    """Merge filled templates from seed files into REWRITE_TEMPLATES."""
    # Merge VSS templates
    try:
        if VSS_TEMPLATE_SEED_PATH.exists():
            with open(VSS_TEMPLATE_SEED_PATH, "r", encoding="utf-8") as f:
                seed = json.load(f)
            templates = seed.get("templates") or {}
            for k, v in templates.items():
                if not isinstance(v, dict):
                    continue
                tmpl = (v.get("template") or "").strip()
                if tmpl:
                    REWRITE_TEMPLATES[k] = tmpl
    except Exception:
        pass  # Silently ignore if seed file is missing or malformed
    
    # Merge INT templates
    try:
        if INT_TEMPLATE_SEED_PATH.exists():
            with open(INT_TEMPLATE_SEED_PATH, "r", encoding="utf-8") as f:
                seed = json.load(f)
            templates = seed.get("templates") or {}
            for k, v in templates.items():
                if not isinstance(v, dict):
                    continue
                tmpl = (v.get("template") or "").strip()
                if tmpl:
                    REWRITE_TEMPLATES[k] = tmpl
    except Exception:
        pass  # Silently ignore if seed file is missing or malformed
    
    # Merge KEY templates
    try:
        if KEY_TEMPLATE_SEED_PATH.exists():
            with open(KEY_TEMPLATE_SEED_PATH, "r", encoding="utf-8") as f:
                seed = json.load(f)
            templates = seed.get("templates") or {}
            for k, v in templates.items():
                if not isinstance(v, dict):
                    continue
                tmpl = (v.get("template") or "").strip()
                if tmpl:
                    REWRITE_TEMPLATES[k] = tmpl
    except Exception:
        pass  # Silently ignore if seed file is missing or malformed
    
    # Merge COM templates
    try:
        if COM_TEMPLATE_SEED_PATH.exists():
            with open(COM_TEMPLATE_SEED_PATH, "r", encoding="utf-8") as f:
                seed = json.load(f)
            templates = seed.get("templates") or {}
            for k, v in templates.items():
                if not isinstance(v, dict):
                    continue
                tmpl = (v.get("template") or "").strip()
                if tmpl:
                    REWRITE_TEMPLATES[k] = tmpl
    except Exception:
        pass  # Silently ignore if seed file is missing or malformed

# Merge seed templates at module load time
_merge_seed_templates()

def _attach_lint(record: dict, *, require_boundary: bool = True) -> dict:
    """
    Attach lint results to a record.
    Lints the candidate question text that a reviewer would see.
    Prefers proposed_rewrite, else question_text/question.
    """
    text = record.get("proposed_rewrite") or record.get("question_text") or record.get("question") or ""
    record["lint"] = lint_question(text, require_boundary=require_boundary)
    return record

def detect_forbidden_patterns(question_text: str) -> List[ReasonCode]:
    """Detect forbidden patterns in question text."""
    detected = []
    question_lower = question_text.lower()
    
    for reason_code, patterns in FORBIDDEN_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, question_lower, re.IGNORECASE):
                detected.append(reason_code)
                break  # Only add each reason code once
    
    return detected

def detect_sector_context(question_text: str) -> bool:
    """Detect if question requires sector/subsector context."""
    question_lower = question_text.lower()
    for term in SECTOR_CONTEXT_TERMS:
        if re.search(term, question_lower, re.IGNORECASE):
            return True
    return False

def detect_component_depth(question_text: str) -> bool:
    """Detect if question contains component-level depth indicators."""
    question_lower = question_text.lower()
    for pattern in COMPONENT_DEPTH_INDICATORS:
        if re.search(pattern, question_lower, re.IGNORECASE):
            return True
    return False

def classify_question(
    question: Dict[str, Any],
    canon_spines: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Classify a legacy question into an outcome with reason codes.
    
    Returns:
        {
            "outcome": Outcome,
            "reason_codes": List[ReasonCode],
            "rewrite_template": Optional[str],
            "proposed_rewrite": Optional[str],
            "notes": str
        }
    """
    # A) FIX INPUT FIELD MAPPING
    question_text = question.get("question_text", "").strip()
    subtype_code = question.get("discipline_subtype_code", "").strip()
    dimension = question.get("capability_dimension", "").strip().upper()
    legacy_code = question.get("element_code", "").strip()
    legacy_id = question.get("element_id", "") or question.get("element_code", "")
    
    reason_codes: List[ReasonCode] = []
    outcome: Optional[Outcome] = None
    rewrite_template: Optional[str] = None
    proposed_rewrite: Optional[str] = None
    notes = ""
    
    # INT_SPINE_ALLOWLIST_EARLY_GATE
    # Baseline canon decision: INT has exactly ONE spine boundary:
    #   INT_ACCESS_RESTRICTED_AREAS (SYSTEMS dimension only)
    # All other INT items are implementation depth (even if SYSTEMS, even if same subtype with different dimension) and must not become spines.
    # This must execute BEFORE any template-based REWRITE logic.
    if subtype_code.startswith("INT_"):
        if subtype_code != "INT_ACCESS_RESTRICTED_AREAS" or dimension != "SYSTEMS":
            return {
                "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
                "reason_codes": [],
                "rewrite_template": None,
                "proposed_rewrite": None,
                "notes": "INT subtype is depth; only INT_ACCESS_RESTRICTED_AREAS (SYSTEMS) is allowed as a baseline spine"
            }
    
    # FAC_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: FAC legacy SYSTEMS subtypes are solution artifacts (film/glazing/blast/ballistic/etc.).
    # They must not become baseline spines. Route all FAC_* to component checklist.
    # FAC baseline spines are authored canonically, not from legacy subtype inventory.
    if subtype_code.startswith("FAC_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "FAC subtype is solution-artifact depth; FAC baseline spines are authored canonically, not from legacy subtype inventory"
        }
    
    # KEY_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: KEY legacy subtypes describe implementation depth (cabinets/logs/master/rekey/restricted).
    # They must not become baseline spines. Route all KEY_* to component checklist.
    # KEY baseline spine is authored canonically, not from legacy subtype inventory.
    if subtype_code.startswith("KEY_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "KEY subtype is component depth; KEY baseline spine is authored canonically"
        }
    
    # COM_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: COM legacy subtypes describe implementation choices (radios/PA/paging/interoperable/backup/protocols).
    # They must not become baseline spines. Route all COM_* to component checklist.
    # COM baseline spines are authored canonically, not from legacy subtype inventory.
    if subtype_code.startswith("COM_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "COM subtype is component depth; COM baseline spines are authored canonically"
        }
    
    # EAP_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: EAP legacy items are procedural depth (plans/procedures/drills/assurance) and must not become spines.
    # Route all EAP_* to component checklist. EAP baseline spines are authored canonically.
    if subtype_code.startswith("EAP_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "EAP subtype is component depth; EAP baseline spines are authored canonically"
        }
    
    # EMR_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: EMR legacy items are procedural/assurance depth (plans, procedures, drills, continuity details) and must not become spines.
    # Route all EMR_* to component checklist. EMR baseline spines are authored canonically.
    if subtype_code.startswith("EMR_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "EMR subtype is component depth; EMR baseline spines are authored canonically"
        }
    
    # ISC_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: ISC legacy items are procedural/assurance depth (plans, procedures, liaisons, agreements) and must not become spines.
    # Route all ISC_* to component checklist. ISC baseline spines are authored canonically.
    if subtype_code.startswith("ISC_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "ISC subtype is component depth; ISC baseline spines are authored canonically"
        }
    
    # SFO_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: SFO legacy items are operational/procedural depth (staffing, patrol tactics, response details, assurance) and must not become spines.
    # Route all SFO_* to component checklist. SFO baseline spines are authored canonically.
    if subtype_code.startswith("SFO_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "SFO subtype is component depth; SFO baseline spines are authored canonically"
        }
    
    # SMG_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: SMG baseline spines are authored canonically.
    # Legacy SMG_* items are depth and must not become spines. Route SMG_* to component checklist.
    if subtype_code.startswith("SMG_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "SMG legacy subtype is component depth; SMG baseline spines are authored canonically"
        }
    
    # CPTED_SPINE_EXCLUSION_EARLY_GATE
    # Baseline canon decision: CPTED legacy items are design/implementation depth and frequently drift into subjective quality claims.
    # Route all CPTED_* to component checklist. CPTED baseline spines are authored canonically.
    if subtype_code.startswith("CPTED_"):
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "CPTED subtype is component depth; CPTED baseline spines are authored canonically"
        }
    
    # Fail-closed: Missing required fields
    if not subtype_code or not question_text:
        return {
            "outcome": Outcome.DROP.value,
            "reason_codes": [ReasonCode.SUBJECTIVE_JUDGMENT_REQUIRED.value],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "Missing required subtype_code or question_text"
        }
    
    # PER_NON_SYSTEMS_TO_COMPONENT: Perimeter assurance/maintenance/activation checks are component depth, not baseline spines.
    # Only SYSTEMS dimension questions can be baseline spine candidates for PER.
    if subtype_code.startswith("PER_") and dimension != "SYSTEMS":
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "PER non-SYSTEMS dimension routed to component checklist (depth, not spine)"
        }
    
    # ACS_NON_SYSTEMS_TO_COMPONENT: Access control assurance/maintenance/activation checks are component depth, not baseline spines.
    # Only SYSTEMS dimension questions can be baseline spine candidates for ACS.
    if subtype_code.startswith("ACS_") and dimension != "SYSTEMS":
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "ACS non-SYSTEMS dimension routed to component checklist (depth, not spine)"
        }
    
    # IDS_NON_SYSTEMS_TO_COMPONENT: IDS assurance/testing/procedures/etc. are component depth, not baseline spines.
    # Only SYSTEMS dimension questions can be baseline spine candidates for IDS.
    if subtype_code.startswith("IDS_") and dimension != "SYSTEMS":
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "IDS non-SYSTEMS dimension routed to component checklist (depth, not spine)"
        }
    
    # VSS_ANALYTICS_EXCLUDED_FROM_BASELINE: Video analytics are solution features, excluded from baseline canon
    if subtype_code.startswith("VSS_ANALYTICS"):
        return {
            "outcome": Outcome.DROP.value,
            "reason_codes": [ReasonCode.SOLUTION_ARTIFACT_IN_QUESTION.value],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "Video analytics are solution features and excluded from baseline canon"
        }
    
    # VSS_SYSTEMS_NON_SPINE_TO_COMPONENT: Only 3 VSS subtypes are allowed as baseline spines
    # All other VSS SYSTEMS subtypes are depth, not baseline spines
    ALLOWED_VSS_SPINES = {"VSS_EXTERIOR_CAMERAS", "VSS_INTERIOR_CAMERAS", "VSS_RECORDING_STORAGE_NVR_DVR"}
    if subtype_code.startswith("VSS_") and dimension == "SYSTEMS":
        if subtype_code not in ALLOWED_VSS_SPINES:
            return {
                "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
                "reason_codes": [],
                "rewrite_template": None,
                "proposed_rewrite": None,
                "notes": "VSS SYSTEMS subtype is depth, not an allowed baseline spine"
            }
    
    # VSS_NON_SYSTEMS_TO_COMPONENT: VSS procedures/assurance/retention configs/etc. are component depth, not baseline spines.
    # Only SYSTEMS dimension questions can be baseline spine candidates for VSS.
    if subtype_code.startswith("VSS_") and dimension != "SYSTEMS":
        return {
            "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
            "reason_codes": [],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "VSS non-SYSTEMS dimension routed to component checklist (depth, not spine)"
        }
    
    
    
    
    # C) CAPABILITY_DIMENSION-DRIVEN ROUTING (BEFORE forbidden patterns)
    
    # 1) GOVERNANCE / ROLES / RESPONSIBILITY
    if dimension in {"ROLES", "RESPONSIBILITY", "GOVERNANCE", "PERSONNEL_RESPONSIBILITY"}:
        return {
            "outcome": Outcome.MOVE_TO_SMG.value,
            "reason_codes": [ReasonCode.SUBTYPE_LEVEL_ROLES_QUESTION.value],
            "rewrite_template": None,
            "proposed_rewrite": None,
            "notes": "Governance/roles belong in SMG, not per-subtype"
        }
    
    # 2) PROCEDURES / PLANS / TRAINING / EXERCISES / LOGS / RECORDS
    if dimension in {"PLANS", "PROCEDURES", "PLANS_PROCEDURES", "TRAINING", "EXERCISES", "LOGS", "RECORDS"}:
        # Check if subtype prefix is procedural
        subtype_prefix = subtype_code.split("_")[0] if "_" in subtype_code else subtype_code[:3]
        if subtype_prefix in PROCEDURAL_DISCIPLINE_PREFIXES:
            return {
                "outcome": Outcome.REWRITE_TO_CONTROL_ASSERTION.value,
                "reason_codes": [],
                "rewrite_template": None,
                "proposed_rewrite": None,
                "notes": "Procedural existence question allowed for this discipline"
            }
        else:
            return {
                "outcome": Outcome.MOVE_TO_SMG.value,
                "reason_codes": [ReasonCode.SUBTYPE_LEVEL_PROCEDURE_QUESTION.value],
                "rewrite_template": None,
                "proposed_rewrite": None,
                "notes": "Procedural detail moved to SMG"
            }
    
    # 3) SYSTEMS (continue to forbidden-pattern analysis)
    # Only process SYSTEMS dimension through forbidden patterns
    
    # E) MOVE_TO_COMPONENT_CHECKLIST detection (before forbidden patterns)
    if detect_component_depth(question_text):
        # Check if subtype has a rewrite template
        if subtype_code in REWRITE_TEMPLATES:
            return {
                "outcome": Outcome.MOVE_TO_COMPONENT_CHECKLIST.value,
                "reason_codes": [],
                "rewrite_template": None,
                "proposed_rewrite": None,
                "notes": "Detail belongs as component depth, not baseline spine"
            }
    
    # D) FORBIDDEN PATTERN HANDLING (only for SYSTEMS dimension)
    forbidden = detect_forbidden_patterns(question_text)
    if forbidden:
        reason_codes.extend(forbidden)
        
        # Determine outcome based on forbidden pattern type
        if ReasonCode.FORBIDDEN_PHRASE_BASIC_FUNCTION in forbidden:
            # Try to rewrite using template
            if subtype_code in REWRITE_TEMPLATES:
                outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
                rewrite_template = REWRITE_TEMPLATES[subtype_code]
                proposed_rewrite = rewrite_template
                notes = "Contains 'basic function' pattern; rewritten to control assertion"
            else:
                outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
                notes = "Contains 'basic function' pattern; needs manual rewrite (no template)"
        
        elif ReasonCode.FORBIDDEN_QUALITY_ADJECTIVE in forbidden:
            # Try to rewrite
            if subtype_code in REWRITE_TEMPLATES:
                outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
                rewrite_template = REWRITE_TEMPLATES[subtype_code]
                proposed_rewrite = rewrite_template
                notes = "Contains quality adjective; rewritten to control assertion"
            else:
                outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
                notes = "Contains quality adjective; needs manual rewrite (no template)"
        
        elif ReasonCode.SOLUTION_ARTIFACT_IN_QUESTION in forbidden:
            # Try to rewrite if template exists
            if subtype_code in REWRITE_TEMPLATES:
                outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
                rewrite_template = REWRITE_TEMPLATES[subtype_code]
                proposed_rewrite = rewrite_template
                notes = "Contains solution artifact; rewritten to control assertion"
            else:
                outcome = Outcome.DROP
                notes = "Solution artifact with no control-assertion template"
                return {
                    "outcome": outcome.value,
                    "reason_codes": [rc.value for rc in reason_codes],
                    "rewrite_template": None,
                    "proposed_rewrite": None,
                    "notes": notes
                }
    
    # Check for sector/subsector context (if not already classified)
    if outcome is None and detect_sector_context(question_text):
        outcome = Outcome.MOVE_TO_EXPANSION
        reason_codes.append(ReasonCode.SECTOR_SUBSECTOR_CONTEXT_REQUIRED)
        notes = "Question requires sector/subsector context; belongs in expansion layer"
    
    # F) BOUNDARY DETECTION (only if not already classified)
    if outcome is None:
        boundary_indicators = [
            r"\bat\s+",
            r"\bdoor\b",
            r"\bgate\b",
            r"\bentry\b",
            r"\bexit\b",
            r"\bperimeter\b",
            r"\bfence\b",
            r"\blobby\b",
            r"\bcorridor\b",
            r"\bparking\b",
            r"\bloading\s+dock\b",
            r"\brestricted\s+area\b",
            r"\bsecure\s+area\b",
            r"\bcritical\s+area\b",
            r"\binterior\b",
            r"\bexterior\b",
            r"\bentry\s+point\b",
            r"\bdesignated\s+area\b",
            r"\bcontrolled\s+area\b",
        ]
        has_boundary = any(re.search(indicator, question_text, re.IGNORECASE) for indicator in boundary_indicators)
        
        if not has_boundary:
            reason_codes.append(ReasonCode.UNANCHORED_NO_BOUNDARY)
            # Try to rewrite with boundary if template exists
            if subtype_code in REWRITE_TEMPLATES:
                outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
                rewrite_template = REWRITE_TEMPLATES[subtype_code]
                proposed_rewrite = rewrite_template
                notes = "Unanchored question; rewritten with boundary anchor"
            else:
                outcome = Outcome.DROP
                notes = "No boundary and no rewrite template"
                return {
                    "outcome": outcome.value,
                    "reason_codes": [rc.value for rc in reason_codes],
                    "rewrite_template": None,
                    "proposed_rewrite": None,
                    "notes": notes
                }
    
    # G) FAIL-CLOSED DEFAULT (no auto-rewrite)
    if outcome is None:
        # Try template if available, but don't auto-rewrite
        if subtype_code in REWRITE_TEMPLATES:
            outcome = Outcome.REWRITE_TO_CONTROL_ASSERTION
            rewrite_template = REWRITE_TEMPLATES[subtype_code]
            proposed_rewrite = rewrite_template
            notes = "Template available for rewrite"
        else:
            outcome = Outcome.DROP
            reason_codes.append(ReasonCode.SUBJECTIVE_JUDGMENT_REQUIRED)
            notes = "No rule or template applies"
    
    # Check for duplicates in canon (if canon provided)
    if canon_spines and outcome == Outcome.REWRITE_TO_CONTROL_ASSERTION:
        canon_questions = [c.get("question", "") or c.get("question_text", "") for c in canon_spines]
        if proposed_rewrite and proposed_rewrite in canon_questions:
            reason_codes.append(ReasonCode.DUPLICATE_OF_CANON_SPINE)
            notes += " (duplicate of existing canon spine)"
    
    # Build result record
    record = {
        "outcome": outcome.value,
        "reason_codes": [rc.value for rc in reason_codes],
        "rewrite_template": rewrite_template,
        "proposed_rewrite": proposed_rewrite,
        "notes": notes
    }
    
    # Attach lint results
    record = _attach_lint(record, require_boundary=True)
    
    # LINT FAIL-CLOSED: if we propose a baseline spine rewrite but the text fails lint, drop it.
    # Tag so downstream review sees why it was blocked.
    if record.get("outcome") == Outcome.REWRITE_TO_CONTROL_ASSERTION.value:
        lint = record.get("lint") or {}
        if lint.get("ok") is False:
            record["reason_codes"] = record.get("reason_codes", []) + ["LINT_FAIL_REWRITE_TO_DROP"]
            record["notes"] = (record.get("notes") or "") + " | Lint failed; rewrite dropped (fail-closed)."
            record["outcome"] = Outcome.DROP.value
    
    return record

def load_input_json(input_path: Path) -> List[Dict[str, Any]]:
    """Load questions from JSON file, supporting multiple patterns."""
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Pattern A: { "required_elements": [...] } (baseline_questions_registry_v2.json)
    if isinstance(data, dict) and "required_elements" in data:
        return data["required_elements"]
    
    # Pattern B: { "items": [...] }
    if isinstance(data, dict) and "items" in data:
        return data["items"]
    
    # Pattern C: [...]
    if isinstance(data, list):
        return data
    
    raise ValueError(f"Unsupported JSON structure in {input_path}")

def load_canon_spines(canon_path: Optional[Path] = None) -> Optional[List[Dict[str, Any]]]:
    """Load canon spines if available."""
    if canon_path is None:
        # Try default location
        canon_path = Path(__file__).parent.parent / "doctrine" / "baseline_canon" / "baseline_spines.v1.json"
    
    if canon_path.exists():
        with open(canon_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and "items" in data:
                return data["items"]
            elif isinstance(data, list):
                return data
    return None

def main():
    parser = argparse.ArgumentParser(
        description="Analyze legacy baseline questions for refactoring",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--input_json',
        type=str,
        default='analytics/runtime/baseline_questions_registry_v2.json',
        help='Path to input JSON file (default: analytics/runtime/baseline_questions_registry_v2.json)'
    )
    parser.add_argument(
        '--out_dir',
        type=str,
        default='analytics/reports',
        help='Output directory for reports (default: analytics/reports)'
    )
    parser.add_argument(
        '--canon_json',
        type=str,
        help='Path to canon spines JSON (optional, for duplicate detection)'
    )
    
    args = parser.parse_args()
    
    # Resolve paths
    # If input_json is relative, resolve from current working directory first, then try project root
    input_path = Path(args.input_json)
    if not input_path.is_absolute():
        if input_path.exists():
            input_path = input_path.resolve()
        else:
            # Try relative to project root
            project_root = Path(__file__).parent.parent.parent
            input_path = (project_root / args.input_json).resolve()
    
    # Output directory
    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        project_root = Path(__file__).parent.parent.parent
        out_dir = (project_root / args.out_dir).resolve()
    
    canon_path = Path(args.canon_json).resolve() if args.canon_json else None
    
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    print("=" * 80)
    print("Legacy Baseline Question Analyzer")
    print("=" * 80)
    print(f"Input file: {input_path}")
    
    # Load input
    try:
        questions = load_input_json(input_path)
        print(f"Total items loaded: {len(questions)}")
    except Exception as e:
        print(f"ERROR: Failed to load input file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Load canon (optional)
    canon_spines = None
    if canon_path:
        canon_spines = load_canon_spines(canon_path)
        if canon_spines:
            print(f"Canon spines loaded: {len(canon_spines)} items")
    
    # Classify all questions
    results = []
    for question in questions:
        # Extract fields using correct schema
        legacy_id = question.get("element_id", "") or question.get("element_code", "")
        legacy_code = question.get("element_code", "")
        discipline_name = question.get("discipline_name", "")
        subtype_code = question.get("discipline_subtype_code", "")
        question_text = question.get("question_text", "")
        dimension = question.get("capability_dimension", "")
        
        classification = classify_question(question, canon_spines)
        
        results.append({
            "legacy_id": legacy_id,
            "legacy_code": legacy_code,
            "discipline_name": discipline_name,
            "discipline_subtype_code": subtype_code,
            "capability_dimension": dimension,
            "question": question_text,
            **classification
        })
    
    # Count outcomes
    outcome_counts = {}
    for result in results:
        outcome = result["outcome"]
        outcome_counts[outcome] = outcome_counts.get(outcome, 0) + 1
    
    print("\nClassification Summary:")
    for outcome, count in sorted(outcome_counts.items()):
        print(f"  {outcome}: {count}")
    
    # Create output directory
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Write main refactor map
    refactor_map = {
        "summary": outcome_counts,
        "items": results
    }
    refactor_map_path = out_dir / "legacy_baseline_refactor_map.json"
    with open(refactor_map_path, 'w', encoding='utf-8') as f:
        json.dump(refactor_map, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Refactor map written: {refactor_map_path}")
    
    # Write outcome-specific files
    outcome_files = {
        Outcome.DROP: "legacy_baseline_drop_list.json",
        Outcome.MOVE_TO_SMG: "legacy_baseline_move_to_smg.json",
        Outcome.MOVE_TO_COMPONENT_CHECKLIST: "legacy_baseline_move_to_component.json",
        Outcome.MOVE_TO_EXPANSION: "legacy_baseline_move_to_expansion.json",
        Outcome.REWRITE_TO_CONTROL_ASSERTION: "legacy_baseline_rewrite_candidates.json",
    }
    
    for outcome, filename in outcome_files.items():
        filtered = [r for r in results if r["outcome"] == outcome.value]
        if filtered:
            output_data = {"items": filtered}
            output_path = out_dir / filename
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"✓ {filename}: {len(filtered)} items")
    
    print("\n✅ Analysis complete")
    sys.exit(0)

if __name__ == '__main__':
    main()
