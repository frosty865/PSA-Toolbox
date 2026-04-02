# Cursor Output Contract — Baseline Canon Buildout (Rigid)

This contract governs ALL Cursor outputs for PSA Baseline Canon work. If any instruction conflicts with a user request, the contract wins unless the user explicitly overrides it.

## 0) Response Format (MANDATORY)
1. When asked to implement anything: output **exactly one** Cursor-compatible code block and nothing else.
2. The block must be runnable end-to-end (PowerShell/bash as requested), with all file paths explicit.
3. No commentary inside the block except short inline comments that explain intent and constraints.
4. Never emit partial edits. Either:
   - complete the change, or
   - refuse with an explicit failure condition and an exact next step.

## 1) Baseline Canon Core Rules (NON-NEGOTIABLE)
1. Baseline is universal. No sector/subsector/event logic.
2. All baseline questions are: `response_enum = ["YES","NO","N_A"]`
3. Baseline questions are **boundary-anchored control assertions**:
   - Answer: "Where is a security decision made, and what is controlled?"
4. Baseline questions must NOT include:
   - performance/assurance language ("effective", "adequate", "perform basic function", "continue if fails")
   - solution artifacts ("window film", "impact-resistant glazing", "analytics", "NVR/DVR", brands/models/specs)
   - checklists, inventories, or quality checks
5. Depth lives in components, not additional baseline spines.

## 2) Key Doctrine Distinction (MANDATORY)
- **Lint PASS** means "grammatically answerable and non-ambiguous."
- **Lint PASS does NOT mean** "eligible as a baseline spine."
- Baseline spine eligibility is a separate doctrine gate.

## 3) Spine Count Discipline (MANDATORY)
For each discipline, Cursor must enforce:
1. Default baseline spines per discipline: **1–3** maximum.
2. Any proposal above 3 spines is automatically rejected unless the user explicitly authorizes it.

## 4) Solution Artifact Exclusion (HARD RULE)
If a proposed baseline spine contains a solution artifact term (examples):
- FAC: ballistic, blast, glazing, window film
- VSS: analytics, behavior detection, facial recognition
- IDS: model-specific sensors, exact specs
Then:
- It MUST be routed to `MOVE_TO_COMPONENT_CHECKLIST` or `DROP`
- It MUST NOT become a baseline spine

## 5) Analyzer Output Review Process (LOCKED WORKFLOW)
Work order is always: **REVIEW → AUTHOR → IMPORT**

### 5.1 REVIEW (required before authoring)
For each discipline:
1. Generate packets.
2. Summarize counts (REWRITE/COMPONENT/DROP/FAIL_CLOSED).
3. Identify:
   - true boundary candidates
   - solution artifacts
   - non-universal/special-case items
4. Produce a "spine decision list":
   - SURVIVE (spine)
   - COMPONENT (depth)
   - DROP (never comes back)

No analyzer changes are allowed until the spine decision list is explicit.

### 5.2 AUTHOR (canon writing rules)
1. Write spines as canonical artifacts in `psa_engine/doctrine/baseline_canon/spines/`.
2. Write component manifests in `.../components/`.
3. Write constraints in `.../constraints/`.
4. Canon spines must be stable, minimal, boundary-focused.

### 5.3 IMPORT
Only after spines + constraints exist and are locked:
- proceed to generate runtime import input
- never mutate legacy baseline tables directly

## 6) Gating Pattern (MANDATORY FOR DRIFT CONTROL)
Cursor must implement **early gates** (before template matching) to prevent checklist creep:
- VSS: allowlist exactly 3 spines (exterior, interior, recording)
- INT: allowlist exactly 1 spine (restricted areas controlled at entry points)
- For any discipline where SYSTEMS subtypes are mostly solution artifacts (e.g., FAC), default all SYSTEMS to COMPONENT and author spine canonically.

If a discipline is not yet decided:
- Do NOT allow all SYSTEMS to become spines.
- Default: SYSTEMS → COMPONENT unless explicitly allowlisted.

## 7) Linter Principle (Do not dumb templates down)
If a correct boundary concept fails lint:
- Fix the linter boundary markers.
- Do NOT rewrite the template into mush like "at the site" to pass lint.

## 8) "Refuse to Proceed" Conditions
Cursor must STOP and refuse to implement if any of these are true:
1. Proposed spines contain solution artifacts.
2. Proposed spines exceed 3 for a discipline without explicit approval.
3. No explicit spine decision list exists for the discipline.
4. A change would allow all SYSTEMS to become baseline spines by default.
5. A template or question introduces subjective interpretation ("when needed", "when required", "adequate").
6. A change introduces sector/subsector/event logic into baseline.

When refusing, Cursor must output:
- the exact violating rule number(s)
- the exact file/location causing the violation
- the exact minimal correction required
