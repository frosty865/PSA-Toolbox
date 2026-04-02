# Module Research Layer Architecture

## Overview

The module research layer tracks research sources for modules and links them to canonical corpus documents/chunks. This is an **additive metadata layer** that does NOT duplicate corpus ingestion tables.

## Database Split

The tables are split across two databases to enable proper foreign key constraints:

### RUNTIME Database (`migrations/20260122_module_research_tables_runtime.sql`)

**Table: `module_sources`**
- **Purpose**: Track URLs/files for a module topic
- **References**: `assessment_modules(module_code)` (FK enforced)
- **Why RUNTIME**: Modules are RUNTIME-scoped entities

### CORPUS Database (`migrations/20260122_module_research_tables_corpus.sql`)

**Table: `module_source_documents`**
- **Purpose**: Link module_sources to canonical corpus_documents
- **References**: 
  - `corpus_documents(id)` (FK enforced - same database)
  - `module_sources(id)` (no FK - cross-database reference)
- **Denormalized**: `module_code` field for fast filtering
- **Why CORPUS**: References `corpus_documents` which is in CORPUS

**Table: `module_chunk_links`**
- **Purpose**: Link modules to document_chunks for fast retrieval/mining
- **References**:
  - `document_chunks(chunk_id)` (FK enforced - same database)
  - `assessment_modules(module_code)` (no FK - cross-database reference)
- **Why CORPUS**: References `document_chunks` which is in CORPUS

## Migration Order

1. **RUNTIME**: Run `migrations/20260122_module_research_tables_runtime.sql`
   - Requires: `assessment_modules` table exists
   
2. **CORPUS**: Run `migrations/20260122_module_research_tables_corpus.sql`
   - Requires: `corpus_documents` and `document_chunks` tables exist

## Usage Flow

1. **Import manifest** → Creates `module_sources` rows in RUNTIME
   ```bash
   python tools/research/import_download_manifest_to_module_sources.py \
     --module_code MODULE_EV_PARKING \
     --manifest analytics/research/MODULE_EV_PARKING_download_manifest.json
   ```

2. **Ingest documents** → Creates `corpus_documents` and `document_chunks` in CORPUS
   ```bash
   python tools/research/ingest_research_downloads.py \
     --manifest analytics/research/MODULE_EV_PARKING_download_manifest.json \
     --module_code MODULE_EV_PARKING
   ```

3. **Linking happens automatically** → `link_module_documents.py` creates links in CORPUS:
   - Looks up `module_source_id` from RUNTIME
   - Inserts into `module_source_documents` (CORPUS)
   - Inserts into `module_chunk_links` (CORPUS)

## Query Patterns

### Get all sources for a module (RUNTIME)
```sql
SELECT * FROM public.module_sources WHERE module_code = 'MODULE_EV_PARKING';
```

### Get all linked documents for a module (CORPUS)
```sql
SELECT DISTINCT corpus_document_id 
FROM public.module_source_documents 
WHERE module_code = 'MODULE_EV_PARKING';
```

### Get all chunks for a module (CORPUS)
```sql
SELECT chunk_id 
FROM public.module_chunk_links 
WHERE module_code = 'MODULE_EV_PARKING';
```

## Cross-Database Considerations

- **No FK enforcement** for cross-database references (`module_source_id` → RUNTIME, `module_code` → RUNTIME)
- **Application code** must ensure referential integrity
- **Denormalization** (`module_code` in `module_source_documents`) enables fast filtering without joins

## Admin UI

The Admin UI (`/admin/modules/[moduleCode]/sources`) queries both databases:
- RUNTIME: Gets `module_sources` list
- CORPUS: Gets linked document/chunk counts
