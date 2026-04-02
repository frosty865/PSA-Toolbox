# Source Kind Implementation - Complete

## Summary

Successfully implemented explicit `source_kind` classification for `canonical_sources` table, replacing fragile string matching with a centralized, queryable classification system.

## Migration Status

✅ **Migration Executed**: `20260124_0010_canonical_sources_source_kind.sql`
- Column added: `source_kind` (TEXT, NOT NULL)
- Constraint: CHECK (`source_kind IN ('CORPUS','MODULE_RESEARCH')`)
- Index: `idx_canonical_sources_source_kind`
- Data backfilled:
  - 175 sources → `CORPUS`
  - 1 source → `MODULE_RESEARCH`

## Implementation Components

### 1. Database Schema ✅
- `source_kind` column with CHECK constraint
- Index for fast filtering
- NOT NULL enforcement
- All existing data backfilled

### 2. Centralized Helper ✅
**File**: `tools/corpus/source_kind.py`
- Function: `is_module_research_source(source_kind, title, citation_text)`
- Primary: Uses `source_kind` column (authoritative)
- Fallback: String matching (backward compatibility)

### 3. Mining Script Updated ✅
**File**: `tools/corpus/mine_ofc_candidates_from_chunks_v3.py`
- Imports centralized helper
- SELECT queries include `cs.source_kind`
- Guardrail uses `is_module_research_source()` function
- Default source creation includes `source_kind='CORPUS'`

## Verification Results

### Database State
```
✅ Column exists: source_kind (text, nullable: NO)
✅ CHECK constraint verified
✅ Index verified
✅ Distribution: CORPUS=175, MODULE_RESEARCH=1
✅ No NULL values
```

### MODULE_RESEARCH Source
- Source ID: `063fa244-4745-40ae-b48a-4df3940c5b5d`
- Title: `MODULE RESEARCH`
- Citation: `MODULE RESEARCH, MODULE`
- `source_kind`: `MODULE_RESEARCH`

## Guardrail Behavior

### Default (Blocked)
```bash
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply
# MODULE_RESEARCH sources blocked by source_kind
```

**Detection Logic**:
1. Check `source_kind == 'MODULE_RESEARCH'` (primary)
2. Fallback to string matching if `source_kind` is NULL

### Opt-in (Allowed)
```bash
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --allow-module-research
# MODULE_RESEARCH sources included
```

## Benefits Achieved

1. ✅ **Explicit Classification**: No more fragile string matching
2. ✅ **Centralized Logic**: Single function for all tools
3. ✅ **Queryable**: Can filter by `source_kind` in SQL
4. ✅ **Indexed**: Fast filtering on `source_kind`
5. ✅ **Backward Compatible**: Fallback to string matching if `source_kind` is NULL

## Files Created/Modified

### Created
- `db/migrations/20260124_0010_canonical_sources_source_kind.sql` - Migration
- `tools/corpus/source_kind.py` - Centralized helper
- `tools/run_source_kind_migration.js` - Migration runner
- `tools/verify_source_kind_implementation.js` - Verification script
- `tools/test_source_kind_guardrail.js` - Guardrail test script
- `docs/SOURCE_KIND_CLASSIFICATION.md` - Documentation
- `docs/SOURCE_KIND_IMPLEMENTATION_COMPLETE.md` - This file

### Modified
- `tools/corpus/mine_ofc_candidates_from_chunks_v3.py` - Uses `source_kind` and centralized helper

## Next Steps (Optional)

### Update Other Scripts
Scripts that create `canonical_sources` records should include `source_kind`:
- `tools/corpus_ingest_pdf.py`
- `tools/corpus/ingest_one_document.py`
- `tools/corpus/mine_ofcs_solution_focused.py`

**Pattern**:
```python
INSERT INTO public.canonical_sources 
(title, publisher, source_type, citation_text, source_kind)
VALUES (..., 'CORPUS')  -- or 'MODULE_RESEARCH' if applicable
```

### Testing
To verify guardrail works with actual data:
1. Ensure documents are linked to MODULE_RESEARCH sources
2. Run mining script without `--allow-module-research` (should skip)
3. Run mining script with `--allow-module-research` (should include)

## Done Criteria Status

- ✅ `canonical_sources` has explicit `source_kind`
- ✅ String matching is only fallback
- ✅ Guardrail uses `source_kind` primarily
- ✅ Classification is indexed and queryable

## Related Documentation

- `docs/MODULE_RESEARCH_MINING_GUARDRAIL.md` - Guardrail implementation details
- `docs/CITATION_DATA_TRACE.md` - Citation data flow
- `docs/UI_ORIGIN_CLARIFICATION_COMPLETE.md` - UI origin separation
- `db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql` - `ofc_origin` enforcement
