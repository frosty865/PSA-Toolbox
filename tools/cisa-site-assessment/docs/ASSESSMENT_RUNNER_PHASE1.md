# Assessment Runner Phase 1 - Implementation Summary

## Overview
Implemented a working assessment runner that uses the frozen `assessment_question_universe` as the ordered list, renders questions as YES/NO/N_A, persists answers in RUNTIME DB, supports save/reload, and provides completion state.

## Database Schema

### Migration: `migrations/2026_01_14_assessment_question_responses.sql`

**Tables Created:**
1. `assessment_question_responses`
   - Stores individual question responses
   - Fields: `id`, `assessment_id`, `question_code`, `response_enum` (YES/NO/N_A), `detail` (JSONB), `updated_at`
   - Unique constraint on `(assessment_id, question_code)`
   - Index on `assessment_id`

2. `assessment_status`
   - Tracks assessment completion state
   - Fields: `assessment_id` (PK), `status` (DRAFT/IN_PROGRESS/COMPLETE), `updated_at`
   - Status transitions: DRAFT → IN_PROGRESS (on first save) → COMPLETE (manual)

## API Routes

### 1. `/api/runtime/assessments/[assessmentId]/responses`
- **GET**: Returns all responses for an assessment
- **PUT**: Upserts responses (marks assessment as IN_PROGRESS on first save)
  - Body: `{ items: [{ question_code, response_enum, detail? }] }`

### 2. `/api/runtime/assessments/[assessmentId]/status`
- **GET**: Returns current assessment status
- **PUT**: Updates assessment status
  - Body: `{ status: "DRAFT" | "IN_PROGRESS" | "COMPLETE" }`

## UI Component

### `/app/assessments/[assessmentId]/runner/page.tsx`

**Features:**
- Loads question universe from `/api/runtime/assessments/[assessmentId]/question-universe`
- Loads question texts from `/api/runtime/questions` (BASE + EXPANSION)
- Displays questions in `order_index` order
- Shows question code, layer, group metadata
- YES/NO/N_A radio buttons for each question
- Auto-saves on answer change
- Progress counter (answered / total)
- "Mark Complete" button
- Status indicator

**State Management:**
- Fetches universe, question texts, responses, and status on mount
- Updates local state optimistically on answer change
- Persists to database via API

## Usage

1. **Apply Migration:**
   ```bash
   # Via Supabase SQL Editor (recommended)
   # Copy contents of migrations/2026_01_14_assessment_question_responses.sql
   # Run in RUNTIME project SQL Editor
   
   # OR via Python script (if configured)
   python tools/runtime/run_migration.py migrations/2026_01_14_assessment_question_responses.sql
   ```

2. **Create Assessment:**
   - Use existing assessment creation flow
   - Ensure `compose_assessment_universe.py` has been run to populate `assessment_question_universe`

3. **Access Runner:**
   - Navigate to `/assessments/[assessmentId]/runner`
   - Questions will load in order from `assessment_question_universe`
   - Answer questions using YES/NO/N_A radio buttons
   - Answers auto-save on change
   - Click "Mark Complete" when finished

## Verification Checklist

- [ ] Migration applied successfully
- [ ] Create an assessment with modules selected
- [ ] Navigate to `/assessments/<assessmentId>/runner`
- [ ] Confirm questions render in `order_index` order
- [ ] Answer 3 questions; refresh page; confirm answers persist
- [ ] Click "Mark Complete"; refresh; status remains COMPLETE
- [ ] Check database: `assessment_question_responses` has saved data
- [ ] Check database: `assessment_status` shows correct status

## Constraints Enforced

✅ Uses frozen `assessment_question_universe` as source of truth  
✅ No exclusions, no learning, no SAFE references  
✅ No baseline rewrites  
✅ Simple YES/NO/N_A responses only  
✅ All data persisted in RUNTIME DB  
✅ Status tracking separate from responses  

## Next Steps (Future Phases)

- Add checklist/components support (store in `detail` JSONB)
- Add notes/evidence fields
- Add question grouping/headers in UI
- Add progress visualization
- Add export functionality
- Add validation rules (e.g., required questions before completion)


