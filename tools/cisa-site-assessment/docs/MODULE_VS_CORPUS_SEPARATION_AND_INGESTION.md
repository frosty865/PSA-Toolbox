# Module vs Corpus Separation and Ingestion

Single reference for **where** module vs corpus segregation is defined and **where** ingestion lives. The two use different databases, storage, and pipelines.

---

## 1. Separation / Segregation (where it’s defined)

### Authority docs

| Topic | File | What it defines |
|-------|------|------------------|
| **Hard segregation (module never becomes corpus)** | `docs/CORPUS_RUNTIME_SEGREGATION.md` | Module uploads NEVER become CORPUS rows; modules only ATTACH (pointer) via `module_corpus_links`. Read-only CORPUS from runtime app. |
| **DB separation (two projects)** | `docs/CORPUS_RUNTIME_SEPARATION.md` | Two Supabase projects: RUNTIME (assessments, OFC library, module_*) vs CORPUS (source_registry, corpus_documents, document_chunks, ingestion_*). |
| **Table ownership (which DB owns which table)** | `config/db_ownership.json` | Single source of truth: each table is CORPUS or RUNTIME. Pool guards use this. |
| **Pipeline separation (three streams)** | `docs/CORPUS_PIPELINE_SEPARATION.md` | General vs Module vs Sector-Subsector corpus; `scope_tags` / `ingestion_stream`; storage paths; which watcher does what. |
| **Module vs baseline table separation** | `docs/MODULE_BASELINE_TABLE_SEPARATION.md` | Modules and baseline content never access each other’s tables; `module_corpus_links` as read-only pointers. |
| **DB ownership enforcement** | `docs/DB_OWNERSHIP_ENFORCEMENT.md` | How pool guards enforce CORPUS vs RUNTIME. |

### Code-level enforcement

| What | Where |
|------|--------|
| **CORPUS read-only from runtime app** | `app/lib/db/corpus_client.ts` — `assertReadOnly()` blocks INSERT/UPDATE/DELETE from runtime. |
| **No “promote to corpus”** | `scripts/guards/verifyNoPromoteToCorpus.js`; `promote-to-corpus` route returns 410 Gone. |
| **Storage roots** | `app/lib/storage/config.ts` — `getCorpusSourcesRoot()` vs `getModuleSourcesRoot()`; `assertCorpusPath` / `assertModulePath`. |

---

## 2. Database ecosystems (summary)

- **RUNTIME DB**  
  Assessments, OFC library, **module_*** tables (e.g. `module_documents`, `module_chunks`, `module_sources`, `module_corpus_links`).  
  Client: `app/lib/db/runtime_client.ts` → `getRuntimePool()`.

- **CORPUS DB**  
  Evidence and ingestion: `source_registry`, `corpus_documents`, `document_chunks`, `ingestion_runs`, `ingestion_run_documents`, OFC candidate tables, module_standard_*, etc.  
  Client: `app/lib/db/corpus_client.ts` → `getCorpusPool()` (read-only from runtime app).

- **Table list**  
  `config/db_ownership.json` — every table has `"CORPUS"` or `"RUNTIME"`.

---

## 3. Ingestion (where it lives)

### Module ingestion (RUNTIME only)

Module uploads **never** write to CORPUS. They only touch RUNTIME.

| Layer | What | Where |
|-------|------|--------|
| **Incoming dir** | PDFs per module | `storage/module_sources/incoming/<module_code>/` |
| **Watcher** | Polls incoming, runs RUNTIME ingest | `tools/corpus/watch_module_ingestion.ts` — `npm run module:watch` |
| **RUNTIME ingest script** | Inserts into `module_documents` + `module_chunks` | `tools/corpus/ingest_module_pdf_to_runtime.py` — `ingest_module_pdf()` |
| **Batch from incoming** | Processes dir of PDFs → RUNTIME | `tools/corpus/process_module_pdfs_from_incoming.py` (calls `ingest_module_pdf_to_runtime.ingest_module_pdf`) |
| **API trigger** | Process incoming PDFs for a module | `app/api/admin/modules/[moduleCode]/process-incoming-pdfs/route.ts` (spawns `process_module_pdfs_from_incoming.py`) |

Docs: `docs/MODULE_INGESTION_WATCHER.md`, `docs/CORPUS_RUNTIME_SEGREGATION.md`.

### Corpus ingestion (CORPUS only)

Corpus pipelines write to CORPUS DB and CORPUS storage; they do **not** write to RUNTIME `module_documents` / `module_chunks`.

| Stream | Incoming / trigger | Watcher / script | DB + storage |
|--------|--------------------|-------------------|--------------|
| **General** | `storage/corpus_sources/incoming/` | `tools/corpus/watch_general_corpus_ingestion.ts` — `npm run corpus:watch:general` | CORPUS: `source_registry`, `corpus_documents`, `document_chunks`; tags `ingestion_stream: "GENERAL"`. Storage: `storage/corpus_sources/general/`. |
| **Module corpus** (module-tagged corpus docs) | `storage/module_sources/incoming/` or `storage/corpus_sources/incoming/` | `tools/corpus/watch_module_corpus_ingestion.ts` | CORPUS: same tables, tags `ingestion_stream: "MODULE"`, `module_code`. Temporary storage under `storage/corpus_sources/module/<module_code>/`. |

Single Python entrypoint for **all** corpus ingestion (general + module-tagged):

- **`tools/corpus_ingest_pdf.py`** — `ingest_pdf()`. Writes to CORPUS only: `source_registry`, `corpus_documents`, `document_chunks`, `ingestion_runs`. Uses `--ingestion-stream` (GENERAL / MODULE / SECTOR_SUBSECTOR) and optional `--module-code`.

Watchers (general and module corpus) call this script with the appropriate flags; they do **not** call the RUNTIME-only `ingest_module_pdf_to_runtime.py`.

---

## 4. Quick comparison

| | Module (RUNTIME) | Corpus (CORPUS) |
|--|------------------|------------------|
| **DB** | RUNTIME only | CORPUS only |
| **Tables** | `module_documents`, `module_chunks`, `module_sources`, `module_corpus_links`, … | `source_registry`, `corpus_documents`, `document_chunks`, `ingestion_runs`, … |
| **Storage** | `storage/module_sources/` (incoming, raw, normalized, etc.) | `storage/corpus_sources/` (incoming, general, module/<code>, …) |
| **Ingest entry** | `tools/corpus/ingest_module_pdf_to_runtime.py` | `tools/corpus_ingest_pdf.py` |
| **Watchers** | `tools/corpus/watch_module_ingestion.ts` (→ RUNTIME) | `tools/corpus/watch_general_corpus_ingestion.ts`, `tools/corpus/watch_module_corpus_ingestion.ts` (→ CORPUS) |
| **Promote to corpus** | Not allowed (410 Gone) | N/A |
| **Link to corpus** | Read-only pointers in RUNTIME `module_corpus_links` | N/A |

---

## 5. Related

- **Tier 1 crawler** writes artifacts to `storage/crawler_artifacts/tier1/` and registers in CORPUS `source_registry`; bridge copies PDFs to `storage/corpus_sources/incoming/` for **corpus** ingestion (same CORPUS pipeline as above).
- **Cleanup of bad module data in corpus** (if module data was ever ingested into CORPUS by mistake): `docs/CLEANUP_MODULE_DATA_FROM_CORPUS.md`, `tools/admin/clean_module_data_from_corpus.py`, `tools/admin/archive_orphaned_module_corpus_data.py`.
