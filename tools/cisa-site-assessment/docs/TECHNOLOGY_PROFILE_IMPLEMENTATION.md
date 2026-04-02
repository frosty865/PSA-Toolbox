# Technology Profile Implementation

## Overview

Technology profiles provide metadata-only technology selection per assessment subtype. This mechanism:
- Allows users to select one or more technology types per subtype (hybrid allowed)
- Drives conditional question variants (if variants exist)
- Stores selections as metadata for reporting/filtering
- **Does NOT change baseline scoring**
- **Does NOT trigger OFCs**
- **Is NOT a question answer**

## Model Rules (Non-Negotiable)

1. Assessment methodology records only: question responses in `["YES","NO","N_A"]`
2. **No confidence fields** (Observed/Verified/Reported) anywhere in assessment workflow
3. Conditional questioning allowed ONLY via:
   - Deterministic gates
   - Deterministic "technology profile" selection
4. Technology profile selection:
   - NOT a question answer
   - NOT an OFC trigger
   - MUST NOT affect baseline scoring
5. Baseline remains sector-agnostic

## Database Schema

### `assessment_technology_profiles`

**Table:** `public.assessment_technology_profiles`

**Columns:**
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `assessment_instance_id` UUID NOT NULL (FK to assessment_instances)
- `discipline_subtype_id` UUID NOT NULL (FK to discipline_subtypes)
- `technology_code` TEXT NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `notes` TEXT NULL

**Constraints:**
- UNIQUE(assessment_instance_id, discipline_subtype_id, technology_code)
- FK: assessment_instance_id → assessment_instances(id) ON DELETE CASCADE
- FK: discipline_subtype_id → discipline_subtypes(id) ON DELETE RESTRICT

**Indexes:**
- `idx_atp_assessment_instance_id` on assessment_instance_id
- `idx_atp_subtype_id` on discipline_subtype_id
- `idx_atp_technology_code` on technology_code

**Important:** This table is metadata only. No existing assessment scoring queries should include this table.

## API Endpoints

### GET `/api/runtime/assessments/[id]/technology-profiles`

Returns technology profile selections for an assessment.

**Response:**
```json
{
  "assessment_id": "uuid",
  "assessment_instance_id": "uuid",
  "selections": [
    {
      "discipline_subtype_id": "uuid",
      "technology_code": "CCTV_ANALOG",
      "notes": "optional notes"
    }
  ]
}
```

### PUT `/api/runtime/assessments/[id]/technology-profiles`

Updates technology profile selections for a subtype.

**Request Body:**
```json
{
  "discipline_subtype_id": "uuid",
  "technology_codes": ["CCTV_ANALOG", "IP_CAMERA_VMS"],
  "notes": "optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "discipline_subtype_id": "uuid",
  "selections": [
    {
      "technology_code": "CCTV_ANALOG",
      "notes": "optional notes"
    }
  ]
}
```

**Hard Guard:** Rejects any confidence-related fields (observed/verified/reported) with 400 error.

## Questions API Enhancement

### GET `/api/runtime/assessments/[id]/questions`

Response now includes for each question:
- `technology_tags`: string[] (default [])
- `variant_key`: string | null (default null)

**Rules:**
- Baseline questions always return `technology_tags=[]` and `variant_key=null` unless variant tagging exists in data model
- Only expose what exists in stored baseline_v2 registry or known metadata fields
- Do NOT infer tags

## UI Components

### TechnologyProfilePanel

**Location:** Rendered once per subtype group, above gate-ordered questions.

**Features:**
- Multi-select chips/toggles for technology types
- "Notes (optional)" text area
- Autosave with debounce (same pattern as responses autosave)
- Always visible (even if CONTROL_EXISTS = NO)
- Does not block submission

**Technology Types:**
- Loaded from `app/lib/technology/technology_types.ts`
- Discipline/subtype-scoped (no cross-discipline leakage)
- If no catalog entry for subtype: shows "No technology profile options for this subtype yet"

## Technology Types Mapping

**File:** `app/lib/technology/technology_types.ts`

**Structure:**
- Static mapping: `discipline_subtype_id` → `TechnologyType[]`
- Function: `getTechnologyTypes(discipline_id, discipline_subtype_id)`
- Initially populated with EMPTY arrays for all subtypes
- TODO: Types will be curated subtype-by-subtype

**Example:**
```typescript
const TECHNOLOGY_TYPES_MAP: TechnologyTypesMap = {
  "subtype-uuid-1": [
    { code: "CCTV_ANALOG", label: "CCTV Analog" },
    { code: "IP_CAMERA_VMS", label: "IP Camera VMS" }
  ]
};
```

## Migration

**File:** `migrations/20260113_add_assessment_technology_profiles.sql`

Run this migration to create the new table structure aligned with VOFC Engine model methodology.

**Note:** This replaces the previous `assessment_technology_profiles` table that used:
- `assessment_id` (now `assessment_instance_id`)
- `subtype_code` (now `discipline_subtype_id`)
- `tech_type` (now `technology_code`)
- Removed: `tech_family`, `tech_variant`, `evidence_basis`, `confidence`

## Hard Guards

1. **No Confidence Fields:** API endpoints reject any request containing `confidence`, `observed`, `verified`, or `reported` fields
2. **No Scoring Impact:** Technology profiles are excluded from all baseline scoring queries
3. **No OFC Triggers:** Technology selection does not affect OFC generation
4. **Discipline Scoping:** Technology types are discipline/subtype-scoped (no cross-discipline leakage)

## Acceptance Criteria

✅ No Observed/Verified/Reported appears anywhere in UI or DB  
✅ Technology profile panel shown at subtype level (not per-question)  
✅ Multi-select allows hybrid systems  
✅ Autosave with debounce  
✅ Always visible (even if gates are skipped)  
✅ Does not block submission  
✅ Technology types are discipline/subtype-scoped  
✅ No changes to baseline scoring  
✅ No changes to OFC triggers  
✅ Questions API includes technology_tags and variant_key  

