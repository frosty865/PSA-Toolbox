# PSA OFC Doctrine v1

<!--
doctrine_id: PSA_OFC_DOCTRINE
doctrine_version: 1.0.0
status: LOCKED
change_control: "Changes require version bump + changelog entry"
-->

**Effective Date:** 2026-02-03  
**Supersedes:** All prior experimental OFC behavior

---

## 1. Purpose

This doctrine establishes the authoritative rules for Options for Consideration (OFCs) in the PSA system. It freezes the model based on template structure (baseline questions, expansion questions, sector/subsector scoping) with modern, evolvable execution.

**Core Principle:** OFCs are authored solution patterns, not extracted text. Documents guide problem definition and solution selection, but never define OFCs directly.

**Scope:** Physical security, governance, planning, and operations only (PSA-scope). This doctrine describes **what** capability should exist, not **how**. Use capability framing only.

**Deterministic attachment:** When the answer to “does this question require an OFC?” is **NO** → do not attach OFCs. When **YES** or **N/A** (e.g. not applicable) → attach OFCs only per promotion rules below; otherwise none.

---

## 2. Forbidden Language

The following are **banned** in doctrine, OFC content, and related guidance. Violations fail the doctrine-lock guard.

- **Framework names** — Any reference to legacy or external assessment framework names (including any four-letter acronym previously used for a security assessment framework).
- **Legacy phrasing** — Do not use style-suffix, versioned (v2/v3), or framework-named phrasing from the deprecated assessment framework.
- **Framework artifact labels** — Do not use legacy framework artifact labels (e.g. protective-measure terms as framework labels). OFC remains the canonical term.
- **Compliance framing** — Use capability framing only; avoid "compliance" as the primary lens (e.g. prefer "capability to X" over "compliance with X").

---

## 3. Evidence vs Problems vs Solutions

### Evidence
- **What it is:** Document excerpts, citations, findings, observations
- **Purpose:** Justify OFCs, surface problem evidence, support analyst decision-making
- **Storage:** `document_chunks`, `corpus_documents`, `source_registry`
- **Rule:** Evidence NEVER becomes an OFC directly

### Problems
- **What it is:** Gaps, vulnerabilities, deficiencies identified in documents
- **Purpose:** Define what needs to be addressed
- **Storage:** Questions, findings, assessment responses
- **Rule:** Problems ≠ Solutions. A problem statement is not an OFC.

### Solutions (OFCs)
- **What it is:** Capability-level options authored as solution patterns
- **Purpose:** Answer assessment questions with actionable options
- **Storage:** `ofc_candidate_queue`, `ofc_library` (RUNTIME)
- **Rule:** Solutions are authored, not mined. They are capability statements, not verbatim text.

---

## 4. Definition of an OFC

An OFC (Option for Consideration) is:

1. **A capability-level option** written in capability-level, solution-focused language
2. **Authored once, reused forever** - not regenerated per document
3. **Answers a real question** - every OFC must map to an active assessment question
4. **Solution-focused** - describes what capability should exist, not what problem exists
5. **Subtype-specific** - belongs to exactly one `discipline_subtype_id`
6. **Evidence-backed** - must have ≥1 citation linking to corpus documents

### OFC Language Pattern
- ✅ "Establish [capability] to [purpose]"
- ✅ "Implement [system/process] for [outcome]"
- ✅ "Maintain [capability] to ensure [requirement]"
- ❌ "The facility lacks adequate lighting" (problem, not solution)
- ❌ "Consider reviewing lighting requirements" (vague, not actionable)
- ❌ "Section 3.2 discusses lighting" (evidence, not solution)

---

## 5. Template Structure Lineage

PSA OFC Doctrine v1 inherits from the baseline template structure (legacy assessment framework; no named reference):

- **Template structure:** Baseline questions, expansion questions, sector/subsector scoping
- **Capability Language:** OFCs describe capabilities, not implementations
- **Question-Driven:** Every OFC answers a specific assessment question
- **Evidence Model:** Citations justify OFCs but don't define them

**Modern Evolution:**
- Subtype isolation (hard gates)
- CORPUS vs MODULE separation
- Authoring-first model (not mining-first)
- Deterministic promotion rules

---

## 6. Subtype Isolation Rule

**MANDATORY:** OFCs are isolated by `discipline_subtype_id`. Cross-subtype linking is prohibited.

### Hard Gates (Enforced in Code)

1. **Question must have subtype**
   - If `question.discipline_subtype_id IS NULL`, skip with reason `question_missing_subtype`

2. **OFC must have subtype**
   - If `ofc.discipline_subtype_id IS NULL`, skip with reason `ofc_missing_subtype`

3. **Subtypes must match**
   - If `question.discipline_subtype_id != ofc.discipline_subtype_id`, skip with reason `subtype_mismatch`

4. **Disciplines must match** (when available)
   - If both have `discipline_id` and they don't match, skip with reason `discipline_mismatch`

### Examples
- ✅ Lighting question → Lighting OFC (same subtype)
- ❌ Lighting question → Fire suppression OFC (different subtype) - **BLOCKED**
- ❌ Illumination question → Fire detection OFC (different subtype) - **BLOCKED**

