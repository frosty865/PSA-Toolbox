# Assessment Philosophy Alignment Summary - REVISED

**Date:** 2026-01-14  
**Status:** CORRECTED ALIGNMENT  
**Purpose:** Corrected understanding of authoritative assessment philosophy

---

# A) CORRECTED ALIGNMENT SUMMARY

## 1) PURPOSE (SELF-DISCOVERY)

**What is the assessment for?**
The PSA Tool assessment enables **self-discovery** of a facility's security posture. It maps **capability presence** - what security systems, governance structures, operational controls, and functional states exist at a facility. The assessment does NOT judge, certify, or enforce compliance. It provides a structured way for facilities to discover and document their current security posture across systems, governance, planning, training, coordination, and operational controls.

**What does "maturity" mean in this system?**
Maturity is an emergent property that reflects the depth and breadth of security posture layers. It emerges from: (1) How many posture layers exist (systems, governance, operations), (2) Which components/standards are present within each layer, (3) Where depth stops naturally (unchecked components indicate enhancement opportunities). Maturity is NOT graded, gated, or enforced by questions. The tool enables self-discovery; maturity interpretation happens downstream in analysis/reporting, not in-question logic.

**Confirm: maturity is an emergent property, not embedded in question language.**
✅ **CONFIRMED.** Maturity emerges from component checklists and posture layer presence, not from question phrasing. Questions describe state/capability existence, not quality or maturity level.

---

## 2) BASELINE VS EXPANSION SEPARATION

**Define "Baseline" in this system:**
Baseline = universal, sector-agnostic questions that apply to ALL facilities regardless of sector/subsector. Currently ~400 questions (per `baseline_questions_registry_v2.json`), organized by discipline/subtype. Baseline includes: (1) **Systems** - physical security systems and components, (2) **Governance** - security management, roles, coordination structures, (3) **Operations** - training, exercises, planning, procedures, maintenance, logs, records. Baseline questions must be: verifiable/auditable (via system, document, record, plan, log, or observation), technology-neutral where possible, sector-agnostic language. Baseline is FROZEN and immutable once versioned.

**Define "Sector/Subsector Expansion":**
Expansion = additive-only overlay questions that appear ONLY when expansion profiles are explicitly applied. Expansion questions: (1) Are separate from baseline (different tables, different scoring), (2) Are explicitly applied (no auto-application based on assessment sector/subsector fields), (3) Are versioned and scoped (SECTOR, SUBSECTOR, or TECHNOLOGY scope_type), (4) Never modify baseline questions, (5) Are reported separately (no composite score in Phase 1). Expansion questions address context-specific requirements (e.g., crowds, events, alcohol, VIPs) that baseline cannot cover.

**Confirm: baseline is universally applicable and cannot be altered or reduced by expansions.**
✅ **CONFIRMED.** Baseline remains unchanged regardless of overlay selection. Expansion is additive only.

---

## 3) QUESTION MODEL (STRICT)

**What is a valid assessment question format?**
- **Allowed:** YES/NO/N_A questions only. Response enum must be exactly `["YES", "NO", "N_A"]`.
- **Allowed:** Existence/checklist questions for plans, roles, training, exercises, logs, records IF they are testable as YES/NO/N_A (e.g., "Are security plans in place?" meaning "Can the plan document be shown/reviewed?").
- **Not allowed:** Open-ended narrative prompts, free-text questions, or any response type other than YES/NO/N_A.

**Explain how subordinate/clarifying questions should be used:**
Subordinate questions (gating logic) are for: (1) Conditional detail collection when parent answer = YES (component checklists), (2) Conditional OFC selection when parent answer = NO, (3) Technology-driven branching. Subordinate questions are NOT for: quality assessment, implementation guidance, or best practice evaluation.

**Confirm: questions describe current posture (state), not "best practice" or "quality."**
✅ **CONFIRMED.** Questions ask "what exists" not "how good is it" or "does it follow best practices."

---

## 4) OBSERVABILITY — CORRECTED SCOPE

**Corrected Definition:**
Baseline questions must be **verifiable/auditable**, not strictly physical. Governance, planning, training, coordination, and operational controls ARE valid baseline content **if framed as existence/checklist questions**.

**Explicitly allowed in baseline when testable as YES/NO/N_A:**
- **Plans** - "Are security plans in place?" (verifiable by showing plan document)
- **Roles** - "Are security roles defined?" (verifiable by showing organizational chart/job descriptions)
- **Training** - "Is security training conducted?" (verifiable by showing training records/logs)
- **Exercises** - "Are security exercises conducted?" (verifiable by showing exercise records/logs)
- **Logs** - "Are security logs maintained?" (verifiable by showing log files/records)
- **Records** - "Are security records maintained?" (verifiable by showing record files)

