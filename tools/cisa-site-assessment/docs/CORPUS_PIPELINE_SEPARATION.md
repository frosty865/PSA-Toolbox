# Corpus Pipeline Separation Architecture

## Overview

Three separate ingestion pipelines prevent contamination between:
1. **Corpus General** - General assessment corpus (baseline authority sources)
2. **Corpus Module** - Module-specific corpus (module-scoped sources)
3. **Corpus Sector-Subsector** - Sector/subsector-specific corpus (future expansion)

## Separation Mechanisms

### 1. Source Registry Tagging (`scope_tags`)

All sources in `CORPUS.source_registry` are tagged via `scope_tags` JSONB:

**General Corpus:**
```json
{
  "tags": {},
  "ingestion_stream": "GENERAL"
}
```

**Module Corpus:**
```json
{
  "tags": { "module_code": "MODULE_EV_PARKING" },
  "ingestion_stream": "MODULE"
}
```

**Sector-Subsector Corpus (future):**
```json
{
  "tags": { "sector": "commercial_facilities", "subsector": "retail" },
  "ingestion_stream": "SECTOR_SUBSECTOR"
}
```

### 2. Storage Path Separation

**General Corpus:**
- Storage: `storage/corpus_sources/general/`
- Never mixed with module or sector-subsector sources

**Module Corpus:**
- Storage: `storage/corpus_sources/module/<module_code>/`
- Each module has its own subdirectory

**Sector-Subsector Corpus (future):**
- Storage: `storage/corpus_sources/sector/<sector>/<subsector>/`
- Organized by sector/subsector hierarchy

### 3. Query Filtering

All queries MUST filter by `scope_tags` to prevent contamination:

**General Corpus Query:**
```sql
WHERE (scope_tags->>'ingestion_stream') = 'GENERAL'
  OR (scope_tags->'tags' = '{}'::jsonb AND scope_tags->>'ingestion_stream' IS NULL)
```

**Module Corpus Query:**
```sql
WHERE (scope_tags->'tags'->>'module_code') = 'MODULE_EV_PARKING'
  AND (scope_tags->>'ingestion_stream') = 'MODULE'
```

**Sector-Subsector Corpus Query (future):**
```sql
WHERE (scope_tags->'tags'->>'sector') = 'commercial_facilities'
  AND (scope_tags->'tags'->>'subsector') = 'retail'
  AND (scope_tags->>'ingestion_stream') = 'SECTOR_SUBSECTOR'
```

## Pipeline Watchers

### 1. General Corpus Watcher
**File:** `tools/corpus/watch_general_corpus_ingestion.ts`
- Watches: `storage/corpus_sources/incoming/` (default, configurable via `CORPUS_GENERAL_INCOMING`)
- Ingests to: General corpus
- Tags: `{ ingestion_stream: "GENERAL" }`
- Storage: `storage/corpus_sources/general/`

### 2. Module Corpus Watcher
**File:** `tools/corpus/watch_module_corpus_ingestion.ts`
- Watches: 
  - `storage/module_sources/incoming/` (default, configurable via `CORPUS_MODULE_INCOMING`)
  - `storage/corpus_sources/incoming/` (also watches for module-scoped documents)
- Ingests to: Module corpus
- Tags: `{ tags: { module_code: "..." }, ingestion_stream: "MODULE" }`
- Storage: `storage/module_sources/raw/<module_code>/` (after verification with chunks)
- Temporary Storage: `storage/corpus_sources/module/<module_code>/` (during ingestion)

### 3. Sector-Subsector Corpus Watcher (future)
**File:** `tools/corpus/watch_sector_subsector_corpus_ingestion.ts`
- Watches: `data/incoming/<sector>/<subsector>/`
- Ingests to: Sector-subsector corpus
- Tags: `{ tags: { sector: "...", subsector: "..." }, ingestion_stream: "SECTOR_SUBSECTOR" }`
- Storage: `storage/corpus_sources/sector/<sector>/<subsector>/`

## Ingestion Functions

