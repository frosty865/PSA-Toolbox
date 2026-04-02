# Canonical Source Classification (source_kind)

## Overview

Added explicit `source_kind` classification to `canonical_sources` table to replace fragile string matching and centralize MODULE_RESEARCH detection across all corpus tools.

## Migration

**File**: `db/migrations/20260124_0010_canonical_sources_source_kind.sql`

### Changes
- Adds `source_kind` column (TEXT, NOT NULL, DEFAULT 'CORPUS')
- CHECK constraint: `source_kind IN ('CORPUS','MODULE_RESEARCH')`
- Index: `idx_canonical_sources_source_kind`
- Backfills existing data:
  - Sources with "MODULE RESEARCH" in title/citation → `MODULE_RESEARCH`
  - All others → `CORPUS`

### Run Migration
```bash
# Using Node.js runner
node tools/run_source_kind_migration.js

# Or directly with psql
psql $CORPUS_DATABASE_URL -f db/migrations/20260124_0010_canonical_sources_source_kind.sql
```

### Verify
```sql
SELECT source_kind, COUNT(*) 
FROM public.canonical_sources 
GROUP BY source_kind;
```

Expected:
- `CORPUS`: Most sources
- `MODULE_RESEARCH`: Sources with "MODULE RESEARCH" in title/citation

## Centralized Detection Helper

**File**: `tools/corpus/source_kind.py`

### Function: `is_module_research_source()`

```python
from source_kind import is_module_research_source

is_module_research = is_module_research_source(
    source_kind=row.get("source_kind"),
    title=row.get("source_title"),
    citation_text=row.get("source_citation_text")
)
```

**Logic**:
1. **Primary**: Check `source_kind == 'MODULE_RESEARCH'` (authoritative)
2. **Fallback**: String matching on title/citation (backward compatibility)

**Benefits**:
- Single source of truth for detection logic
- Backward compatible (works even if `source_kind` is NULL)
- Consistent behavior across all tools

## Updated Scripts

### 1. Mining Script
**File**: `tools/corpus/mine_ofc_candidates_from_chunks_v3.py`

**Changes**:
- Imports `is_module_research_source` helper
- SELECT includes `cs.source_kind`
- Guardrail uses centralized detection function
- Default source creation includes `source_kind='CORPUS'`

**Behavior**:
- Default: Blocks MODULE_RESEARCH sources (by `source_kind` or fallback)
- `--allow-module-research`: Allows MODULE_RESEARCH sources

### 2. Other Scripts (Optional Updates)

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

## Usage Examples

### Mining with Guardrail (Default)
```bash
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply
# MODULE_RESEARCH sources blocked by source_kind
```

### Mining with Opt-in
```bash
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --allow-module-research
# MODULE_RESEARCH sources included
```

### Using Helper in Other Scripts
```python
from tools.corpus.source_kind import is_module_research_source

# In your script
for source in sources:
    if is_module_research_source(
        source.get("source_kind"),
        source.get("title"),
        source.get("citation_text")
    ):
        # Handle MODULE_RESEARCH source
        pass
```

## Benefits

1. **Explicit Classification**: No more fragile string matching
2. **Centralized Logic**: Single function for all tools
3. **Queryable**: Can filter by `source_kind` in SQL
4. **Indexed**: Fast filtering on `source_kind`
5. **Backward Compatible**: Fallback to string matching if `source_kind` is NULL

## Related

- `docs/MODULE_RESEARCH_MINING_GUARDRAIL.md` - Guardrail implementation
- `docs/CITATION_DATA_TRACE.md` - Citation data flow
- `db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql` - `ofc_origin` enforcement