**The key distinction:**
Questions must ask about **existence/availability** of these items (can be shown/reviewed), not about their quality, effectiveness, or implementation details. "Are plans in place?" is valid if it means "Can the plan be shown?" NOT "Are plans effective?"

---

## 5) SOLUTION-ARTIFACT PROHIBITION — CORRECTED

**Corrected Rule:**
Solution artifacts are INVALID **only when embedded in questions**. They are VALID in OFCs.

**Correct Split:**
- **Questions** → capability/state (e.g., "Are camera feeds monitored?")
- **OFCs** → authoritative ways capabilities are commonly achieved (e.g., "Install IP cameras with VMS" or "Deploy video wall in security operations center")

**Examples of invalid question artifacts:**
- ❌ "Is a video wall installed?" → Reframe: "Are camera feeds monitored in real-time?"
- ❌ "Are IP cameras with VMS deployed?" → Reframe: "Are video surveillance cameras operational and recording?"

**Examples of valid OFC artifacts:**
- ✅ OFC: "Install IP cameras with VMS for video surveillance"
- ✅ OFC: "Deploy video wall in security operations center for monitoring"

---

## 6) OFC MODEL (INDEPENDENT + CITE-DRIVEN)

**Define what an OFC is in this system:**
OFC = "Option for Consideration" - a citable recommendation extracted from corpus sources (VOFC_LIBRARY.xlsx, approved PDFs) that describes WHAT capability completes posture when a question is answered NO. OFCs may include solution artifacts (specific technologies, products, implementation methods) as authoritative ways capabilities are commonly achieved. OFCs are NOT generated; they are discovered from documents and linked to questions via matching algorithms.

**Confirm: OFCs are extracted independently from documents and linked to standing questions.**
✅ **CONFIRMED.** OFCs are discovered from corpus sources and matched to questions. Questions do NOT generate OFCs.

**Confirm: OFCs must be citable and may include solution artifacts.**
✅ **CONFIRMED.** OFCs describe WHAT capability is needed and HOW it is commonly achieved (solution artifacts are valid in OFCs, not in questions).

---

## 7) BASELINE CONTENT — CORRECTED

**Retraction:**
I previously implied that plans/procedures/roles are inherently invalid and baseline should shrink to ~100-200 "systems-only" questions. This is **INCORRECT**.

**Corrected Understanding:**
Baseline includes **systems + governance + operations**. The audit rubric (not the baseline intent) is what requires correction. Plans, procedures, roles, training, exercises, logs, and records are valid baseline content when framed as existence/checklist questions that are verifiable/auditable.

**Baseline Structure (per SAFE3.0):**
- **Information Sharing** (14 questions) - awareness, coordination, communication
- **Security Plans** (7 questions) - SecurityManager, SecurityPlan, PlanTraining, PlanCoordination, EmployeeTraining, PlanTesting, RiskAssessment
- **Physical Security** (7 questions) - perimeter, access, lighting, etc.
- **Security Systems** (8 questions) - video, intrusion, alarms, integration

---

## 8) BASELINE NORMALIZATION — REVISED TRIAGE RUBRIC

**For each baseline question, classify as:**

- **KEEP**
  - Clear YES/NO/N_A
  - Verifiable via system, document, record, plan, log, or observation
  - Examples: "Are security plans in place?" (if verifiable by showing plan), "Are access control systems operational?" (if verifiable by inspection)

- **REWRITE**
  - Correct intent, wrong framing
  - Solution artifacts embedded in question (e.g., "Is a video wall installed?" → "Are camera feeds monitored?")
  - Vague adjectives or abstract language (e.g., "effective", "adequate", "capabilities")
  - Example: "Does the facility have biometric access capabilities?" → "Are biometric access readers installed?"

- **MOVE_TO_EXPANSION**
  - Requires sector/subsector context (crowds, events, alcohol, VIPs, etc.)
  - Sector-specific terminology
  - Examples: Sports venue-specific questions, clear bag policy questions

- **DROP**
  - Cannot be made testable without narrative or subjective quality judgment
  - Examples: "Is security managed effectively?" (requires subjective judgment), "Are processes adequate?" (requires quality assessment)

**Explicitly state:**
Plans/procedures/roles are NOT automatic DROP candidates. They are valid if framed as existence/checklist questions that are verifiable/auditable.

---

## 9) UX + EXPANSION — CLARIFIED

**Sector/subsector selection is used to:**
- Hide irrelevant expansion options (UI filters expansion profiles by sector/subsector)
- Recommend relevant expansion profiles (UI suggests profiles matching sector/subsector)

