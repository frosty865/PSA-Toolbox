# Real Assessment v1 End-to-End Implementation

## Summary

Implemented a complete real assessment workflow that enables users to create assessments, answer Baseline v2 questions (gate-ordered), save progress, submit assessments, and generate OFC nominations.

## File Map

### API Endpoints (New/Modified)

1. **`app/api/runtime/assessments/route.ts`** (Modified)
   - Added `POST` method to create new assessments
   - Creates assessment + assessment_instance
   - Returns `assessment_id` and `assessment_instance_id`
   - Excludes QA assessments by default in GET

2. **`app/api/runtime/assessments/[assessmentId]/route.ts`** (New)
   - `GET` method returns assessment metadata including `assessment_instance_id`

3. **`app/api/runtime/assessments/[assessmentId]/questions/route.ts`** (New)
   - `GET` method returns Baseline v2 questions with gate metadata
   - Filters out retired questions
   - Includes `mapped_gate`, `is_retired` fields

4. **`app/api/runtime/assessments/[assessmentId]/responses/route.ts`** (New)
   - `PUT` method for upserting responses
   - Accepts array of responses
   - Uses `assessment_instance_id` for storage

5. **`app/api/runtime/assessments/[assessmentId]/status/route.ts`** (New)
   - `POST` method for status transitions
   - Validates status transitions (DRAFT → IN_PROGRESS → SUBMITTED → LOCKED)
   - Guardrails: Requires at least one answered question before SUBMITTED

### UI Components (New/Modified)

1. **`app/components/CreateAssessmentDialog.tsx`** (New)
   - Modal dialog for creating new assessments
   - Form with name input
   - Error handling and loading states

2. **`app_broken/assessments/page.tsx`** (Modified)
   - Added "Create New Assessment" button
   - Integrated CreateAssessmentDialog
   - Excludes QA assessments (already handled by API)

3. **`app_broken/assessments/[assessmentId]/page.tsx`** (Modified)
   - Added autosave functionality (saves on answer change)
   - Added submit button and handler
   - Shows submission status and OFC generation link
   - Status badges for IN_PROGRESS and SUBMITTED

4. **`app_broken/assessments/[assessmentId]/components/SubmitLockActions.tsx`** (Modified)
   - Updated to use new `/api/runtime/assessments/[id]/status` endpoint
   - Improved error handling

### Data Provider (Modified)

1. **`app_broken/lib/psaDataProvider.ts`** (Modified)
   - Updated `saveResponse()` to use `PUT /api/runtime/assessments/[id]/responses`
   - Updated `getRequiredElements()` to try new `/questions` endpoint first
   - Added `updateAssessmentStatus()` function

## Database Schema

The implementation works with existing schema:

- **`assessments`** table:
  - `id` (uuid, primary key)
  - `facility_name` (text)
  - `status` (enum: DRAFT, IN_PROGRESS, SUBMITTED, LOCKED)
  - `qa_flag` (boolean, default false) - optional column
  - `created_at`, `updated_at` (timestamptz)

- **`assessment_instances`** table:
  - `id` (uuid, primary key)
  - `template_id` (uuid, fk to assessment_templates)
  - `facility_id` (uuid, fk to assessments.id)
  - `facility_name` (text)
  - `status` (text)

- **`assessment_responses`** table:
  - `id` (uuid, primary key)
  - `assessment_instance_id` (uuid, fk to assessment_instances.id)
  - `question_template_id` (text, references element_code)
  - `response` (text: 'YES', 'NO', 'N_A')
  - `responded_at` (timestamptz)

## API Contract

### POST /api/runtime/assessments
**Request:**
```json
{
  "name": "Facility Name"
}
```

**Response:**
```json
{
  "assessment_id": "uuid",
  "assessment_instance_id": "uuid",
  "name": "Facility Name",
  "status": "DRAFT"
}
```

### GET /api/runtime/assessments/[id]/questions
**Response:**
```json
{
  "questions": [
    {
      "element_id": "BASE-001",
      "element_code": "BASE-001",
      "mapped_gate": "CONTROL_EXISTS",
      "is_retired": false,
      "title": "...",
      "question_text": "...",
      ...
    }
  ],
  "total": 208,
  "metadata": {
    "baseline_version": "Baseline_Questions_v2",
    "frozen": true
  }
}
```

### PUT /api/runtime/assessments/[id]/responses
**Request:**
```json
{
  "responses": [
    {
      "question_template_id": "BASE-001",
      "response": "YES"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "saved": 1,
  "errors": 0,
  "saved_responses": [
    {
      "question_template_id": "BASE-001",
      "response": "YES"
    }
  ]
}
```

