import re
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional

# Baseline-safe: boundary-anchored control assertions, not inventory or quality claims.

SUBJECTIVE_TERMS = [
    r"\beffective\b", r"\badequate\b", r"\bsufficient\b", r"\bappropriate\b", r"\bproper\b",
    r"\bbasic function\b", r"\bwork(s)? as intended\b", r"\boperate(s)? correctly\b",
    r"\bgood condition\b", r"\bwell maintained\b", r"\bmeets requirements\b"
]

SOLUTION_ARTIFACT_TERMS = [
    r"\binstall(ed|ation)?\b", r"\bimplement(ed|ation)?\b", r"\bupgrade(d)?\b", r"\breplace(d)?\b",
    r"\badd(ed)?\b", r"\bdeploy(ed|ment)?\b", r"\bretrofit(ted)?\b"
]

INVENTORY_PATTERNS = [
    r"^are .* (installed|present|available)\b",
    r"^do .* (exist|work|function)\b",
    r"^are there\b",
]

COMPOUND_MARKERS = [r"\band\b", r"\bor\b", r"/", r";", r","]

ALLOWED_CONTROL_VERBS = [
    "controlled", "restricted", "authorized", "monitored", "recorded", "alarmed",
    "secured", "identified", "managed", "verified", "screened", "validated"
]

BOUNDARY_MARKERS = [
    # Keep this simple and broad; PER/VSS/ACS etc will refine via templates.
    "perimeter", "boundary", "entry", "entry point", "access point", "gate", "door",
    "vehicle", "pedestrian", "site", "property line", "fence line", "checkpoint",
    "loading", "delivery", "dock", "parking",
    # IDS boundary markers
    "monitoring point", "alarm monitoring", "detection zone", "detection zones",
    "protected area", "protected areas", "monitored area", "monitored areas",
    "alarm receiving", "central station",
    # VSS boundary markers
    "camera", "cameras", "camera coverage", "field of view", "viewing area",
    "observed area", "monitored area", "recorded area", "recorded areas",
    "monitoring station", "security operations center", "soc",
    "video monitoring", "video management", "recording", "live view",
    # INT boundary markers (interior barrier concepts)
    "interior",
    "internal",
    "restricted area",
    "restricted areas",
    "controlled area",
    "controlled areas",
    "secure area",
    "secure areas",
    "corridor",
    "hallway",
    "stairwell",
    "elevator",
    "lobby",
    "mantrap",
    "turnstile",
    "portal",
    "security vestibule",
    "interior barrier",
    "interior barriers",
    "barrier",
    "partition",
    # FAC boundary markers (facility hardening concepts)
    "areas requiring protection",
    "area requiring protection",
    "openings requiring protection",
    "opening requiring protection",
    "entry points requiring protection",
    "entry point requiring protection",
    "exterior walls",
    "exterior wall",
    "structural hardening",
    "blast mitigation",
    "ballistic barriers",
    "ballistic barrier",
    "impact-resistant glazing",
    "window film",
    # KEY boundary markers (key control concepts)
    "key",
    "keys",
    "key control",
    "key management",
    "key cabinet",
    "key safe",
    "key box",
    "key ring",
    "key inventory",
    "key issuance",
    "key issue",
    "key return",
    "key retrieval",
    "restricted key",
    "master key",
    "lock",
    "locks",
    "core",
    "rekey",
    "keyed",
    "keying",
    # COM boundary markers (communications concepts)
    "communications",
    "communication",
    "radio",
    "radios",
    "portable radio",
    "base station",
    "dispatch",
    "dispatch center",
    "operations center",
    "security operations center",
    "soc",
    "intercom",
    "public address",
    "pa system",
    "mass notification",
    "phone",
    "phones",
    "hotline",
    "panic",
    "duress",
    "call box",
    "emergency phone",
]

@dataclass
class LintResult:
    ok: bool
    severity: str              # "PASS" | "FAIL"
    reason_codes: List[str]
    notes: List[str]
    normalized: str

def _normalize(text: str) -> str:
    t = (text or "").strip()
    t = re.sub(r"\s+", " ", t)
    # remove double spaces around punctuation
    t = re.sub(r"\s+([?.!,;:])", r"\1", t)
    return t

