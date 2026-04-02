# Document metadata: current table and column names

All tables below live in the **CORPUS** database (`CORPUS_DATABASE_URL`), schema `public`, unless noted.

---

## 1. `source_registry`

**Purpose:** Registry of authoritative sources (tiered by publisher). One row per source; citations reference `source_key`. Used by Source Registry UI and ingestion.

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `source_key` | TEXT | Unique, human-readable key (e.g. `CISA_SECURITY_CONVERGENCE_2024`) |
| `publisher` | TEXT | e.g. CISA, FEMA |
| `tier` | INTEGER | 1 / 2 / 3 (authority tier) |
| `title` | TEXT | |
| `publication_date` | DATE | nullable |
| `source_type` | TEXT | `'pdf' \| 'web' \| 'doc'` |
| `canonical_url` | TEXT | nullable |
| `local_path` | TEXT | nullable |
| `doc_sha256` | TEXT | nullable; unique when not null |
| `retrieved_at` | TIMESTAMPTZ | nullable |
| `scope_tags` | JSONB | Array of sector/subsector/module tags; default `[]` |
| `notes` | TEXT | nullable |
| `ingestion_stream` | TEXT | Default `'CORPUS'` (added later) |
| `storage_relpath` | TEXT | nullable; path under CORPUS_SOURCES_ROOT (added later) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Defined in:** `db/migrations/20260116_create_source_registry.sql`, `db/migrations/corpus/20260124_add_ingestion_stream_storage_relpath.sql`, `db/migrations/corpus/20260126_add_unique_constraint_doc_sha256.sql`, `db/migrations/corpus/20260202_source_registry_publisher_null_placeholders.sql`.

---

## 2. `corpus_documents`

**Purpose:** Authoritative document-level citation metadata. Natural key is `file_hash`. Linked to `source_registry` via `source_registry_id`. Chunks live in `document_chunks` with `document_id` = `corpus_documents.id`.

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `file_hash` | TEXT | Unique; SHA256 of content |
| `canonical_path` | TEXT | nullable; in the new model, relative to CORPUS_SOURCES_ROOT (e.g. `raw/PDF's/file.pdf`). Resolve with `getCorpusSourcesRoot()` + path. Legacy absolute paths (e.g. `D:\psa-workspace\...`) are rewritten by `scripts/rewrite_corpus_document_paths.ts`. |
| `original_filename` | TEXT | nullable |
| `file_stem` | TEXT | nullable |
| `inferred_title` | TEXT | nullable; best title for display |
| `title_confidence` | SMALLINT | 0–100 |
| `pdf_meta_title` | TEXT | nullable |
| `pdf_meta_author` | TEXT | nullable |
| `pdf_meta_subject` | TEXT | nullable |
| `pdf_meta_creator` | TEXT | nullable |
| `pdf_meta_producer` | TEXT | nullable |
| `pdf_meta_creation_date` | TIMESTAMPTZ | nullable |
| `pdf_meta_mod_date` | TIMESTAMPTZ | nullable |
| `publisher` | TEXT | nullable |
| `publication_date` | DATE | nullable |
| `source_url` | TEXT | nullable |
| `citation_short` | TEXT | nullable |
| `citation_full` | TEXT | nullable |
| `locator_scheme` | TEXT | default `'page'`; `'page' \| 'section' \| 'paragraph' \| 'url_fragment'` |
| `ingestion_warnings` | JSONB | default `[]` |
| `source_registry_id` | UUID | nullable then backfilled; FK to `source_registry(id)` (added by migrations in `migrations/`) |
| `processing_status` | TEXT | e.g. REGISTERED, PROCESSED, FAILED (added later) |
| `processed_at` | TIMESTAMPTZ | nullable |
| `chunk_count` | INTEGER | default 0 |
| `last_error` | TEXT | nullable |
| `document_role` | TEXT | `'OFC_SOURCE' \| 'AUTHORITY_SOURCE' \| 'TECHNOLOGY_LIBRARY'` (added in migrations) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Defined in:** `db/migrations/20260118_create_corpus_documents.sql`, `db/migrations/corpus/20260125_add_corpus_processing_status.sql`, `migrations/20260120_enforce_source_registry_on_documents.sql`, `migrations/20260203_add_document_role_to_corpus_documents.sql`, `migrations/20260201_add_technology_library_document_role.sql`.

---

## 3. `document_chunks`

**Purpose:** Chunk-level text and locators per document. `document_id` references `corpus_documents.id`. Used for RAG, scope-tag analysis (excerpt), and citation-ready views.

| Column | Type | Notes |
|--------|------|--------|
| `chunk_id` | UUID | PK (assumed from archive migration) |
| `document_id` | UUID | FK to `corpus_documents.id` |
| `chunk_text` | TEXT | Chunk content |
| `chunk_index` | INT | Order within document |
| `page_number` | INT | nullable; for PDF |
| `source_set` | TEXT | e.g. VOFC_LIBRARY (legacy) |
| `locator_type` | TEXT | nullable; e.g. PDF, XLSX (added in corpus migration) |
| `locator` | TEXT | nullable; e.g. "Page 5", "sheet=X;row=3" (added in corpus migration) |
| `section_heading` | TEXT | nullable (added in corpus migration) |

**Defined/referenced in:** `db/migrations/corpus/2026_01_13_add_chunk_locators.sql`, `db/migrations/corpus/2026_01_14_add_section_heading.sql`, `db/migrations/corpus/20260127_create_archive_tables_for_orphaned_module_data.sql` (archive copies structure). Base `document_chunks` table may predate these or live in another migration.

---

## 4. Related CORPUS tables (reference only)

- **`rag_chunks`** – RAG vectors; has `chunk_id`, `chunk_text`, `content_hash`, embedding column; references same chunk identity as `document_chunks`.
- **`module_standards`**, **`module_standard_references`** – `module_standard_references.source_registry_id` (UUID, nullable) links to `source_registry.id`.
- **`module_standard_citations`** – `source_registry_id` (UUID, nullable), `source_title` (TEXT, nullable).

---

## 5. RUNTIME database (reference only)

Document metadata is **not** stored in RUNTIME for corpus evidence. RUNTIME holds:

- **`module_corpus_links`** – `corpus_source_registry_id` (UUID) points at CORPUS `source_registry.id`.
- **`module_ofc_citations`** – `source_registry_id` (UUID) points at CORPUS `source_registry.id`.
- **`module_chunk_comprehension`** – `source_registry_id`, `doc_id`, `chunk_id` for evidence anchors.

---

## Where it is stored (summary)

| What | Where |
|------|--------|
| Source-level metadata (title, publisher, tier, scope_tags, URL, doc_sha256, etc.) | **CORPUS** → `source_registry` |
| Document-level citation metadata (file_hash, inferred_title, PDF meta, citation_short/full, publisher, publication_date) | **CORPUS** → `corpus_documents` |
| Link from document → source | **CORPUS** → `corpus_documents.source_registry_id` → `source_registry.id` |
| Chunk text and locators | **CORPUS** → `document_chunks` (document_id → corpus_documents.id) |
| RAG embeddings / chunk text for search | **CORPUS** → `rag_chunks` (chunk_id aligns with document_chunks) |

---

**Deprecated and archive tables:** See `config/db_schema_status.json` and [DEPRECATED_TABLES.md](DEPRECATED_TABLES.md).
