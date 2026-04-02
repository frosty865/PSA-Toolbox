# Assessment Philosophy Alignment Summary

**Date:** 2026-01-14  
**Status:** AUTHORITATIVE ALIGNMENT CHECK  
**Purpose:** Align understanding with authoritative assessment philosophy so both platforms behave the same

---

# A) ALIGNMENT SUMMARY

## 1) PURPOSE (SELF-DISCOVERY)

**What is the assessment for?**
The PSA Tool assessment evaluates the current security posture of facilities through field-verifiable, observable conditions. It measures what security systems, components, and functional states exist at a facility at the time of assessment. The assessment produces a baseline compliance score and identifies gaps where security capabilities are absent or incomplete.

**What does "maturity" mean in this system?**
Maturity is an emergent property calculated from component checklists associated with YES answers. When a question is answered YES, the assessor checks which components/standards are present. The number of checked components = standards met. Maturity is NOT embedded in question language (no "adequate", "effective", "sufficient" terms). It emerges from: (1) YES answers with component counts, (2) NO answers indicating standards lost, (3) YES answers with unchecked components indicating enhancement opportunities.

**Confirm: maturity is an emergent property of answers, not something embedded as grading language in questions.**
✅ **CONFIRMED.** Per `baseline_spec/README.md`: "Components ARE the scored maturity/standards (not 'evidence only')". Maturity is calculated from component checkboxes, not from question phrasing. Questions must be observable state questions, not quality/maturity questions.

---

## 2) BASELINE VS EXPANSION SEPARATION

**Define "Baseline" in this system:**
Baseline = universal, sector-agnostic questions that apply to ALL facilities regardless of sector/subsector. Currently ~400 questions (per `baseline_questions_registry_v2.json`), organized by discipline/subtype. Must be: (1) Observable via on-site inspection, (2) Technology-neutral where possible, (3) Sector-agnostic language (no sector-specific terminology), (4) Field-verifiable (YES/NO/N_A determinable through physical inspection). Baseline is FROZEN and immutable once versioned.

**Define "Sector/Subsector Expansion":**
Expansion = additive-only overlay questions that appear ONLY when expansion profiles are explicitly applied. Expansion questions: (1) Are separate from baseline (different tables, different scoring), (2) Are explicitly applied (no auto-application based on assessment sector/subsector fields), (3) Are versioned and scoped (SECTOR, SUBSECTOR, or TECHNOLOGY scope_type), (4) Never modify baseline questions, (5) Are reported separately (no composite score in Phase 1). Expansion questions address context-specific requirements that baseline cannot cover.

**Confirm: baseline is universally applicable and cannot be altered or reduced by expansions.**
✅ **CONFIRMED.** Per `docs/SECTOR_SUBSECTOR_EXPANSION_ARCHITECTURE.md`: "Baseline questions are universal - The 36 primary baseline questions apply to all assessments regardless of sector/subsector" and "No contamination - Expansion endpoints must never write to baseline tables or accept baseline question IDs". Baseline remains unchanged regardless of overlay selection.

---

## 3) QUESTION MODEL (STRICT)

**What is a valid assessment question format?**
- **Allowed:** YES/NO/N_A questions only. Response enum must be exactly `["YES", "NO", "N_A"]`.
- **Allowed:** Explicit PLAN/CHECKLIST existence questions IF they ask about observable evidence (e.g., "Are security plans visible/displayed?" NOT "Are security plans documented?").
- **Not allowed:** Open-ended narrative prompts, free-text questions, or any response type other than YES/NO/N_A.

**Explain how subordinate/clarifying questions should be used:**
Subordinate questions (gating logic) are for: (1) Conditional detail collection when parent answer = YES (component checklists), (2) Conditional OFC selection when parent answer = NO, (3) Technology-driven branching (e.g., VideoAnalytics only shown if VideoSystemType = digital or hybrid). Subordinate questions are NOT for: (1) Quality assessment ("Is it effective?"), (2) Implementation guidance ("How should it be done?"), (3) Best practice evaluation ("Does it follow best practices?").

**Confirm: questions describe current posture (state), not "best practice" or "quality."**
✅ **CONFIRMED.** Per `docs/baseline/BASELINE_VALIDITY_RULES.md` RULE-002: "Describe a physical or functional security condition that exists or does not exist" and RULE-105 prohibits "effective", "adequate", "appropriate", "sufficient", "properly". Questions must be observable state questions, not quality/maturity questions.

---

## 4) SOLUTION-ARTIFACT PROHIBITION

**5 Examples of "solution artifacts" that must NOT appear as baseline questions:**

1. **"Is a video wall installed in the security operations center?"**
   - **Reframe:** "Are camera feeds monitored in real-time?" (capability/state, not specific technology)

2. **"Are IP cameras with VMS deployed?"**
   - **Reframe:** "Are video surveillance cameras operational and recording?" (technology-neutral, observable state)

3. **"Is a biometric fingerprint reader installed?"**
   - **Reframe:** "Are biometric access readers installed at controlled entry points?" (capability, not specific product type)

4. **"Is a DVR system used for video recording?"**
   - **Reframe:** "Is video surveillance footage recorded and retained?" (functional capability, not implementation detail)

