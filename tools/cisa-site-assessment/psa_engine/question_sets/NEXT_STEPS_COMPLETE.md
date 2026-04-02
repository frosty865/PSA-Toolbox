# PHASE 1 Next Steps - COMPLETE

**Date**: 2026-01-14  
**Status**: ✅ COMPLETE

## Completed Tasks

### 1. ✅ Migration Created
- **File**: `migrations/2026_01_14_baseline_core_modules.sql`
- **Status**: Ready to apply (use Supabase SQL Editor for RUNTIME project)
- **Tables Created**:
  - `assessment_definitions` - Stores baseline_core_version + modules
  - `assessment_question_universe` - Frozen question order

### 2. ✅ Composition Tool Created
- **File**: `tools/runtime/compose_assessment_universe.py`
- **Status**: Ready to use
- **Usage**: Called automatically when assessment is created

### 3. ✅ UI Updated - Module Selector
- **File**: `app/components/CreateAssessmentDialog.tsx`
- **Status**: Updated with module checkboxes
- **Features**:
  - Shows all 5 available modules
  - Multi-select checkboxes
  - Sends selected modules to API

### 4. ✅ API Updated - Assessment Creation
- **File**: `app/api/runtime/assessments/route.ts`
- **Status**: Updated to accept modules and compose universe
- **Features**:
  - Accepts `modules` array in POST body
  - Calls `compose_assessment_universe.py` after assessment creation
  - Handles errors gracefully (doesn't fail if composition fails)

### 5. ✅ Question Universe API Endpoint
- **File**: `app/api/runtime/assessments/[assessmentId]/question-universe/route.ts`
- **Status**: Created
- **Purpose**: Returns ordered question universe for an assessment
- **Returns**: Questions ordered by `order_index` with layer and metadata

## Remaining Tasks

### 1. ⚠️ Apply Migration
**Action Required**: Apply migration to RUNTIME database
- Open Supabase SQL Editor for RUNTIME project
- Run: `migrations/2026_01_14_baseline_core_modules.sql`
- Verify tables created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('assessment_definitions', 'assessment_question_universe');
  ```

### 2. ⚠️ Update Question Display
**Action Required**: Update assessment page to use `order_index`
- **File**: `app/assessments/[assessmentId]/page.tsx`
- **Change**: Fetch from `/api/runtime/assessments/[id]/question-universe` instead of `/required_elements`
- **Display**: Use `order_index` for ordering, show group headers from `meta.group` for BASELINE_CORE

### 3. ⚠️ Test Module Selection
**Action Required**: Test the full flow
- Create new assessment with modules selected
- Verify universe is composed correctly
- Verify questions display in correct order with group headers

## Migration Instructions

### For RUNTIME Database (Supabase)

1. Go to: https://supabase.com/dashboard/project/wivohgbuuwxoyfyzntsd/sql
2. Copy contents of `migrations/2026_01_14_baseline_core_modules.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'assessment_definitions' 
   AND column_name IN ('baseline_core_version', 'modules');
   ```

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Create assessment with no modules → baseline core only
- [ ] Create assessment with modules → baseline core + selected modules
- [ ] Verify question universe API returns ordered questions
- [ ] Verify UI displays questions in correct order
- [ ] Verify group headers appear for BASELINE_CORE questions


