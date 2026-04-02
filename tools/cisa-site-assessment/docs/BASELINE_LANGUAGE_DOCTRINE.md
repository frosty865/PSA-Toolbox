# Baseline language doctrine

## Purpose of baseline questions

Baseline questions test **existence only** (YES / NO / N/A). They answer: *Does this exist at the facility?* They do not measure quality, adequacy, effectiveness, or performance.

**Baseline questions describe existence. Quality, adequacy, and effectiveness belong in OFCs or overlays.**

---

## Approved language patterns by discipline

Doctrine provides **guidance**, not new requirements. Use discipline patterns to remove abstraction and align wording; do not expand scope.

| Discipline | Default verb phrase | Noun handling | Example |
|------------|---------------------|---------------|---------|
| **ACS** | used to control access | system_or_process | Are door readers used to control access to designated areas? |
| **IDS** | used to detect or monitor | detection_system | Is intrusion detection used to monitor the facility perimeter? |
| **INT** | used to restrict movement or provide protected space | physical_space_or_barrier | Are there designated secure rooms within the facility? |
| **PER** | used to define or protect the perimeter | boundary_or_barrier | Is perimeter fencing used to define the facility boundary? |
| **COM** | used to communicate or notify | communication_method | Is there a way for staff to communicate during incidents? |
| **ISC** | identified for coordination or support | relationship_or_point | Are external coordination points identified for security or emergency support? |

- Do **not** introduce "designated" (or "identified") unless the original text or intent already uses it.
- Keep common operational terms when present (e.g. "shelter in place", "lockdown", "evacuation").
- Language must remain **sector-neutral** (no students, patients, family, guardians unless explicitly in intent).

---

## Forbidden language

- **Abstractions:** capability, implemented, operationalized, programmatic  
- **Checklist phrasing:** including but not limited to, such as, e.g.  
- **Sector assumptions:** students, patients, family, guardians (unless explicitly in intent source)  
- **Quality/performance:** adequate, effective, sufficient; do not convert existence → performance  
- **Scope creep:** Do not add duration, signage, equipment lists, staffing, or procedures unless the intent explicitly requires them as existence criteria.

---

## Good vs bad baseline questions

### Good (existence-only, plain language)

- Are door readers used to control access to designated areas?
- Is there a way for staff to communicate during incidents?
- Are rekeying procedures utilized?
- Is there an established process to change locks and keys when control is lost?

### Bad (abstract, checklist, or scope creep)

- Is a Biometric Access **capability** **implemented**?  
  → Use: Is biometric access in place? / Is biometric access used to control access?
- Are there **adequate** procedures for…  
  → Baseline does not assess adequacy.
- **Including but not limited to** signage and radios…  
  → No checklist language in baseline.
- Are **students** and **guardians** notified?  
  → Sector-specific unless intent explicitly names them.

---

## Enforcement

- The rewrite engine applies doctrine when `intent_source === "fallback"` and a subtype is present.
- **validateBaselineQuestionLanguage()** runs before write-back and migrations; it throws on violation so regressions are blocked.
- New subtype additions should use the same patterns; the doctrine file and validation guard keep wording consistent.
