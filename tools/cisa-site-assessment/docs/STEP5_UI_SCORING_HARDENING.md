# STEP 5: UI + Scoring + Hardening Implementation Plan

## Overview
Align UI, scoring, and reporting to frozen Baseline v2 gate model and finalize hardening.

## Implementation Status

### 1. Gate Metadata in UI Layer ✅
- **File**: `app/lib/gateMetadata.ts`
- **Purpose**: Provides gate mapping from Baseline v2 migration table
- **Functions**:
  - `getGateForQuestion()` - Get gate for a question
  - `enrichElementWithGate()` - Enrich required element with gate metadata
  - `evaluateGatesForSubtype()` - Evaluate gate results for conditional rendering
- **API**: `app/api/runtime/assessments/[assessmentId]/required_elements/route.ts`
  - Enriches elements with `mapped_gate` and `is_retired` fields

### 2. Gate-Ordered Rendering ⏳
- **Component**: `app/components/GateOrderedQuestions.tsx`
- **Features**:
  - Groups questions by subtype and gate
  - Renders gates in order: CONTROL_EXISTS → CONTROL_OPERABLE → CONTROL_RESILIENCE
  - Conditional rendering:
    - If EXISTS = NO → hides OPERABLE and RESILIENCE
    - If OPERABLE = NO → hides RESILIENCE
  - Preserves stored answers (no data loss on toggle)
- **Status**: Component created, needs integration into assessment execution page

### 3. Scoring Alignment ⏳
- **Required**: Update scoring API to:
  - Exclude N_A from scoring
  - Respect gate-order skips (do not count skipped gates as unanswered)
  - Provide per-discipline and per-subtype metrics
- **Status**: Pending implementation

### 4. OFC Nominations UI Integration ⏳
- **Current**: `app/engineering/ofcs/review/page.tsx` exists
- **Required Enhancements**:
  - Add filters: status, discipline, subtype
  - Badge for `reference_unresolved`
  - Show `status_reason`
  - Enforce guardrails:
    - Approve disabled if `reference_unresolved = true`
    - Reject requires reason
    - No force-promote
- **Status**: Pending implementation

### 5. QA Exclusion ⏳
- **Option A (Preferred)**: Add `qa_flag` boolean column to assessments table
- **Option B (Temporary)**: Enforce name prefix filter `[QA]` at query layer
- **Required Exclusions**:
  - Assessment lists
  - Scoring summaries
  - Executive summary reports
  - OFC dashboards
- **Status**: Pending implementation

## File Map

### Created Files
- `app/lib/gateMetadata.ts` - Gate metadata helper
- `app/api/runtime/assessments/[assessmentId]/required_elements/route.ts` - API with gate enrichment
- `app/components/GateOrderedQuestions.tsx` - Gate-ordered question rendering component
- `docs/STEP5_UI_SCORING_HARDENING.md` - This document

### Files to Update
- `app_broken/assessments/[assessmentId]/page.tsx` - Replace question rendering with GateOrderedQuestions
- `app/api/assessment/scoring/route.ts` (or equivalent) - Update scoring logic
- `app/engineering/ofcs/review/page.tsx` - Add filters and guardrails
- `app/api/runtime/assessments/route.ts` - Add QA exclusion
- `src/data/psaDataProvider.ts` - Add QA exclusion to getAssessments()
- Migration file for `qa_flag` column (if Option A)

## Next Steps
1. Integrate GateOrderedQuestions into assessment execution page
2. Update scoring API with gate-aware logic
3. Enhance OFC nominations UI
4. Implement QA exclusion (migration + query updates)

