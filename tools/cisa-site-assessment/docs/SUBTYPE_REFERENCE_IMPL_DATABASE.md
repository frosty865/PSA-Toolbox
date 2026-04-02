# Subtype Reference Implementation Database System

**Date:** 2026-01-24  
**Status:** Implementation Complete

## Overview

This implementation replaces the "Meaning not yet derived for this question" system with a database-backed, subtype-driven reference implementation system. Questions with `discipline_subtype_id` now display canonical reference implementations stored in the database, with graceful fallback to subtype doctrine when no reference implementation exists.

## Database Changes

### Migration: `db/migrations/20260124_add_discipline_subtype_reference_impl.sql`

Creates `discipline_subtype_reference_impl` table:
- Primary key: `discipline_subtype_id` (UUID, FK to `discipline_subtypes.id`)
- `reference_impl` (JSONB) - Stores canonical reference implementation payload
- `created_at`, `updated_at` timestamps
- GIN index on `reference_impl` for efficient JSON queries
- Auto-update trigger on `updated_at`

### Migration: `db/migrations/20260124_seed_reference_impl_rekeying_procedures.sql`

Seeds the first canonical reference implementation:
- `discipline_subtype_id`: `20d11544-f449-46f2-9aa8-39cfcf8a134b` (Key Control — Rekeying Procedures)
- Contains sections 1-4:
  - Section 1: Baseline existence question with YES/NO/N_A clarification
  - Section 2: What "Right" Looks Like (recognition-based bullets)
  - Section 3: Descriptive branching (YES-only questions)
  - Section 4: OFC trigger notes (non-user-facing)

## API Routes

### GET `/api/reference/discipline-subtypes/[subtypeId]/reference-impl`

**File:** `app/api/reference/discipline-subtypes/[subtypeId]/reference-impl/route.ts`

**Returns:**
- `200`: `{ ok: true, discipline_subtype_id, reference_impl }`
- `404`: `{ ok: false, error: "Reference implementation not found" }`
- `500`: Error response

**Behavior:**
- Reads from `discipline_subtype_reference_impl` table
- Returns 404 if no reference implementation exists (does not invent content)
- Uses existing `getRuntimePool()` pattern

## UI Components

### Updated Components

1. **IntentPanel** (`app/components/IntentPanel.tsx`)
   - Replaced "Meaning not yet derived" with `SubtypeReferenceImplPanel`
   - Added fallback to subtype doctrine (Overview + Field tip + References) when 404
   - Shows "No subtype is assigned" message when `discipline_subtype_id` is missing
   - New props: `subtypeCode`, `subtypeGuidance` for fallback display

2. **QuestionHelp** (`app/components/QuestionHelp.tsx`)
   - Now passes `disciplineSubtypeId`, `subtypeCode`, `subtypeGuidance` to `IntentPanel`
   - Creates minimal intent object if none exists but subtype info is available

3. **SubtypeQuestionBlock** (`app/components/SubtypeQuestionBlock.tsx`)
   - Added `subtype_guidance` to Question interface
   - Passes subtype info to `QuestionHelp` for both depth-1 and depth-2 questions

4. **DisciplineSectionBlock** (`app/components/DisciplineSectionBlock.tsx`)
   - Added `discipline_subtype_id` and `subtype_guidance` to `QuestionDTO` interface
   - Updated all `QuestionHelp` calls to pass subtype information

5. **ReviewerQuestionCard** (`app/components/ReviewerQuestionCard.tsx`)
   - Added `discipline_subtype_id` and `subtype_guidance` to `ReviewerQuestion` interface
   - Passes subtype info to `IntentPanel`

### New Components

1. **SubtypeReferenceImplPanel** (`app/components/SubtypeReferenceImplPanel.tsx`)
   - Fetches reference implementation from database API
   - Displays sections 1-3 (user-facing):
     - Baseline existence question with clarification
     - What "Right" Looks Like (bullets)
     - Descriptive branching (YES-only questions)
   - Section 4 (OFC trigger notes) is non-user-facing and not displayed
   - Handles loading, error, and 404 states
   - Calls `onFallbackToDoctrine` callback when 404

## Behavior Flow

### When Question Has `discipline_subtype_id`:

1. **Intent Tab:**
   - If `intent.meaning_text` exists: Show RAG-derived meaning
   - Else: Show `SubtypeReferenceImplPanel`
     - If 200: Display reference implementation (sections 1-3)
     - If 404: Fallback to subtype doctrine (Overview + Field tip + References) WITHOUT inventing "Right" or "Intent"
     - If error: Show error message

2. **Reference Implementation Tab:**
   - Always shows `SubtypeReferenceImplPanel` (same behavior as Intent tab when no meaning_text)

### When Question Has No `discipline_subtype_id`:

- Shows: "No subtype is assigned to this question, so subtype guidance is unavailable."

## Non-Negotiables Enforced

- ✅ PSA scope only
- ✅ Baseline intent is existence-only (YES/NO/N_A)
- ✅ No maintenance/reliability/adequacy language in baseline intent
- ✅ No assessor enforcement/demands
- ✅ No SAFE references
- ✅ No invented taxonomy
- ✅ "What this question means" shows what "right" looks like (recognition-based)
- ✅ Descriptive branching is YES-only
- ✅ Evidence guidance wording is non-demanding (no "must", "require", "demand")

## Integration Points

### API Responses

Questions from `/api/runtime/assessments/[assessmentId]/questions` should include:
- `discipline_subtype_id` (UUID)
- `subtype_code` (string, for fallback lookup)
- `subtype_guidance` (SubtypeGuidance object, for fallback display)

### Database Seeding

To add more reference implementations:
1. Create seed migration: `db/migrations/YYYYMMDD_seed_reference_impl_<subtype_name>.sql`
2. Insert JSONB payload into `discipline_subtype_reference_impl` table
3. Follow the same structure as Rekeying Procedures seed

## Notes

- Reference implementations are authoritative per subtype
- Fallback to subtype doctrine (Overview + Field tip + References) does NOT invent "Right" or "Intent" sections
- Section 4 (OFC trigger notes) is stored but not displayed to users
- All components gracefully handle missing data (no crashes)