def _has_duplicate_tokens(text: str) -> bool:
    toks = re.findall(r"[A-Za-z0-9]+", (text or "").lower())
    for i in range(1, len(toks)):
        if toks[i] == toks[i-1]:
            return True
    return False

def _has_boundary_anchor(text: str) -> bool:
    t = (text or "").lower()
    return any(m in t for m in BOUNDARY_MARKERS)

def _has_control_verb(text: str) -> bool:
    t = (text or "").lower()
    return any(v in t for v in ALLOWED_CONTROL_VERBS)

def lint_question(text: str, *, require_boundary: bool = True) -> Dict[str, Any]:
    raw = text or ""
    t = _normalize(raw)
    tl = t.lower()

    reason_codes: List[str] = []
    notes: List[str] = []

    if not t:
        return asdict(LintResult(False, "FAIL", ["EMPTY_TEXT"], ["Missing question text"], t))

    # Must look like a yes/no question
    if not re.match(r"^(are|is|do|does|has|have|can)\b", tl):
        reason_codes.append("NOT_YESNO_FORM")
        notes.append("Question does not start with a YES/NO auxiliary verb.")

    # Avoid ambiguous pronouns without antecedent (rough heuristic)
    if re.search(r"\b(it|they|their|them|this|that)\b", tl) and not re.search(r"\b(access|entry|perimeter|boundary|gate|door|point|area|site)\b", tl):
        reason_codes.append("AMBIGUOUS_PRONOUN")
        notes.append("Contains pronouns that may be ambiguous without a clear boundary noun.")

    # Block subjective / quality language
    for pat in SUBJECTIVE_TERMS:
        if re.search(pat, tl):
            reason_codes.append("SUBJECTIVE_QUALITY_LANGUAGE")
            notes.append(f"Contains subjective/quality phrase matching: {pat}")
            break

    # Block solution artifacts in questions (baseline questions must not prescribe)
    for pat in SOLUTION_ARTIFACT_TERMS:
        if re.search(pat, tl):
            reason_codes.append("SOLUTION_ARTIFACT_IN_QUESTION")
            notes.append(f"Contains solution/artifact verb matching: {pat}")
            break

    # Inventory phrasing is not a baseline spine (may be rewritten elsewhere)
    for pat in INVENTORY_PATTERNS:
        if re.search(pat, tl):
            reason_codes.append("INVENTORY_PHRASE")
            notes.append("Reads like inventory/presence rather than a control assertion.")
            break

    # Compound / multi-clause risk (baseline spines should be single-meaning)
    # Allow "and" only if it's in a tight phrase like "identified and controlled" (special-case)
    if any(re.search(m, tl) for m in COMPOUND_MARKERS):
        if "identified and controlled" not in tl:
            # if there's more than one marker, fail harder
            marker_count = sum(1 for m in COMPOUND_MARKERS if re.search(m, tl))
            if marker_count >= 2 or re.search(r"\b(or|and)\b", tl):
                reason_codes.append("COMPOUND_OR_AMBIGUOUS")
                notes.append("Contains compound markers; spine questions should be single-meaning.")

    # Duplicate tokens like "barriers barriers"
    if _has_duplicate_tokens(t):
        reason_codes.append("DUPLICATE_TOKENS")
        notes.append("Contains repeated consecutive tokens (likely generated garbage).")

    # "systems" stapling smell: "gates systems", "clear zones systems"
    if re.search(r"\b(systems)\b", tl) and re.search(r"\b(gates|fencing|signage|bollards|barriers|zones)\s+systems\b", tl):
        reason_codes.append("SYSTEMS_STAPLING")
        notes.append("Detected 'systems' stapled to a noun phrase; likely needs rewrite.")

    # Boundary anchor required for baseline spines
    if require_boundary and not _has_boundary_anchor(t):
        reason_codes.append("NO_BOUNDARY_ANCHOR")
        notes.append("Missing boundary anchor indicators (where the control applies).")

    # Control verb required for baseline spines (control assertion)
    if not _has_control_verb(t):
        reason_codes.append("NO_CONTROL_VERB")
        notes.append("Missing an allowed control verb (e.g., controlled/restricted/monitored/secured).")

    ok = len(reason_codes) == 0
    return asdict(LintResult(ok, "PASS" if ok else "FAIL", reason_codes, notes, t))
