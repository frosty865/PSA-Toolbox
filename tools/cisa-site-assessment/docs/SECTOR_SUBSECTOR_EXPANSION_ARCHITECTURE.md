# Sector/Subsector Expansion Architecture

## Overview

The Sector/Subsector Expansion Infrastructure provides an **additive-only** layer for sector and subsector-specific questions beyond the universal baseline. Expansion questions are explicitly applied, versioned, and reported separately from baseline.

## Core Principles

### 1. Base vs Expansion Separation (Non-Negotiable)

- **Baseline questions are universal** - The 36 primary baseline questions apply to all assessments regardless of sector/subsector
- **Expansion questions are additive** - Additional questions that appear only when expansion profiles are explicitly applied
- **No contamination** - Expansion endpoints must never write to baseline tables or accept baseline question IDs
- **Separate scoring** - Baseline and expansion scores are calculated and reported separately (no composite score in Phase 1)

### 2. Explicit Application Only

- **No auto-application** - Profiles are never automatically applied based on assessment sector/subsector fields
- **Manual selection** - Users must explicitly select and apply expansion profiles via the UI
- **Idempotent application** - Applying the same profile multiple times results in a single application record

### 3. Profile Lifecycle

Profiles have three states:

- **DRAFT**: Profile is being developed, not yet available for application
- **ACTIVE**: Profile is available and can be applied to assessments
- **RETIRED**: Profile is no longer used but retained for historical reference

### 4. Versioning + Effective Date

- **Version**: Integer > 0, increments when profile content changes
- **Effective Date**: Date when this profile version becomes effective
- **Audit Trail**: Version and effective_date enable tracking of profile evolution over time

### 5. Why Expansion Never Modifies Baseline

- **Baseline is frozen** - Baseline v2 questions are immutable and universal
- **Expansion is contextual** - Sector/subsector questions address context-specific requirements
- **Separation of concerns** - Baseline compliance vs. sector-specific considerations are distinct
- **Future-proofing** - New technologies/policies enter via expansion questions, not baseline changes

## Data Model

### Tables

1. **`sector_expansion_profiles`**
   - Registry of expansion profiles
   - One profile per sector/subsector/version combination
   - Status controls availability

2. **`assessment_expansion_profiles`**
   - Explicit application of profiles to assessments
   - Many-to-many relationship (assessment can have multiple profiles)
   - Tracks when and by whom profiles were applied

3. **`expansion_questions`**
   - Question templates scoped to profiles and subtypes
   - Links to PSA taxonomy via `subtype_code`
   - Status: ACTIVE or RETIRED

4. **`assessment_expansion_responses`**
   - Responses to expansion questions
   - Separate from baseline responses
   - Never affects baseline scoring

## API Endpoints

### Public Endpoints

- `GET /api/runtime/expansion-profiles` - List available profiles (filtered by status, sector, subsector)
- `GET /api/runtime/assessments/[id]/expansion-profiles` - Get profiles applied to assessment
- `POST /api/runtime/assessments/[id]/expansion-profiles` - Apply profiles to assessment
- `GET /api/runtime/assessments/[id]/expansion-questions` - Get expansion questions for assessment
- `GET /api/runtime/assessments/[id]/expansion-responses` - Get expansion responses
- `PUT /api/runtime/assessments/[id]/expansion-responses` - Save expansion responses
- `GET /api/runtime/assessments/[id]/results` - Get split baseline + expansion results

### Admin Endpoints

- `POST /api/runtime/admin/expansion-profiles` - Create/update expansion profiles

## Guardrails

### 1. No Baseline Contamination

**Hard Rule**: Expansion endpoints must reject any payload containing:
- Baseline question IDs (patterns: `BASE-\d+`, `baseline_*`)
- Baseline field names (`element_id`, `element_code`, `capability_dimension`, `mapped_gate`, etc.)
- Baseline response table writes

**Implementation**: `assertNoBaselineContamination()` in `app/lib/expansion/validation.ts`

### 2. Explicit Application Only

**Hard Rule**: No route should auto-apply profiles based on:
- Assessment `sector_id` or `sector_name`
- Assessment `subsector_id` or `subsector_name`
- Any other assessment metadata

**Implementation**: Profiles must be explicitly selected and applied via `POST /api/runtime/assessments/[id]/expansion-profiles`

### 3. Reporting Split Enforced

**Hard Rule**: Results endpoint must return baseline and expansion separately:
```json
{
  "baseline": { ... },
  "expansion": { ... }
}
```

**No composite score in Phase 1** - Expansion results are informational only

### 4. Test Assessment Protection

**Hard Rule**: By default, expansion application and responses refuse test assessments unless admin explicitly sets `include_tests=true`

**Test marker rule**: `qa_flag=true OR test_run_id IS NOT NULL OR name LIKE '[QA]%' OR name contains 'test'`

## UI Integration

### Assessment Detail Page

- **Expansion Profile Selector**: Multi-select component to apply profiles
- **Expansion Question List**: Displays expansion questions grouped by profile and subtype
- **Autosave**: Expansion responses are saved automatically on change
- **Clear Labeling**: Expansion section clearly marked as non-baseline

### Admin Page

- **Expansion Profiles Manager**: Create, update, and manage profiles
- **Filtering**: By sector, subsector, status
- **No auto-apply**: Manual profile creation only

## How Future Technologies/Policies Enter

1. **New expansion questions** are added to `expansion_questions` table
2. **Linked to profiles** via `profile_id` and `subtype_code`
3. **Versioned** via `introduced_version` field
4. **Never modify baseline** - Baseline questions remain frozen

## Phase 1 Constraints

- **No content creation** - `expansion_questions` table is empty initially
- **No composite scoring** - Expansion results are informational only
- **No auto-application** - All profile application is manual
- **No baseline changes** - Baseline questions, scoring, and OFC logic unchanged

## Verification Checklist

### Manual Verification

1. ✅ Create an assessment (non-test)
2. ✅ Baseline renders as before
3. ✅ Apply no profiles → expansion section shows "No profiles applied"
4. ✅ Create a profile in admin → appears in selector
5. ✅ Apply profile → expansion question list loads (empty until Phase 2 content)
6. ✅ Results endpoint returns baseline + expansion split
7. ✅ Confirm baseline score unchanged by any expansion action

### Automated Tests (To Be Added)

1. Applying profiles is idempotent
2. Expansion questions empty without profiles
3. Response validation (invalid response not in enum → 400)
4. Question ID not in applied profiles → 400
5. No baseline write (confirm baseline tables unchanged after expansion writes)
6. Results split (baseline present, expansion present and separate)

## Migration Path

### Phase 1 (Current)
- Infrastructure only
- No content
- Manual profile application
- Informational expansion results

### Phase 2 (Future)
- Populate `expansion_questions` with sector/subsector-specific questions
- Content creation via admin UI or seed scripts
- Expansion scoring (if needed)
- Composite reporting (if needed)

## Related Documentation

- `docs/TECH_DIFFERENTIATION.md` - Technology differentiation layer
- `docs/TEST_ASSESSMENT_POLICY.md` - Test assessment exclusion rules
- `docs/baseline/BASELINE_LOCKDOWN.md` - Baseline immutability rules

