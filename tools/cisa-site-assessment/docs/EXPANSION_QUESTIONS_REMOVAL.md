# Expansion Questions Removal

**Date:** 2026-01-16  
**Status:** ✅ **COMPLETE**

---

## Summary

All expansion questions have been removed from the CORPUS database.

---

## Actions Taken

### 1. Deleted Expansion Questions
- **Table:** `public.expansion_questions` (CORPUS database)
- **Count Removed:** 80 expansion questions
- **Status:** ✅ **COMPLETE**

### 2. Cleaned Up Related Records
- **Table:** `public.corpus_candidate_question_links`
- **Records Removed:** 112 expansion question links (where `universe = 'EXPANSION'`)
- **Status:** ✅ **COMPLETE**

---

## Scripts Created

### 1. SQL Migration
- **File:** `db/migrations/corpus/2026_01_16_remove_all_expansion_questions.sql`
- **Purpose:** SQL script to remove expansion questions (can be run manually if needed)

### 2. Node.js Script
- **File:** `scripts/remove_expansion_questions_standalone.js`
- **Usage:** 
  - Dry run: `node scripts/remove_expansion_questions_standalone.js --dry-run`
  - Execute: `node scripts/remove_expansion_questions_standalone.js`
- **Status:** ✅ **EXECUTED SUCCESSFULLY**

---

## Impact

### Removed Data
- ❌ All 80 expansion questions from CORPUS database
- ❌ All 112 expansion question links from `corpus_candidate_question_links`

### Preserved Data
- ✅ Baseline questions (unchanged)
- ✅ Assessment data (unchanged)
- ✅ OFC library (unchanged)
- ✅ All other CORPUS tables (unchanged)

### API Behavior
- `/api/runtime/questions?universe=EXPANSION` will now return empty array
- `/api/runtime/questions?universe=ALL` will return only baseline questions
- Expansion question endpoints will return empty results

---

## Verification

### Database State
- ✅ `expansion_questions` table is now empty (0 rows)
- ✅ `corpus_candidate_question_links` has no EXPANSION universe records
- ✅ No orphaned references remain

### API Endpoints
- ✅ `/api/runtime/questions` - Returns only baseline questions
- ✅ `/api/runtime/assessments/[assessmentId]/expansion-questions` - Returns empty array
- ✅ `/api/runtime/assessments/[assessmentId]/expansion-responses` - Still functional (handles empty state)

---

## Notes

- Expansion questions were stored in the CORPUS database (`public.expansion_questions`)
- Related question links in `corpus_candidate_question_links` were also cleaned up
- The table structure remains intact - only data was removed
- If expansion questions are needed in the future, they can be re-imported

---

**END OF REMOVAL**
