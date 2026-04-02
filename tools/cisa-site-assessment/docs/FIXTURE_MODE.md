# Fixture Mode Implementation

## Overview

The UI is now fully wired to use fixture data through a centralized data provider. This allows the PSA workflow to be tested end-to-end without requiring a backend server.

## Environment Variable

Set `NEXT_PUBLIC_USE_FIXTURES=true` in `.env.local` to enable fixture mode.

Default: `true` (for local development)

## Data Provider

**Location:** `src/data/psaDataProvider.ts`

**Exports:**
- `getAssessments()` - Get list of all assessments
- `getAssessmentDetail(assessmentId)` - Get assessment context header
- `getRequiredElements(assessmentId)` - Get ordered questions
- `getResponses(assessmentId)` - Get saved responses
- `saveResponse(assessmentId, elementId, response)` - Save a response
- `getScoringResult(assessmentId)` - Get scoring results

**Behavior:**
- If `NEXT_PUBLIC_USE_FIXTURES=true`: Reads from `app/lib/fixtures/*.json` via API route
- If `NEXT_PUBLIC_USE_FIXTURES=false`: Calls backend API endpoints

## Fixture Files

Fixtures are located in `app/lib/fixtures/`:

- `assessments.json` - List of all assessments
- `assessment_detail_{scenario}.json` - Assessment context headers
- `required_elements_{scenario}.json` - Questions (new structure)
- `responses_{scenario}.json` - Saved responses (new structure)
- `scoring_result_{scenario}.json` - Scoring results

**Scenarios:**
- `baseline` - Baseline-only assessment
- `healthcare` - Healthcare sector assessment
- `aviation` - Transportation/Aviation assessment
- `education` - Education sector assessment (when generated)

## UI Pages Updated

### 1. Assessment List (`/assessments`)
- Uses `getAssessments()`
- Displays all assessments from fixtures
- Links to execution page

### 2. Assessment Execution (`/assessments/[assessmentId]`)
- Uses `getAssessmentDetail()`, `getRequiredElements()`, `getResponses()`
- Merges responses into elements
- Uses `saveResponse()` for auto-save
- Renders questions grouped by layer (Baseline / Sector / Subsector)
- Radio buttons: YES / NO / N/A only

### 3. Assessment Results (`/assessments/[assessmentId]/results`)
- Uses `getScoringResult()`
- Read-only display
- Hides sector section if sector block is null
- Does NOT recompute percentages

## Backward Compatibility

The provider handles both old and new fixture structures:

**Old Structure:**
```json
{
  "metadata": { ... },
  "required_elements": [ ... ]
}
```

**New Structure:**
```json
{
  "assessment_id": "...",
  "name": "...",
  "facility": { ... },
  "status": "..."
}
```

The provider automatically transforms old structure to new structure.

## In-Memory State

When in fixture mode:
- Responses are saved to in-memory state (client-side)
- State persists during the browser session
- State resets on page reload (by design)
- Purpose is flow testing, not durability

## API Route

**Location:** `app/api/fixtures/[filename]/route.ts`

Serves fixture JSON files to client-side components. Includes security checks:
- Only serves `.json` files
- Prevents directory traversal
- Returns 404 for missing files

## Acceptance Criteria

With `NEXT_PUBLIC_USE_FIXTURES=true`:

✅ App loads with no backend running  
✅ `/assessments` shows 3 assessments  
✅ Execution page renders questions in correct order  
✅ YES / NO / N/A selections persist in-session  
✅ Results page renders without errors  
✅ No direct API calls in UI components  
✅ All data access goes through provider  

## Switching to Real Backend

To use real backend:
1. Set `NEXT_PUBLIC_USE_FIXTURES=false` in `.env.local`
2. Restart Next.js server
3. Ensure backend API endpoints are implemented
4. UI behavior remains unchanged (only data source changes)

## Notes

- UI does NOT calculate scores
- UI does NOT infer applicability
- UI does NOT filter elements
- All logic is upstream (backend/fixtures)
- Missing fields are treated as contract violations