Each pipeline uses a dedicated ingestion function that:
1. Sets correct `scope_tags` in `source_registry`
2. Writes to correct storage path
3. Validates scope before ingestion

### General Corpus Ingestion
```typescript
async function ingestGeneralCorpus(pdfPath: string) {
  // Tags: { ingestion_stream: "GENERAL" }
  // Storage: storage/corpus_sources/general/
  // No module_code or sector/subsector tags
}
```

### Module Corpus Ingestion
```typescript
async function ingestModuleCorpus(pdfPath: string, moduleCode: string) {
  // Tags: { tags: { module_code }, ingestion_stream: "MODULE" }
  // Storage: storage/corpus_sources/module/<module_code>/
  // Requires module_code parameter
}
```

### Sector-Subsector Corpus Ingestion (future)
```typescript
async function ingestSectorSubsectorCorpus(
  pdfPath: string, 
  sector: string, 
  subsector: string
) {
  // Tags: { tags: { sector, subsector }, ingestion_stream: "SECTOR_SUBSECTOR" }
  // Storage: storage/corpus_sources/sector/<sector>/<subsector>/
  // Requires sector and subsector parameters
}
```

## Validation Rules

### Pre-Ingestion Validation

1. **General Corpus:**
   - Must NOT have `module_code` in scope_tags
   - Must NOT have `sector`/`subsector` in scope_tags
   - Must have `ingestion_stream = "GENERAL"`

2. **Module Corpus:**
   - MUST have `module_code` in scope_tags
   - Must NOT have `sector`/`subsector` in scope_tags
   - Must have `ingestion_stream = "MODULE"`

3. **Sector-Subsector Corpus:**
   - MUST have `sector` and `subsector` in scope_tags
   - Must NOT have `module_code` in scope_tags
   - Must have `ingestion_stream = "SECTOR_SUBSECTOR"`

### Query Validation

All queries that read from `source_registry` or `corpus_documents` MUST:
1. Filter by appropriate `scope_tags` pattern
2. Never mix streams in a single query
3. Use separate API endpoints for each stream

## Migration Path

### Phase 1: General + Module (Current)
- ✅ General corpus ingestion (existing)
- ✅ Module corpus ingestion (existing, needs tagging fix)
- ⏳ Separate watchers

### Phase 2: Add Sector-Subsector (Future)
- ⏳ Sector-subsector corpus ingestion
- ⏳ Sector-subsector watcher
- ⏳ Sector-subsector API endpoints

## Enforcement

### Database Constraints

Add check constraints to `source_registry`:
```sql
-- Ensure ingestion_stream is set
ALTER TABLE source_registry 
  ADD CONSTRAINT chk_ingestion_stream 
  CHECK (scope_tags->>'ingestion_stream' IN ('GENERAL', 'MODULE', 'SECTOR_SUBSECTOR'));

-- Ensure module corpus has module_code
ALTER TABLE source_registry 
  ADD CONSTRAINT chk_module_corpus_has_module_code
  CHECK (
    (scope_tags->>'ingestion_stream' != 'MODULE') OR
    (scope_tags->'tags'->>'module_code' IS NOT NULL)
  );
```

### Code Guards

Add validation functions that throw errors if:
- General corpus ingestion receives module_code
- Module corpus ingestion missing module_code
- Sector-subsector corpus ingestion missing sector/subsector
- Queries don't filter by scope_tags

## Files to Create/Update

1. **Watchers:**
   - `tools/corpus/watch_general_corpus_ingestion.ts`
   - `tools/corpus/watch_module_corpus_ingestion.ts`
   - `tools/corpus/watch_sector_subsector_corpus_ingestion.ts` (future)

2. **Ingestion Functions:**
   - Update `corpus_ingest_pdf.py` to accept `ingestion_stream` parameter
   - Create wrapper functions for each stream

3. **Migrations:**
   - Add `ingestion_stream` to `source_registry.scope_tags` structure
   - Add check constraints
   - Backfill existing sources with `ingestion_stream = "GENERAL"`

4. **API Endpoints:**
   - Separate endpoints for each stream
   - Query filters enforced at API level
