# PLAN Mode Assessment Model (Authoritative)

**Scope:** PLAN mode only. PSA scope only: physical security, governance, planning, operations. No regulatory language, no cyber controls, no costs, no timelines, no technologies. Formulaic plan assumption: all plan sections apply.

---

## I. Core Structure

PLAN mode uses a three-level structure:

```
Capability (Parent)
└── Checklist Items (atomic conditions)
    └── OFCs (attached ONLY to unchecked items)
```

- **Capability** = a required plan section / criterion (e.g., Emergency Communications).
- **Checklist item** = a binary condition that defines whether part of the capability exists.
- **OFC** = an option for consideration describing WHAT capability should exist to close a gap.

---

## II. Capability (Parent) Rules

**Capability properties:**
- `capability_state`: `"PRESENT"` | `"ABSENT"`
- Capabilities **NEVER** have N/A.
- Capabilities **NEVER** have OFCs attached directly.

**Capability meaning:**
- **PRESENT** = the plan element exists in some form.
- **ABSENT** = the plan element does not exist at all.

**Roll-up status (computed):**
- ABSENT → `"ABSENT"`
- PRESENT + 100% checklist checked → `"COMPLETE"`
- PRESENT + >0% and <100% checked → `"PARTIAL"`
- PRESENT + 0% checked → `"DEFICIENT"`

---

## III. Checklist Item Rules

**Checklist item properties:**
- Binary only: checked / unchecked
- Declarative statements (NOT questions)
- No conjunctions bundling multiple actions
- Each item represents ONE atomic requirement

Checklist item MAY be marked N/A only in rare, context-specific cases.
- N/A checklist items do not count toward completion ratio.
- N/A is **NEVER** allowed at the capability level.

---

## IV. Rationale (Mandatory)

Every checklist item **MUST** include a rationale field.

**Rationale requirements:**
- 1–2 sentences
- Explains: why this element exists; what function it serves during an incident
- Outcome-oriented language only
- No instructions, no “how to”, no steps
- No “should”, “must”, “best practice”, or regulatory references

Rationale is ALWAYS visible in UI and reports.

---

## V. OFC Attachment (Critical Rule)

OFCs **MUST** be attached **ONLY** to unchecked checklist items.

| Condition | OFCs |
|-----------|------|
| Checked checklist item | NO OFCs |
| Unchecked checklist item | OFCs REQUIRED |
| Parent capability | NEVER has OFCs |

**OFC requirements:**
- 1–3 OFCs per unchecked item (cap at 3)
- Describe WHAT capability should exist
- No HOW, no steps, no implementation detail
- No technologies, vendors, costs, timelines, or priorities
- PSA-scope language only

---

## VI. Cascade Control (Absent Capability)

When `capability_state = "ABSENT"`:

- All checklist items are auto-set: `checked = false`, `derived_unchecked = true`
- OFCs **MUST** still be generated and attached to EACH checklist item.

**UI / reporting behavior:**
- Checklist items are collapsed/suppressed by default.
- Parent shows ONE grouped finding: *“Capability is absent; all required elements are missing by default.”*
- Expand control reveals item-level checklist items + OFCs.
- Items remain individually traceable but do NOT spam findings by default.

---

## VII. Partial / Incomplete Scoring

Partial scoring is enabled **ONLY** when `capability_state = "PRESENT"`.

**Computation:**
- `completion_ratio = checked_items / applicable_items`
- Roll-up status determined strictly by ratio (see Section II).

Unchecked items in PARTIAL or DEFICIENT states: generate item-level OFCs normally. No aggregation or duplication at parent level.

---

## VIII. Generation Rules (PLAN Mode)

Generator **MUST**:
- Derive capabilities from plan criteria/sections.
- Generate: 1 capability per criterion; 3–8 checklist items per capability; mandatory rationale per checklist item.
- Never generate compound checklist items.
- Never generate parent-level OFCs.
- Never output unchecked items without OFCs.

If generation cannot produce checklist + rationale + OFCs: **FAIL HARD** with diagnostic error. Do **NOT** fall back to generic questions.

---

## IX. Quality Gates (Hard Failures)

Reject generation or apply if **ANY** of the following occur:

- Capability has N/A
- Parent capability has OFCs
- Checked checklist item has OFCs
- Unchecked checklist item has zero OFCs
- Checklist item lacks rationale
- Rationale includes instructional or regulatory language
- Checklist items are questions or compound statements

---

## X. End State

PLAN mode produces:
- Deterministic, formula-aligned assessments
- Binary, defensible checklist evaluation
- Precise, item-level OFCs
- Controlled cascade when capabilities are absent
- Clear partial vs deficient vs absent scoring
- Reports that read like professional plan gap analyses

**This model is authoritative.**
