# UI Origin Clarification - Complete

## Summary

Successfully fixed UI confusion between CORPUS review queue and Module Data Management by:
1. Relabeling the review queue page to clearly indicate it's for CORPUS candidates
2. Adding explicit Origin badge column showing `ofc_origin` (CORPUS/MODULE)
3. Renaming "Citation" to "Source" with clarifying tooltip
4. Creating migration to clean misleading citation text

## Changes Made

### 1. API Updates
**File**: `psa_rebuild/app/api/admin/ofcs/review-queue/route.ts`
- ✅ Added `ocq.ofc_origin` to SELECT query (line 168)
- ✅ Added `ofc_origin: row.ofc_origin || 'CORPUS'` to candidate response mapping (line 240)

### 2. UI Updates
**File**: `psa_rebuild/app/admin/ofcs/page.tsx`

#### Interface Update
- ✅ Added `ofc_origin?: 'CORPUS' | 'MODULE'` to `AdminOfc` interface (line 12)

#### Page Header & Description
- ✅ Changed title from "OFC Review Queue" to "CORPUS Review Queue"
- ✅ Updated description: "Review CORPUS candidates mined from sources. Origin controls routing (CORPUS vs MODULE). Citation is descriptive source text."
- ✅ Added prominent note box explaining origin vs citation distinction

#### Table Columns
- ✅ Added "Origin" column header (before Source column)
- ✅ Renamed "Citation" column to "Source" with tooltip: "Source citation text; not candidate origin."
- ✅ Added Origin badge rendering in table body with color coding:
  - CORPUS: Blue badge (`#e0f2fe` background, `#0c4a6e` text)
  - MODULE: Yellow badge (`#fef3c7` background, `#92400e` text)
- ✅ Updated "No citation" text to "No source"

#### Badge Color Function
- ✅ Added `getOriginBadgeColor()` function to style origin badges

### 3. Database Migration
**File**: `db/migrations/20260124_0009_clean_canonical_source_citation_text.sql`
- ✅ Removes trailing ", MODULE" suffix from citation text
- ✅ Only affects citations matching "MODULE RESEARCH" pattern
- ✅ Safe operation (citation_text is metadata only)

**Runner Script**: `tools/run_clean_citation_migration.js`
- ✅ Node.js script to execute the migration
- ✅ Shows before/after citation texts for verification

## Visual Changes

### Before
- Page title: "OFC Review Queue"
- Description: Generic review queue text
- No origin column
- Column labeled "Citation" (confusing)

### After
- Page title: "CORPUS Review Queue" (clear)
- Description: Explicitly states it's for CORPUS candidates
- Origin column with color-coded badges (CORPUS/MODULE)
- Column labeled "Source" with tooltip explaining it's metadata

## Key Points

1. **Origin is Explicit**: Every candidate now shows its `ofc_origin` badge (CORPUS/MODULE)
2. **Citation is Clarified**: Renamed to "Source" with tooltip explaining it's descriptive metadata
3. **Page is Clearly Labeled**: Header and description make it impossible to confuse with Module Data Management
4. **Citation Text Cleaned**: Optional migration removes misleading ", MODULE" suffix

## Usage

### To Run Citation Text Cleanup Migration (Optional)
```bash
node tools/run_clean_citation_migration.js
```

Or manually:
```sql
-- Run against CORPUS database
\i db/migrations/20260124_0009_clean_canonical_source_citation_text.sql
```

### Verification
After migration, verify citation texts:
```sql
SELECT citation_text 
FROM public.canonical_sources
WHERE citation_text ILIKE '%MODULE RESEARCH%'
ORDER BY citation_text;
```

Expected: Citations should no longer end with ", MODULE"

## Done Criteria Status

- ✅ `/admin/ofcs` clearly reads as CORPUS review queue
- ✅ Candidates show an explicit ORIGIN badge (CORPUS/MODULE)
- ✅ "Citation" column is renamed to "Source"
- ✅ No user can misinterpret citation text as origin
- ✅ Optional: canonical source citation text no longer contains misleading ", MODULE" (migration ready)

## Notes

- Nominations (from RUNTIME `ofc_nominations` table) will show "N/A" for origin since they don't have `ofc_origin` (CORPUS-only field)
- Only candidates from `ofc_candidate_queue` will display origin badges
- The origin badge uses the authoritative `ofc_origin` column from the database
- Citation text cleanup is optional - the UI changes alone prevent confusion