5. **"Are ONVIF-compliant cameras deployed?"**
   - **Reframe:** "Are video surveillance cameras operational?" (observable state, not protocol specification)

**How each should be reframed:**
All examples reframed to ask about observable capability/state rather than specific technology. Questions must be technology-neutral and focus on "what capability exists" not "how it's implemented". Per `baseline_spec/README.md`: "Technology-neutral where possible" and `docs/TECH_DIFFERENTIATION.md`: "Technology notes and overlays must not include 'how to implement' language."

---

## 5) OFC MODEL (INDEPENDENT + CITE-DRIVEN)

**Define what an OFC is in this system:**
OFC = "Option for Consideration" - a citable recommendation extracted from corpus sources (VOFC_LIBRARY.xlsx, approved PDFs) that describes WHAT capability completes posture when a question is answered NO. OFCs are NOT generated; they are discovered from documents and linked to questions via matching algorithms.

**Confirm: OFCs are extracted independently from documents and linked to standing questions (questions do NOT generate OFCs).**
✅ **CONFIRMED.** Per `baseline_spec/README.md`: "OFC text is NOT generated - OFCs are discovered from corpus sources (VOFC_LIBRARY.xlsx, approved PDFs)" and `docs/OFC_DISCOVERY_COVERAGE.md`: "Candidates remain candidates: Matching creates links, does not promote to library" and "Review required: Human reviewer must select final target and promote". OFCs are extracted via `tools/corpus/ofc_extractor_v2.py` and matched to questions via `tools/match_candidates_to_questions.py`.

**Confirm: OFCs must be citable and describe WHAT capability completes posture, not HOW to implement.**
✅ **CONFIRMED.** Per `docs/OFC_DISCOVERY_COVERAGE.md`: "Citations required: Promotion still requires ≥1 citation" and `tools/corpus/ofc_extractor_v2.py` rejects implementation details ("Rejects: Implementation details (brands, step-by-step, procurement)"). OFCs describe WHAT capability is needed, not HOW to procure/install it.

---

## 6) BASELINE NORMALIZATION PASS (NEXT ACTION, NO CODE)

**Describe the corrective action to "firm up" the ~400 baseline questions:**
Per `analytics/reports/BASELINE_INTEGRITY_SUMMARY.md`, all 416 baseline questions contain observability violations. Corrective action: (1) Run `tools/audit_baseline_integrity.py` to identify violations, (2) Apply triage rubric below to each question, (3) Rewrite REWRITE candidates, (4) Move MOVE_TO_EXPANSION candidates to expansion tables, (5) Remove DROP candidates, (6) Validate corrections with `tools/validate_baseline_observability.py`.

**Explicit triage rubric for each question:**

- **KEEP (already state/capability-based):** Questions that pass all observability rules (RULE-001 through RULE-105). Must be: observable via physical inspection, describe physical/functional conditions, produce meaningful YES/NO, avoid abstract terms ("capabilities", "processes", "governance"), avoid policy/procedure focus, avoid roles/responsibilities, avoid interpretation-required language.

- **REWRITE (good intent, wrong framing):** Questions with abstract "capabilities" language (SYSTEMS dimension - 104 questions per audit). Transformation: Replace "Does the facility have [X] capabilities?" with "Are [specific systems/components] installed/operational?" Use observable verbs: "installed", "operational", "present", "configured", "recording", "monitored".

- **MOVE_TO_EXPANSION (not universal):** Questions that are sector-specific, subsector-specific, or technology-specific. Examples: Sports venue-specific questions, clear bag policy questions, sector-specific terminology. These belong in `expansion_questions` table with appropriate `scope_type` and `scope_code`.

- **DROP (solution-specific / sector-specific / non-question):** Questions that: (1) Reference specific technologies/products (solution artifacts), (2) Are inherently non-observable (PLANS_PROCEDURES, MAINTENANCE_ASSURANCE, PERSONNEL_RESPONSIBILITY dimensions - 312 questions per audit), (3) Are documentation-focused (cannot be verified through physical inspection), (4) Are organizational structure-focused (roles/responsibilities), (5) Are process/assurance-focused (maintenance assurance).

**State expected outcomes:**
Per audit: 100% violation rate (416/416 questions). Expected outcomes: (1) ~104 questions REWRITE (SYSTEMS dimension - remove "capabilities" language), (2) ~208 questions MOVE_TO_EXPANSION or DROP (PLANS_PROCEDURES + PERSONNEL_RESPONSIBILITY - inherently non-observable), (3) ~104 questions COLLAPSE or DROP (MAINTENANCE_ASSURANCE - process-based, not observable). Large % will be rewritten or moved. Final baseline likely reduced to ~100-200 observable SYSTEMS-dimension questions.

---

## 7) UX SCOPE FIRST

