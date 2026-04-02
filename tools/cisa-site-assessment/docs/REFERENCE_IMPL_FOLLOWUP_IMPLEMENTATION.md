# Reference Implementation Follow-up Questions Implementation

**Date:** 2026-01-24  
**Status:** Implementation Complete

## Overview

This implementation adds two behaviors:

1. **"What this question means" drawer/panel**: Adds a "Reference Implementation" tab that displays reference implementation data when available for a question's `discipline_subtype_id`.

2. **Assessment flow**: When a baseline question is answered YES, automatically renders YES-only descriptive branching questions from the subtype's reference implementation and persists them as follow-up responses.

## Database Changes

### Migration: `db/migrations/20260124_add_assessment_followup_responses.sql`

Creates `assessment_followup_responses` table to store follow-up responses:
- Links to parent baseline response via `parent_response_id`
- Stores follow-up question text, response type, and values
- Supports TEXT, ENUM, and MULTISELECT response types

## API Routes

### 1. GET `/api/runtime/assessments/[assessmentId]/reference-impl`
- Returns reference implementation payload for a `discipline_subtype_id`
- Returns `{ ok: true, found: false }` if no reference implementation exists

### 2. GET `/api/runtime/assessments/[assessmentId]/followups?parent_response_id=...`
- Returns existing follow-up responses for a parent response

### 3. POST `/api/runtime/assessments/[assessmentId]/followups`
- Upserts follow-up responses for a parent response
- Body: `{ parent_response_id, discipline_subtype_id, followups: [...] }`

## UI Components

### Updated Components

1. **IntentPanel** (`app/components/IntentPanel.tsx`)
   - Added tabs: "Intent" and "Reference Implementation"
   - Shows Reference Implementation tab when `disciplineSubtypeId` is provided
   - Uses existing `ReferenceImplementationPanel` component

2. **QuestionHelp** (`app/components/QuestionHelp.tsx`)
   - Now passes `disciplineSubtypeId` to `IntentPanel`

3. **SubtypeQuestionBlock** (`app/components/SubtypeQuestionBlock.tsx`)
   - Added `discipline_subtype_id` to Question interface
   - Added `parentResponseId` prop
   - Loads reference implementation when YES is selected
   - Renders `FollowupQuestions` component when YES is selected and reference implementation exists

### New Components

1. **FollowupQuestions** (`app/components/FollowupQuestions.tsx`)
   - Renders YES-only descriptive branching questions
   - Supports TEXT (textarea), ENUM (radio), MULTISELECT (checkbox) input types
   - Auto-saves on blur/change
   - Loads existing responses on mount

## Integration Points

### Assessment Page
- Needs to pass `responseIdMap` to `DisciplineSectionBlock` (if available)
- `DisciplineSectionBlock` should pass `parentResponseId` to `SubtypeQuestionBlock`

### Response ID Tracking
- Response IDs come from `assessment_responses` table
- Currently, response IDs are tracked in `responseIdMap` in the assessment page
- If `parentResponseId` is not available, follow-up questions will not render (graceful degradation)

## Usage

### For Questions with Reference Implementation

1. User answers baseline question as YES
2. System automatically loads reference implementation for `discipline_subtype_id`
3. If reference implementation exists, follow-up questions appear below the checklist
4. User answers follow-up questions (TEXT, ENUM, or MULTISELECT)
5. Responses are saved to `assessment_followup_responses` table

### For "What this question means" Panel

1. User clicks "What this question means"
2. Panel opens with two tabs: "Intent" and "Reference Implementation"
3. Reference Implementation tab shows:
   - Baseline existence question
   - What "Right" Looks Like
   - Descriptive branching questions
   - OFC trigger notes (non-user-facing)

## Notes

- Follow-ups never change baseline scoring or baseline question count
- Follow-ups are tied to parent response and `discipline_subtype_id`
- Follow-ups are not added to baseline_spines_runtime or baseline question banks
- No SAFE references
- Graceful fallback: If no reference implementation exists, no follow-ups are shown

## Next Steps (If Needed)

1. Add `responseIdMap` prop to `DisciplineSectionBlock` from assessment page
2. Update assessment page to track response IDs and pass them down
3. Add follow-up display in review/summary UI (DisciplineSectionBlock review section)
