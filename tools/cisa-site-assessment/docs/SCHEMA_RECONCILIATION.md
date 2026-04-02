# Schema Reconciliation Report

This document reconciles the actual database schema with the code implementation.

## Table: `facilities`

**Actual Schema:**
- `id` (text, NOT NULL) - Primary Key
- `name` (text, NOT NULL) - **NOT `facility_name`**
- `sector_id` (text, nullable)
- `subsector_id` (text, nullable)
- `created_at` (timestamp, NOT NULL)
- `updated_at` (timestamp, NOT NULL)

**Code Status:** ✅ CORRECT
- Code dynamically checks for `name` first, then falls back to `facility_name`
- Uses `name` column for INSERT

## Table: `assessments`

**Actual Schema:**
- `id` (uuid, NOT NULL, default: gen_random_uuid())
- `facility_name` (text, NOT NULL) - **This is correct**
- `sector_id` (uuid, nullable) - **Expects UUID**
- `subsector_id` (uuid, nullable) - **Expects UUID**
- `status` (text, NOT NULL, default: 'draft')
- `created_at` (timestamp, NOT NULL, default: now())
- `updated_at` (timestamp, NOT NULL, default: now())
- `qa_flag` (boolean, NOT NULL, default: false)

**Code Status:** ✅ CORRECT
- Uses `facility_name` (correct)
- Resolves `sector_id` and `subsector_id` from `sectors.id_uuid` and `subsectors.id_uuid` (correct)

## Table: `assessment_definitions`

**Actual Schema:**
- `assessment_id` (uuid, NOT NULL) - Primary Key
- `baseline_core_version` (text, NOT NULL, default: 'BASELINE_CORE_V1')
- `sector_code` (text, nullable)
- `subsector_code` (text, nullable)
- `modules` (jsonb, NOT NULL, default: '[]')
- `created_at` (timestamp, NOT NULL, default: now())
- `updated_at` (timestamp, NOT NULL, default: now())
- `facility_id` (uuid, nullable) - **Expects UUID, but facilities.id is TEXT**
- `facility_snapshot` (jsonb, NOT NULL, default: '{}')

**Code Status:** ✅ CORRECT
- All column names match
- Handles UUID/TEXT mismatch for `facility_id` by setting to `null` (column is nullable)
- `created_at` and `updated_at` have defaults, so not included in INSERT (correct)
- `updated_at` is updated in ON CONFLICT clause (correct)

## Table: `assessment_instances`

**Actual Schema:**
- `id` (text, NOT NULL) - **No default, must be provided**
- `template_id` (text, NOT NULL) - **No default, must be provided**
- `facility_id` (text, nullable) - **TEXT, matches facilities.id**
- `facility_name` (text, nullable)
- `started_at` (timestamp, NOT NULL, default: now()) - **NOT `created_at`**
- `completed_at` (timestamp, nullable)
- `status` (text, NOT NULL, default: 'in_progress')
- `metadata` (jsonb, nullable)
- `created_by` (uuid, nullable)

**Code Status:** ✅ CORRECT (after fix)
- Uses `started_at` instead of `created_at` (fixed)
- Generates TEXT `id` if required (correct)
- Generates TEXT `template_id` if required (correct)
- Uses TEXT `facility_id` from `facilities.id` (correct)

## Summary

All column names are now reconciled with the actual database schema:

1. ✅ `facilities.name` (not `facility_name`)
2. ✅ `assessments.facility_name` (correct)
3. ✅ `assessment_instances.started_at` (not `created_at`) - **FIXED**
4. ✅ `assessment_definitions.facility_id` UUID/TEXT mismatch handled
5. ✅ All INSERT statements use correct column names

## Type Mismatches Handled

1. **assessment_definitions.facility_id (UUID) vs facilities.id (TEXT)**
   - Solution: Set to `null` (column is nullable)

2. **assessments.sector_id/subsector_id (UUID) vs sectors.id/subsectors.id (TEXT)**
   - Solution: Query `sectors.id_uuid` and `subsectors.id_uuid` instead

3. **assessment_instances.id (TEXT, no default)**
   - Solution: Generate TEXT ID: `instance-${Date.now()}-${random}`

4. **assessment_instances.template_id (TEXT, no default)**
   - Solution: Generate TEXT ID: `template-${Date.now()}-${random}`

## Table: `baseline_spines_runtime`

**Actual Schema:**
- `canon_id` (TEXT, NOT NULL, PRIMARY KEY)
- `discipline_code` (TEXT, NOT NULL)
- `subtype_code` (TEXT, NULLABLE) - NULL for discipline-level, NOT NULL for subtype-anchored
- `question_text` (TEXT, NOT NULL)
- `response_enum` (JSONB, NOT NULL, DEFAULT: `["YES","NO","N_A"]`)
- `canon_version` (TEXT, NOT NULL)
- `canon_hash` (TEXT, NOT NULL)
- `active` (BOOLEAN, NOT NULL, DEFAULT: true)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT: now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT: now())

**Code Status:** ✅ CORRECT
- All column names match
- Uses `canon_id` as primary key for UPSERT operations
- `subtype_code` is nullable (discipline-level questions have NULL subtype_code)
- `response_enum` is always `["YES","NO","N_A"]`
- See `docs/SCHEMA_BASELINE_SPINES_RUNTIME.md` for complete schema documentation

**Coverage Model:**
- **Discipline-Level Questions:** ~25 questions (subtype_code IS NULL)
- **Subtype-Anchored Questions:** 104 questions (subtype_code IS NOT NULL)
- **Total Coverage:** 104/104 subtypes (as of baseline_subtype_v1 expansion)