### Enforcement Points
- Linker (`tools/corpus/link_ofcs_to_questions_v1.py`): Hard gates before scoring
- Miner (`tools/corpus/mine_ofcs_solution_focused.py`): Only scores within same subtype
- API: Filters by subtype in all queries
- UI: Subtype filters prevent cross-contamination

---

## 7. CORPUS vs MODULE Separation

**MANDATORY:** CORPUS OFCs and MODULE OFCs are completely separate systems.

### CORPUS OFCs
- **Origin:** `ofc_origin = 'CORPUS'`
- **Source:** Mined/imported from corpus documents (legacy) or authored library (future)
- **Management:** Standard OFC review panel
- **Scope:** Universal, reusable across assessments
- **Rule:** Never appear in MODULE management UI

### MODULE OFCs
- **Origin:** `ofc_origin = 'MODULE'`
- **Source:** Created during module research via Module Data Management tab
- **Management:** Dedicated Module Data Management admin interface
- **Scope:** Module-specific, attached during research
- **Rule:** Never appear in CORPUS OFC panel, never auto-mined

### Separation Enforcement
- API routes default to `ofc_origin = 'CORPUS'` for CORPUS panel
- Module Data Management queries enforce `ofc_origin = 'MODULE'`
- Linker/miner only process CORPUS OFCs
- UI filters prevent cross-contamination

---

## 8. Promotion Rules

An OFC candidate can be promoted to library only if ALL of the following are true:

1. **Status = APPROVED**
   - Must be explicitly approved by reviewer
   - Status in `ofc_candidate_queue.status`

2. **Subtype Match**
   - `ofc.discipline_subtype_id == question.discipline_subtype_id`
   - Enforced by hard gates (see Section 5)

3. **Solution Relevance**
   - OFC text describes a capability solution, not a problem
   - Language matches capability-level patterns (see Section 3)
   - Answers the target question

4. **Evidence-Backed** (one of):
   - Has ≥1 citation in `ofc_candidate_targets` or `document_chunk_id`
   - Has `source_registry_id` + `source_id` (IST external verification)

### Promotion Process
1. Analyst reviews candidate in OFC panel
2. Verifies subtype match, solution relevance, evidence
3. Approves → status = 'APPROVED'
4. Linker promotes to library (if all gates pass)
5. OFC becomes available for assessments

---

## 9. Prohibited Behaviors

The following behaviors are **FORBIDDEN** and will cause build failures:

### Direct Extraction
- ❌ Inserting OFCs directly from document text
- ❌ Persisting mined OFCs without mapping to solution pattern
- ❌ Treating document excerpts as OFCs
- ❌ Auto-creating OFCs from findings/vulnerabilities

### Cross-Subtype Linking
- ❌ Linking lighting questions to fire suppression OFCs
- ❌ Allowing subtype mismatch in linker/miner
- ❌ Showing OFCs from different subtypes in same panel

### CORPUS/MODULE Contamination
- ❌ Showing MODULE OFCs in CORPUS panel
- ❌ Auto-mining MODULE OFCs
- ❌ Mixing origins in queries without explicit filter

### Problem-as-Solution
- ❌ Promoting problem statements as OFCs
- ❌ Treating vulnerabilities as solutions
- ❌ Converting findings directly to OFCs

### Evidence-as-OFC
- ❌ Using citations as OFC text
- ❌ Treating document excerpts as solutions
- ❌ Copying text verbatim from documents

---

## 10. Winning Model (Authoring, Not Mining)

### Current State (Post-Purge)
- Clean slate: `ofc_candidate_queue` is empty
- No auto-mining active
- All OFCs must be explicitly created

### Target State
1. **Curated OFC Library**
   - ~10-30 OFCs per `discipline_subtype`
   - Written in capability-level language
   - Authored once, reused forever
   - Stored as: `ofc_origin = 'CORPUS'`, `status = 'APPROVED'`

2. **Document Role**
   - CORPUS documents justify OFCs (citations)
   - Surface problem evidence
   - Support analyst decision-making
   - **Never** auto-create OFCs

3. **MODULE OFCs**
   - Created only via Module Data Management
   - Assigned during research
   - Never auto-mined
   - Never appear in CORPUS OFC panel

4. **Future Automation** (allowed, later)
   - Problem signal detection
   - OFC surfacing (selection, not creation)
   - Evidence aggregation
   - Confidence scoring

---

## 11. Success State Definition

You are "winning" when:

- ✅ OFC count is small, stable, trusted
- ✅ Every OFC answers a real question
- ✅ Evidence explains WHY, not WHAT
- ✅ No analyst ever asks "why is this OFC here?"
- ✅ Lighting questions never see fire suppression
- ✅ The system feels intentional, not noisy

---

## 12. Enforcement

### Build Guards
- `scripts/guards/verifyNoDirectOFCExtraction.js` - Fails build on prohibited patterns

### Code Enforcement
- Hard subtype gates in linker/miner
- Origin filtering in APIs
- UI separation of CORPUS/MODULE

### Review Process
- All OFCs require explicit approval
- Subtype match verified before promotion
- Evidence-backed requirement enforced

---

## 13. Doctrine Lock

**This doctrine is LOCKED.** All future work must comply.

- No experimental OFC extraction
- No cross-subtype linking
- No CORPUS/MODULE contamination
- No problem-as-solution promotion

**Violations will cause build failures and must be fixed before merge.**

---

**End of Doctrine**