**Expansion content is applied ONLY when explicitly selected:**
- Users must explicitly select and apply expansion profiles via the UI
- No auto-application based on assessment sector/subsector fields
- Expansion questions appear only when profiles are explicitly applied

**Baseline is never altered or filtered by expansion:**
- Baseline questions remain unchanged regardless of expansion selection
- Baseline scoring is independent of expansion
- Expansion is additive only

---

## 10) NON-NEGOTIABLES / DRIFT GUARDS

**Top 10 "drift guardrails" to enforce during future changes:**

1. **No compliance language** - Assessment enables self-discovery, not compliance judgment
2. **No guessing** - If unsure, identify exact files to inspect
3. **No invented questions** - All baseline questions must come from authoritative sources
4. **No SAFE-derived phrasing generation** - SAFE is reference only
5. **Verifiability is mandatory** - Questions must be verifiable via system, document, record, plan, log, or observation
6. **No solution artifacts in questions** - Questions ask capability/state, not implementation
7. **Solution artifacts valid in OFCs** - OFCs may include specific technologies/products
8. **Baseline is universal** - No sector-specific, subsector-specific, or technology-specific language in baseline
9. **Expansion never modifies baseline** - Hard rule: Expansion endpoints must reject baseline question IDs
10. **Maturity is emergent** - Maturity comes from component checklists and posture layers, not question language

---

# B) PREVIOUS MISALIGNMENTS (ADMITTED)

**What I previously got wrong and why:**

1. **"Baseline compliance score" language** - I incorrectly used compliance/judgment language. The assessment is for self-discovery and posture mapping, not compliance certification.

2. **"Observable via physical inspection only"** - I incorrectly stated baseline must be strictly physical. The correct definition is verifiable/auditable via system, document, record, plan, log, or observation. Governance, planning, training, coordination, and operational controls ARE valid baseline content when framed as existence/checklist questions.

3. **"Plans/procedures/roles are inherently invalid"** - I incorrectly implied these should be removed from baseline. The correct understanding: plans, procedures, roles, training, exercises, logs, and records are valid baseline content when testable as YES/NO/N_A existence questions.

4. **"Baseline should shrink to ~100-200 systems-only questions"** - I incorrectly concluded baseline should be reduced to systems-only. The correct understanding: baseline includes systems + governance + operations. The audit rubric needs correction, not the baseline intent.

5. **"Solution artifacts must not appear"** - I incorrectly stated solution artifacts are always invalid. The correct rule: solution artifacts are INVALID in questions but VALID in OFCs. Questions ask capability/state; OFCs describe authoritative ways capabilities are commonly achieved.

6. **"Maturity is graded/gated by questions"** - I incorrectly implied maturity is enforced by question logic. The correct understanding: maturity is emergent from posture layers and component checklists. Maturity interpretation happens downstream, not in-question logic.

7. **"Plans/procedures/roles are automatic DROP candidates"** - I incorrectly included these in the DROP category. The correct triage: plans/procedures/roles are valid if framed as existence/checklist questions that are verifiable/auditable.

8. **Contradictory expansion UX statement** - I stated expansion is hidden unless sector/subsector matches, but also stated expansion requires explicit selection. The correct understanding: sector/subsector selection filters/recommends expansion options, but expansion is applied ONLY when explicitly selected.

---

# C) CONFIDENCE CHECK

I now understand:

- **Baseline vs expansion:** Baseline is universal (systems + governance + operations) and applies to all facilities. Expansion is additive-only, explicitly applied, and addresses sector/subsector-specific context. Baseline is never altered by expansion.

- **Posture vs grading:** The assessment enables self-discovery of security posture (what exists). It does NOT judge, certify, or enforce compliance. Maturity emerges from posture layers and component checklists, not from question language. Maturity interpretation happens downstream in analysis/reporting.

- **Questions vs OFCs:** Questions ask about capability/state existence (verifiable via system, document, record, plan, log, or observation). OFCs describe WHAT capability completes posture and HOW it is commonly achieved (solution artifacts are valid in OFCs, not in questions).

- **Self-discovery intent:** The assessment provides a structured way for facilities to discover and document their current security posture. It maps capability presence across systems, governance, and operations. It does NOT provide compliance certification or quality judgment.

**Confidence Level:** HIGH. I have reviewed authoritative sources (`baseline_spec/SAFE3.0_Question_Logic_README.md`, `baseline_spec/README.md`, `psa_engine/question_sets/BASELINE_CORE.index.json`) and confirmed that baseline includes governance, planning, training, and coordination questions. The key correction is that these must be framed as existence/checklist questions that are verifiable/auditable, not abstract capability questions.

---

**END OF REVISED ALIGNMENT SUMMARY**
