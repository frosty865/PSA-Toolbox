# Technology Differentiation Layer

## Overview

The Technology Differentiation Layer enables capture of technology-specific metadata (e.g., VSS vs CCTV, analog vs IP, VMS vs DVR) without contaminating Baseline v2. This layer is **non-scored** and provides optional technology-specific question overlays and OFC filtering.

## Core Principles

1. **Baseline v2 remains unchanged**: Technology differentiation does not affect baseline scoring, gate ordering, or question content.
2. **Explicit selection required**: Technology types must be explicitly selected by users; no inference is performed.
3. **Field-verifiable**: All technology metadata must be observable and verifiable in the field.
4. **Non-implementation**: Technology notes and overlays must not include "how to implement" language.

## Data Model

### `assessment_technology_profiles`

Stores technology differentiation metadata per assessment and subtype.

**Key Fields:**
- `assessment_id`: Links to assessment
- `discipline_code`, `subtype_code`: Identifies the subtype
- `tech_family`: High-level category (e.g., "VIDEO_SURVEILLANCE")
- `tech_type`: Specific type (e.g., "CCTV_ANALOG", "IP_CAMERA_VMS")
- `tech_variant`: Optional variant details (e.g., "coax + DVR")
- `confidence`: OBSERVED | VERIFIED | REPORTED

**Constraints:**
- Unique on `(assessment_id, subtype_code, tech_type)` - allows multiple types for hybrid systems
- Cascade delete when assessment is deleted

### `tech_question_templates`

Stores technology-specific overlay questions that appear only when matching tech_type is selected.

**Key Fields:**
- `tech_type`: Technology type this question applies to
- `discipline_code`, `subtype_code`: Subtype context
- `question_text`: Observable question (PSA scope only)
- `response_enum`: YES/NO/N_A
- `overlay_level`: Always "TECH" (distinguishes from baseline)

**Behavior:**
- Questions are optional and do NOT affect baseline scoring
- Shown only when matching `tech_type` is selected
- Tracked separately in `tech_question_responses`

### `tech_question_responses`

Stores responses to technology overlay questions.

**Key Fields:**
- `assessment_id`: Links to assessment
- `tech_question_template_id`: Links to overlay question
- `response`: YES | NO | N_A
- `notes`: Optional notes

**Behavior:**
- Stored separately from baseline responses
- Do NOT affect baseline scoring
- Can optionally be scored as "tech coverage" separately

## API Endpoints

### GET `/api/runtime/assessments/[id]/tech-profiles`

Returns all technology profiles for an assessment.

**Response:**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "assessment_id": "uuid",
      "discipline_code": "string",
      "subtype_code": "string",
      "tech_family": "VIDEO_SURVEILLANCE",
      "tech_type": "CCTV_ANALOG",
      "tech_variant": "coax + DVR",
      "confidence": "OBSERVED",
      "notes": "string",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

### PUT `/api/runtime/assessments/[id]/tech-profiles`

Upserts technology profiles for an assessment.

**Request Body:**
```json
{
  "profiles": [
    {
      "discipline_code": "string",
      "subtype_code": "string",
      "tech_family": "VIDEO_SURVEILLANCE",
      "tech_type": "CCTV_ANALOG",
      "tech_variant": "optional",
      "confidence": "OBSERVED",
      "notes": "optional"
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
  "saved_profiles": [...]
}
```

### DELETE `/api/runtime/assessments/[id]/tech-profiles?subtype_code=X&tech_type=Y`

Deletes a specific technology profile.

## UI Components

### Technology Profile Selector

Located in the Assessment Detail page, per discipline/subtype section.

**Features:**
- Multi-select chips for tech_type (supports hybrid systems)
- Confidence selector (OBSERVED/VERIFIED/REPORTED)
- Optional variant and notes fields
- Autosave on changes

**Display:**
- Technology badges shown next to subtype headings
- Included in admin/exports metadata sections

