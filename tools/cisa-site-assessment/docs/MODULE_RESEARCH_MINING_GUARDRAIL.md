# MODULE RESEARCH Mining Guardrail

## Overview

A guardrail has been added to prevent MODULE RESEARCH canonical sources from being used for CORPUS mining, keeping module research documents completely separate from corpus evidence.

## Implementation

**File**: `tools/corpus/mine_ofc_candidates_from_chunks_v3.py`

### Changes Made

1. **Added CLI Flag**: `--allow-module-research`
   - When NOT set (default): Blocks mining from MODULE RESEARCH sources
   - When set: Allows mining from MODULE RESEARCH sources (explicit opt-in)

2. **Source Detection**: Checks canonical source metadata:
   - `source_title` contains "MODULE RESEARCH" (case-insensitive)
   - `source_citation_text` contains "MODULE RESEARCH" (case-insensitive)

3. **Chunk Filtering**: Before processing chunks:
   - If source is identified as MODULE RESEARCH and flag is not set:
     - Skip candidate extraction
     - Increment `skipped_module_research` counter
     - Log rejection reason: `module_research_blocked`

4. **Reporting**: 
   - Skipped count included in mining report
   - Warning message printed if any chunks were skipped

## Usage

### Default Behavior (Blocked)
```bash
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply
# MODULE RESEARCH sources are automatically skipped
```

### Explicit Allow (Opt-in)
```bash
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --allow-module-research
# MODULE RESEARCH sources are included in mining
```

## Detection Logic

A canonical source is considered MODULE RESEARCH if:
- `canonical_sources.title ILIKE '%MODULE RESEARCH%'` OR
- `canonical_sources.citation_text ILIKE '%MODULE RESEARCH%'`

## Report Output

The mining report includes:
```json
{
  "skipped_module_research": 0,
  "rejects": {
    "module_research_blocked": 0,
    ...
  }
}
```

If chunks are skipped, a warning is printed:
```
[GUARDRAIL] Skipped N chunks from MODULE RESEARCH sources (use --allow-module-research to include)
```

## Rationale

- **Separation of Concerns**: Module research documents are for module-specific OFC creation, not corpus mining
- **Data Integrity**: Prevents accidental contamination of CORPUS candidates with module research content
- **Explicit Opt-in**: Requires intentional flag to include MODULE RESEARCH sources
- **Backward Compatible**: Existing mining operations continue to work (they just skip MODULE RESEARCH sources)

## Related

- See `docs/CITATION_DATA_TRACE.md` for citation data flow
- See `docs/UI_ORIGIN_CLARIFICATION_COMPLETE.md` for UI origin separation
- See `db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql` for `ofc_origin` enforcement
