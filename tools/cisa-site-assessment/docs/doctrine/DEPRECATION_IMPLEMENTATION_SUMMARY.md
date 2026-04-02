# Deprecation Implementation Summary

## Task Completed: Deprecate Legacy Baseline Required Elements (BASE-0xx)

**Date**: 2025-01-27  
**Status**: ✅ Complete

## What Was Implemented

### 1. Database Migrations (Apply in `psa_engine`)

Created three SQL migration files:

- **`migrations/20250127_add_required_elements_deprecation.sql`**
  - Adds `status`, `deprecated_at`, and `deprecated_reason` columns to `required_elements` table
  - Creates indexes for efficient filtering

- **`migrations/20250127_deprecate_base_0xx_video_surveillance.sql`**
  - Marks BASE-061 through BASE-071 as deprecated for Video Surveillance Systems discipline

- **`migrations/20250127_update_baseline_views_exclude_deprecated.sql`**
  - Provides examples for updating baseline views to exclude deprecated elements

### 2. Frontend Code Changes (Applied in `psa_rebuild`)

- **`lib/deprecatedElements.ts`** (NEW)
  - Helper functions to check and filter deprecated elements
  - `isDeprecatedElement()`, `filterActiveElements()`, `isLegacyBase0xxCode()`

- **`src/data/psaDataProvider.ts`** (UPDATED)
  - OFC generation logic now skips deprecated elements
  - Added logging for skipped OFC generation

- **`app/api/required-elements/route.ts`** (UPDATED)
  - Filters out deprecated elements from active views
  - Only returns active elements to frontend

- **`app/api/assessments/[assessmentId]/ofcs/route.ts`** (UPDATED)
  - Added safety filter to remove OFCs from deprecated elements
  - Defensive measure in case backend hasn't been updated

### 3. Documentation

- **`docs/doctrine/DEPRECATED_BASELINE_ELEMENTS.md`**
  - Comprehensive documentation of the deprecation
  - Explains why, what changed, and what remains intact

- **`docs/doctrine/BACKEND_OFC_DEPRECATION_GUIDE.md`**
  - Implementation guide for backend OFC generation logic
  - Code examples and validation steps

## Next Steps

### For `psa_engine` Repository:

1. **Apply Database Migrations**:
   ```bash
   # Run in order:
   psql -d your_database -f migrations/20250127_add_required_elements_deprecation.sql
   psql -d your_database -f migrations/20250127_deprecate_base_0xx_video_surveillance.sql
   ```

2. **Update OFC Generation Logic**:
   - Follow instructions in `docs/doctrine/BACKEND_OFC_DEPRECATION_GUIDE.md`
   - Add status check guard in OFC generation module
   - Update database queries to filter by `status = 'active'`

3. **Update Baseline Views**:
   - Review `migrations/20250127_update_baseline_views_exclude_deprecated.sql`
   - Update your baseline views to include `WHERE status = 'active'`

### For `psa_rebuild` Repository:

✅ **All changes are complete and ready to deploy**

## Validation Checklist

After applying all changes:

- [ ] Database migrations applied successfully
- [ ] BASE-061 through BASE-071 marked as deprecated in database
- [ ] Backend OFC generation skips deprecated elements
- [ ] Frontend filters deprecated elements from required elements API
- [ ] OFC API route filters deprecated elements (safety measure)
- [ ] Baseline views exclude deprecated elements
- [ ] Historical assessments still load correctly
- [ ] No new OFCs generated for BASE-061 through BASE-071
- [ ] Baseline Questions v1 continue to work normally

## Files Created/Modified

### Created:
- `migrations/20250127_add_required_elements_deprecation.sql`
- `migrations/20250127_deprecate_base_0xx_video_surveillance.sql`
- `migrations/20250127_update_baseline_views_exclude_deprecated.sql`
- `lib/deprecatedElements.ts`
- `docs/doctrine/DEPRECATED_BASELINE_ELEMENTS.md`
- `docs/doctrine/BACKEND_OFC_DEPRECATION_GUIDE.md`
- `docs/doctrine/DEPRECATION_IMPLEMENTATION_SUMMARY.md` (this file)

### Modified:
- `src/data/psaDataProvider.ts`
- `app/api/required-elements/route.ts`
- `app/api/assessments/[assessmentId]/ofcs/route.ts`

## Important Notes

1. **No Data Deletion**: Deprecated elements remain in the database for historical traceability
2. **Historical Assessments**: All existing assessments continue to work
3. **Extensibility**: This pattern can be extended to other disciplines if needed
4. **Backward Compatibility**: Legacy checks are included as fallback if status field is not populated

## Support

For questions or issues:
- Review `docs/doctrine/DEPRECATED_BASELINE_ELEMENTS.md` for detailed information
- Check `docs/doctrine/BACKEND_OFC_DEPRECATION_GUIDE.md` for backend implementation
- Verify database migrations have been applied
- Check logs for skipped OFC generation messages

---

**Implementation Complete**: 2025-01-27