### Technology Overlay Questions

**Display Rules:**
1. Baseline gates always show first (unchanged)
2. If tech_type is selected, show matching overlay questions under "Technology-Specific Checks" section
3. Overlay questions are optionally answered
4. Tracked separately from baseline responses

## OFC Differentiation

### Extended OFC Templates

OFC templates can optionally include `applicable_tech_types` array. The database migration adds this column to the `ofc_templates` table if it exists.

**For JSON-based OFC templates** (e.g., `public/doctrine/ofc_templates_baseline_v1.json`):
- The `applicable_tech_types` field can be added to the JSON structure
- OFC regeneration script (`regenerate_ofcs_baseline_v2.py`) should filter templates by tech type when selecting OFCs
- Example structure:
```json
{
  "required_element_code": "BASE-001",
  "layer": "baseline",
  "applicable_tech_types": ["CCTV_ANALOG", "CCTV_DIGITAL_DVR"],
  "ofc_text": "..."
}
```

**For database-based OFC templates:**
- The `applicable_tech_types` column (text array) is added by migration
- If present, OFC only attaches when assessment has matching tech_type
- If NULL, OFC applies universally (default)

**Behavior:**
- If `applicable_tech_types` is present, OFC only attaches when assessment has matching tech_type
- If `applicable_tech_types` is NULL, OFC applies universally (default)
- Does NOT change baseline triggers; only refines which OFC template is chosen
- Implementation in `regenerate_ofcs_baseline_v2.py` should:
  1. Load tech profiles for the assessment
  2. When selecting OFC templates, filter by `applicable_tech_types` if present
  3. If template has `applicable_tech_types`, only use if assessment has matching tech_type

## Allowed Technology Types

### Video Surveillance Systems (VIDEO_SURVEILLANCE)

- `CCTV_ANALOG`: Analog CCTV systems
- `CCTV_DIGITAL_DVR`: Digital DVR-based systems
- `IP_CAMERA_VMS`: IP camera with VMS
- `HYBRID_ANALOG_IP`: Hybrid analog/IP systems
- `CLOUD_MANAGED_VIDEO`: Cloud-managed video solutions
- `MOBILE_TRAILER_SYSTEM`: Mobile/trailer-mounted systems
- `BODY_WORN_VIDEO`: Body-worn video (if in VSS scope)

**Tech Variant Examples:**
- "coax + DVR"
- "ONVIF VMS"
- "managed service"
- No vendor names unless explicitly allowed

## Constraints & Guards

1. **Baseline questions remain unchanged**: Gate ordering, scoring, and question content are unaffected
2. **No inference**: Technology selection must be explicit; no automatic detection
3. **Observable only**: Tech overlays must be field-observable and PSA-scope
4. **No implementation language**: Tech notes and overlays must not include "how to implement" guidance
5. **Production queries**: All queries exclude QA assessments as before

## Acceptance Criteria

✅ User can mark VSS subtype as CCTV_ANALOG vs IP_CAMERA_VMS vs HYBRID  
✅ Baseline score is unchanged by tech profile selection  
✅ Tech-specific questions appear only when tech_type is selected  
✅ OFCs can optionally be filtered by tech_type without affecting baseline gating  
✅ All production queries exclude QA assessments as before  
✅ Multiple tech types per subtype supported (hybrid systems)  
✅ Technology profiles are non-scored and tracked separately  

## Database Migration

Run migration: `migrations/20260113_add_technology_differentiation.sql`

This creates:
- `assessment_technology_profiles` table
- `tech_question_templates` table
- `tech_question_responses` table
- Extends `ofc_templates` with `applicable_tech_types` column (if table exists)
- Adds indexes and triggers

## Future Enhancements

- Additional tech families (ACCESS_CONTROL, INTRUSION_DETECTION, etc.)
- Tech-specific scoring (separate from baseline)
- Tech overlay question templates management UI
- OFC template tech applicability management