### POST /api/runtime/assessments/[id]/status
**Request:**
```json
{
  "status": "SUBMITTED"
}
```

**Response:**
```json
{
  "success": true,
  "assessment_id": "uuid",
  "previous_status": "DRAFT",
  "new_status": "SUBMITTED",
  "updated_at": "2025-01-XX..."
}
```

## Guardrails

1. **Status Transitions**: Only valid transitions allowed:
   - DRAFT → IN_PROGRESS, SUBMITTED
   - IN_PROGRESS → DRAFT, SUBMITTED
   - SUBMITTED → LOCKED
   - LOCKED → (no transitions)

2. **Submission Guardrail**: Cannot submit assessment with zero answered questions. Requires at least one response with value YES, NO, or N_A.

3. **QA Exclusion**: QA assessments (identified by `qa_flag=true` or name prefix `[QA]`) are excluded from production lists by default.

## Manual Test Checklist

### 1. Create Assessment
- [ ] Navigate to `/assessments`
- [ ] Click "Create New Assessment" button
- [ ] Enter assessment name (e.g., "Test Facility")
- [ ] Click "Create Assessment"
- [ ] Verify: Redirected to assessment detail page
- [ ] Verify: Assessment status is DRAFT
- [ ] Verify: Assessment has `qa_flag=false` (check DB if needed)

### 2. Answer Questions (Autosave)
- [ ] On assessment detail page, see Baseline v2 questions
- [ ] Questions are gate-ordered (EXISTS → OPERABLE → RESILIENCE)
- [ ] Answer a question (select YES/NO/N/A)
- [ ] Verify: Response saves automatically (no save button needed)
- [ ] Verify: Saving indicator appears briefly
- [ ] Refresh page
- [ ] Verify: Previous answers are restored

### 3. Gate Ordering
- [ ] Answer CONTROL_EXISTS = YES for a subtype
- [ ] Verify: CONTROL_OPERABLE questions appear
- [ ] Answer CONTROL_OPERABLE = YES
- [ ] Verify: CONTROL_RESILIENCE questions appear
- [ ] Answer CONTROL_EXISTS = NO
- [ ] Verify: OPERABLE and RESILIENCE questions for that subtype are hidden

### 4. Submit Assessment
- [ ] Answer at least one question
- [ ] Click "Submit Assessment" button
- [ ] Verify: Status changes to SUBMITTED
- [ ] Verify: Submit button disappears
- [ ] Verify: Message shows "Assessment Submitted"
- [ ] Try to answer another question
- [ ] Verify: Error message "Assessment is locked or submitted and cannot be modified"

### 5. Submission Guardrail
- [ ] Create new assessment
- [ ] Do NOT answer any questions
- [ ] Try to submit
- [ ] Verify: Error message "Cannot submit: Assessment has no answered questions"

### 6. OFC Generation
- [ ] With a SUBMITTED assessment that has NO responses
- [ ] Run: `cd tools && python regenerate_ofcs_baseline_v2.py`
- [ ] Verify: OFC nominations are created for NO responses
- [ ] Verify: Nominations have `status=SUBMITTED`, `submitted_by=SYSTEM`, `submitted_role=ENGINEER`

### 7. QA Exclusion
- [ ] Navigate to `/assessments`
- [ ] Verify: QA assessments (with `[QA]` prefix or `qa_flag=true`) are NOT shown
- [ ] Verify: Only real assessments appear in list

## Verification Commands

```bash
# Check assessment was created
psql $DATABASE_URL -c "SELECT id, facility_name, status, qa_flag FROM assessments WHERE facility_name = 'Test Facility';"

# Check instance was created
psql $DATABASE_URL -c "SELECT id, facility_id, status FROM assessment_instances WHERE facility_id = '<assessment_id>';"

# Check responses were saved
psql $DATABASE_URL -c "SELECT question_template_id, response FROM assessment_responses WHERE assessment_instance_id = '<instance_id>' LIMIT 5;"

# Check OFC nominations after regeneration
psql $DATABASE_URL -c "SELECT nomination_id, assessment_id, finding_id, status, submitted_by, submitted_role FROM ofc_nominations WHERE assessment_id = '<assessment_id>' ORDER BY submitted_at DESC;"
```

## Notes

- All endpoints use `/api/runtime/assessments` namespace
- Responses are keyed by `assessment_instance_id` in the database
- Gate ordering is handled by the `GateOrderedQuestions` component (already implemented)
- Autosave happens on every answer change (no manual save button)
- Status transitions are enforced server-side
- QA assessments remain excluded from production views by default