**Confirm that assessment start flow must collect facility name + address + sector + subsector BEFORE any questions are shown.**
✅ **CONFIRMED.** Per `app/components/CreateAssessmentDialog.tsx`, the creation flow is multi-step: Step 1 collects assessment name, Step 2 collects facility information (name, address, POC), Step 3 collects sector + subsector + modules. Questions are only shown after assessment is created (in `app/assessments/[assessmentId]/page.tsx`). The API endpoint `/api/runtime/assessments` POST requires: `assessment_name`, `sector_code`, `subsector_code`, `facility` (with `facility_name`, `poc_name`, `poc_email`, `poc_phone`).

**Confirm expansion content is hidden unless sector/subsector matches.**
✅ **CONFIRMED.** Per `docs/SECTOR_SUBSECTOR_EXPANSION_ARCHITECTURE.md`: "No auto-application - Profiles are never automatically applied based on assessment sector/subsector fields" and "Manual selection - Users must explicitly select and apply expansion profiles via the UI". Expansion questions are only shown when profiles are explicitly applied. However, per architecture: expansion is NOT auto-applied based on sector/subsector - it requires explicit profile selection. So expansion content is hidden UNLESS profiles are explicitly applied (which may correlate with sector/subsector, but is not automatic).

---

## 8) NON-NEGOTIABLES / DRIFT GUARDS

**Top 10 "drift guardrails" to enforce during future changes:**

1. **No guessing** - If unsure about question validity, identify exact files to inspect (`baseline_spec/README.md`, `docs/baseline/BASELINE_VALIDITY_RULES.md`, `analytics/runtime/baseline_questions_registry_v2.json`).

2. **No invented questions** - All baseline questions must come from authoritative sources (`baseline_spec/ALT_SAFE_Assessment.html`, `baseline_questions_registry_v2.json`). No LLM-generated questions without validation.

3. **No SAFE-derived phrasing generation** - SAFE is reference only (`baseline_spec/ALT_SAFE_Assessment.html` is FROZEN). Do not generate new questions by paraphrasing SAFE content.

4. **Observability is mandatory** - All baseline questions must pass `tools/validate_baseline_observability.py` checks. BLOCKER violations (RULE-101, RULE-102, RULE-103, RULE-104) must be fixed before acceptance.

5. **No solution artifacts** - Questions must be technology-neutral and capability-focused. No specific products, protocols, or implementation details.

6. **Baseline is universal** - No sector-specific, subsector-specific, or technology-specific language in baseline. Such content belongs in expansion.

7. **Expansion never modifies baseline** - Hard rule: Expansion endpoints must reject baseline question IDs. Baseline tables are never written to by expansion endpoints.

8. **OFCs are discovered, not generated** - OFCs come from corpus sources only. No LLM-generated OFCs. Citations required for promotion.

9. **Questions describe state, not quality** - No "effective", "adequate", "sufficient", "properly" language. Questions ask "what exists" not "how good is it".

10. **Maturity is emergent** - Maturity comes from component checklists, not question language. Do not embed maturity/grading language in questions.

---

# B) RISKS / MISALIGNMENT WATCHLIST

**What could still drift:**

1. **Question generation tools may reintroduce abstract language** - `tools/regenerate_baseline_questions.py` templates may need updates to prevent "capabilities" language.

2. **Expansion questions may contaminate baseline** - Need strict validation in `app/lib/expansion/validation.ts` to prevent baseline question IDs in expansion payloads.

3. **OFC matching may link to wrong questions** - Matching algorithm (`tools/match_candidates_to_questions.py`) may create false positives. Human review required.

4. **Technology profiles may affect baseline scoring** - Need guards to ensure `assessment_technology_profiles` never affects baseline calculations.

5. **UX may show questions before facility/sector collected** - Need validation that assessment creation completes before question rendering.

6. **Observability validation may be bypassed** - Need integration into all question generation/modification workflows.

7. **SAFE content may be used as source for new questions** - Need explicit policy that SAFE is reference only, not a template for generation.

8. **Component checklists may be treated as "evidence only"** - Need enforcement that components ARE the scored maturity/standards.

---

# C) FILES TO INSPECT FIRST

**Short list of repo paths to validate:**

1. `baseline_spec/README.md` - Authoritative baseline definition and principles
2. `docs/baseline/BASELINE_VALIDITY_RULES.md` - Observability rules (RULE-001 through RULE-105)
3. `analytics/runtime/baseline_questions_registry_v2.json` - Current baseline questions (~400 questions)
4. `docs/SECTOR_SUBSECTOR_EXPANSION_ARCHITECTURE.md` - Expansion separation rules
5. `docs/OFC_DISCOVERY_COVERAGE.md` - OFC extraction and linking model
6. `baseline_spec/SAFE3.0_Question_Logic_README.md` - Question structure and scoring logic
7. `tools/validate_baseline_observability.py` - Observability validation implementation
8. `tools/audit_baseline_integrity.py` - Integrity audit tool
9. `analytics/reports/BASELINE_INTEGRITY_SUMMARY.md` - Audit findings (100% violation rate)
10. `app/lib/expansion/validation.ts` - Expansion contamination guards
11. `app/components/CreateAssessmentDialog.tsx` - Assessment creation flow (facility + sector before questions)
12. `baseline_spec/ALT_SAFE_Assessment.html` - FROZEN reference (do not edit, reference only)

---

**END OF ALIGNMENT SUMMARY**
