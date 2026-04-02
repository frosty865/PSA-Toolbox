# Module Chunk Comprehension

## When `REQUIRE_MODULE_COMPREHENSION=1` (recommended)

The **web UI generation path** (`POST /api/admin/modules/[moduleCode]/standard/generate`) **runs comprehension before generation** when `REQUIRE_MODULE_COMPREHENSION=1`:

1. **TS-native runner** (`app/lib/modules/comprehension/run_module_comprehension.ts`): If `module_chunk_comprehension` has 0 rows for the module, it loads chunks from **RUNTIME** `module_chunks` (via `module_documents` for the module), calls Ollama per chunk, and UPSERTs into RUNTIME (idempotent). Then generation proceeds.
2. Response includes `preflight.comprehension_status` (`"present"` | `"created"`) and `preflight.comprehension_rows` for auditing.

So with the flag set, you do **not** need to run the Python script first; the API ensures comprehension is present synchronously.

**Chunk selection for generation:** When `REQUIRE_MODULE_COMPREHENSION=1` and comprehension rows exist, the export step selects chunks from `module_chunk_comprehension` (not by `mc.id` order): only rows with `supports_question_generation = TRUE` and `generation_priority` ≥ MEDIUM, ordered by priority, life_safety_signal, ops_signal, confidence. A diversity cap (e.g. max 30 chunks per doc_id) is applied, then up to 120 chunks are written to `data/module_chunks/<module_code>.json` for the generator. Preflight includes `comprehension_rows_total`, `comprehension_rows_eligible`, and `chunks_selected_for_generation`. If no chunks qualify, the API returns an actionable error (rebuild comprehension or lower minPriority).

## Root cause when rows are still 0 (without the flag or if TS step is skipped)

If you do **not** set `REQUIRE_MODULE_COMPREHENSION=1`, the API does not run comprehension. Then `module_chunk_comprehension` stays at 0 unless you run the **Python pipeline** or a manual backfill.

---

## 1) DB: Where the table lives

- **RUNTIME** only. Ownership: `config/db_ownership.json` → `public.module_chunk_comprehension` → RUNTIME.
- If you see 0 rows, you are looking at the right DB; the table is simply never written by the UI path.

**Verify column types and value ranges (run on RUNTIME):**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'module_chunk_comprehension'
ORDER BY ordinal_position;
```

Expected:
- `generation_priority` — **text** (values: `HIGH` | `MEDIUM` | `LOW`)
- `supports_question_generation` — **boolean**
- `life_safety_signal`, `ops_signal`, `cyber_awareness_signal` — **boolean**
- `comprehension_error` — **text** (nullable; set when parse/validation fails)

The normalizer must accept boolean inputs or deterministically coerce (e.g. numeric ≥2 → true) and must not silently default all booleans to false.

```sql
-- RUNTIME
SELECT current_database(), current_schema();
SELECT COUNT(*) AS comprehension_rows FROM public.module_chunk_comprehension;
```

---

## 2) Who writes to `module_chunk_comprehension`

| Path | Runs comprehension? | Reads chunks from | Writes comprehension to |
|------|---------------------|-------------------|--------------------------|
| **Web UI** `standard/generate` (when `REQUIRE_MODULE_COMPREHENSION=1`) | **Yes** (TS-native, before generation) | RUNTIME `module_chunks` + `module_documents` | RUNTIME `module_chunk_comprehension` (UPSERT) |
| **Web UI** `standard/generate` (flag not set) | **No** | RUNTIME `module_chunks` (export to JSON) | — |
| **Comprehension tab** “Build comprehension now” | **Yes** (TS-native) | RUNTIME `module_chunks` + `module_documents` | RUNTIME `module_chunk_comprehension` (UPSERT; "Rebuild comprehension" deletes then reruns) |
| **Process-incoming-pdfs** (optional step) | **Yes** (Python script) | CORPUS `document_chunks` (after CORPUS mirror) | RUNTIME `module_chunk_comprehension` |
| **Python pipeline** `extract_module_comprehension_from_corpus.py` | **Yes** (manual backfill) | CORPUS `document_chunks` + `corpus_documents` + `source_registry` | RUNTIME `module_chunk_comprehension` (with `--apply`) |

Writers:

- **TS-native** (preferred): `app/lib/modules/comprehension/run_module_comprehension.ts` — invoked by `standard/generate` when `REQUIRE_MODULE_COMPREHENSION=1`, and by the Comprehension tab “Build comprehension now”. Reads from RUNTIME `module_chunks`; idempotent UPSERT; no CORPUS required.
- **Python** (optional manual backfill): `tools/module_crawler/extract_module_comprehension_from_corpus.py` — for bulk runs or when not using the API; invoked by `run_module_generation_from_sources.py` (step 1 of 3). Use `--apply` to persist.

So:

- **(B) Called but not persisted** — Possible if you run the Python script without `--apply`.
- **(C) Wrong DB/schema** — No; the script uses `RUNTIME_DATABASE_URL` for the INSERT.
- **(D) Insert failing** — Check Python stderr when running the script with `--apply`.
- **(E) No chunks loaded** — The **TS-native** runner uses RUNTIME `module_chunks` (via `module_documents`). If the module has no ingested sources or no chunks with length ≥ 400 chars, you get 0 chunks. Fix: add sources on the Sources tab and process PDFs so RUNTIME has `module_documents` and `module_chunks`. The **Python** script still reads from CORPUS `document_chunks` (requires `source_registry.scope_tags.module_code` and CORPUS ingestion).

---

## 3) Call graph

### Web UI (with REQUIRE_MODULE_COMPREHENSION=1)

1. `POST /api/admin/modules/[moduleCode]/standard/generate`
2. → `ensureModuleComprehension()` (if 0 rows: load RUNTIME `module_chunks` → Ollama → UPSERT RUNTIME `module_chunk_comprehension`)
3. → `exportChunksFromRuntime()` (RUNTIME `module_chunks` → JSON file)
4. → `generateModuleContentFromChunks()` / `runPlanStructurePipeline()` / `runPlanGeneratorV1()` (TypeScript)
5. → Persist `module_instances`, `module_instance_criteria`, OFCs, etc.
6. Response includes `preflight.comprehension_status` and `preflight.comprehension_rows`.

### Web UI (flag not set)

1. `POST /api/admin/modules/[moduleCode]/standard/generate`
2. → `exportChunksFromRuntime()` (RUNTIME `module_chunks` → JSON file)
3. → (If flag were set, 503 when comprehension rows = 0; with flag not set, no comprehension step.)
4. → Generation and persist as above.

### Python pipeline (comprehension + vulns + questions)

1. `run_module_generation_from_sources.py --module-code X --model Y [--apply]`
2. → Step 1: `extract_module_comprehension_from_corpus.py` → INSERT into RUNTIME `module_chunk_comprehension`
3. → Step 2: `extract_module_vulnerabilities_from_corpus.py` (reads `module_chunk_comprehension`)
4. → Step 3: `build_module_questions_from_vulns.py`

---

## 4) How to get rows into `module_chunk_comprehension`

### RUNTIME → CORPUS mirror (module uploads)

When you run **Process incoming PDFs** in the UI (or `POST .../process-incoming-pdfs`), the API now runs **all** of:

1. Ingest PDFs into RUNTIME (module_documents, module_chunks).
2. Replicate to CORPUS **source_registry** stubs via `replicateModuleDocsToSourceRegistry`.
3. **CORPUS mirror**: `ingest_module_sources.py` → `corpus_documents` + `document_chunks` + module links.
4. **Comprehension**: `extract_module_comprehension_from_corpus.py --apply` (model from `PSA_COMPREHENSION_MODEL` or `MODULE_COMPREHENSION_MODEL`, default `llama3.1:8b-instruct`).

So chunking (RUNTIME + CORPUS) and comprehension run as part of the same flow. You can skip the CORPUS/comprehension steps by sending `skipCorpusIngest: true` or `skipComprehension: true` in the request body.

To run the CORPUS mirror or comprehension **manually** (e.g. after fixing data):

```bash
# From psa_rebuild (use your module code, e.g. MODULE_ACTIVE_ASSAILANT_EMERGENCY_ACTION_PLAN)
python tools/corpus/ingest_module_sources.py --module-code MODULE_XXX
# Or: scripts\ingest_module_sources.bat --module-code MODULE_XXX
```

That script reads RUNTIME `module_sources` (with `storage_relpath` under `raw/`), ensures each is in CORPUS `source_registry` (by `doc_sha256`), runs CORPUS PDF ingestion (`corpus_ingest_pdf.ingest_pdf`) to create `corpus_documents` and `document_chunks`, and links via `module_source_documents`. Only then will the forensic script show eligible chunks (A2) and the comprehension script have inputs.

1. **Ensure CORPUS has chunks for the module**
   - `source_registry` must have rows with `scope_tags->>'module_code' = '<MODULE_CODE>'`.
   - **For module uploads:** run `ingest_module_sources.py --module-code <MODULE_CODE>` so `corpus_documents` and `document_chunks` exist for those sources.
   - For other corpus sources, use the usual CORPUS ingestion (source-registry ingest API or watchers).

2. **Run the Python comprehension step (with `--apply`)**
   ```bash
   cd psa_rebuild
   python tools/module_crawler/extract_module_comprehension_from_corpus.py \
     --module-code MODULE_EV_PARKING \
     --model llama3.1:8b-instruct \
     --apply
   ```
   **PowerShell:** Quote the model so `<model>` is not treated as redirection:  
   `python tools/module_crawler/extract_module_comprehension_from_corpus.py --module-code MODULE_EV_PARKING --model "llama3.1:8b-instruct" --apply`

   Or run the full pipeline (comprehension → vulnerabilities → questions):
   ```bash
   python tools/module_crawler/run_module_generation_from_sources.py \
     --module-code MODULE_EV_PARKING \
     --model llama3.1:8b-instruct \
     --apply
   ```

3. **Require comprehension in the UI (recommended)**
   - Set `REQUIRE_MODULE_COMPREHENSION=1` in `.env.local`. Then `standard/generate` runs TS-native comprehension first (creates rows from CORPUS if 0). No 503; generation proceeds. Response includes `preflight.comprehension_status` and `preflight.comprehension_rows`.

---

## 5) Quick checks

| Check | Command / query |
|-------|------------------|
| **Forensic** | `python tools/module_crawler/run_forensic_comprehension.py` (A1/A2/A4) |
| Comprehension row count (RUNTIME) | `SELECT COUNT(*) FROM public.module_chunk_comprehension;` |
| Comprehension for one module | `SELECT COUNT(*) FROM public.module_chunk_comprehension WHERE module_code = 'MODULE_XXX';` |
| CORPUS chunks for module | `SELECT COUNT(*) FROM document_chunks dc JOIN corpus_documents cd ON cd.id = dc.doc_id JOIN source_registry sr ON sr.id = cd.source_registry_id WHERE (sr.scope_tags->>'module_code') = 'MODULE_XXX';` |
| RUNTIME chunk export (what UI uses) | `module_chunks` + `module_documents` + `module_doc_source_link` (see `exportChunksFromRuntime` in standard/generate route). |

**Forensic interpretation:** If A2 (Eligible chunks per module) is empty but A4 (Sources with zero chunks) lists module codes, then `source_registry` has rows with `scope_tags->>'module_code'` set but those sources have no `document_chunks`. For **module uploads** (source_key like `module:MODULE_*:` or scope_tags.source_type = MODULE_UPLOAD), run `python tools/corpus/ingest_module_sources.py --module-code <MODULE_CODE>` to create the CORPUS mirror (corpus_documents + document_chunks). For other corpus sources, run the usual CORPUS ingestion (source-registry ingest API or watchers).

---

## 6) One-run proof (debugging LOW/false metrics)

If actionable chunks (coordination, alerts, procedures) show as LOW and `supports_question_generation=false`, instrument and rebuild:

1. **Run with debug logging**
   - Set `DEBUG_MODULE_COMPREHENSION=1` in the environment.
   - Rebuild comprehension (Comprehension tab → “Rebuild comprehension” or POST build with `forceRebuild: true`).
   - Check server logs for the **first chunk**:
     - `raw_model_text` (first 800 chars)
     - `parsed_json` (stringified)
     - `normalized_record` (object about to be upserted)
     - `comprehension_error` (if set)
   - This shows whether the model returned usable values, the normalizer dropped them, or constants were written.

2. **Expected after fix for a bullet/procedure chunk (e.g. p.16)**
   - `normalized_record.supports_question_generation === true`
   - `normalized_record.generation_priority` ≥ MEDIUM (2)
   - `normalized_record.ops_signal === true` (and often `life_safety_signal === true` for EAP content)

3. **Acceptance after rebuild**
   - `supports_question_generation` true count &gt; 0
   - `generation_priority` includes MEDIUM/HIGH (2/3) for bullet/procedure chunks
   - `ops_signal` true &gt; 0, `life_safety_signal` true &gt; 0 for life-safety modules
   - Pure “To learn more / resources” chunks may remain LOW and `supports_question_generation=false`.

---

## 7) Model used and verification

**Effective model:** The runner uses `opts.model` when provided (build route passes `getComprehensionModel()`), else `OLLAMA_COMPREHENSION_MODEL` via `getComprehensionModel()`. No hardcoded default in the runner. With `DEBUG_MODULE_COMPREHENSION=1`, server logs show `effectiveModel` and `env.OLLAMA_COMPREHENSION_MODEL`.

**Rebuild:** Rebuild deletes all rows for the module then runs comprehension; every row is written with the current `llm_model` and a new `llm_run_id` (UUID). UPSERT always sets `llm_model = EXCLUDED.llm_model`, `llm_run_id = EXCLUDED.llm_run_id`, `updated_at = now()` so “Model distribution” reflects the current run.

**One-shot verification (RUNTIME):**
```sql
SELECT llm_model, COUNT(*)
FROM public.module_chunk_comprehension
WHERE module_code ILIKE '<MODULE_CODE>'
GROUP BY llm_model
ORDER BY COUNT(*) DESC;
```
After Rebuild with `OLLAMA_COMPREHENSION_MODEL=qwen2.5:14b-instruct`, expect one row: `qwen2.5:14b-instruct = N`. If you still see an old model, rebuild is not rewriting rows or the env was not loaded.

**Acceptance:** Set `OLLAMA_COMPREHENSION_MODEL=qwen2.5:14b-instruct`, restart dev server, set `DEBUG_MODULE_COMPREHENSION=1`, click Rebuild. Server log must show `[comprehension] effectiveModel= qwen2.5:14b-instruct`. UI must show “Model used (last rebuild): qwen2.5:14b-instruct” and “Model distribution: qwen2.5:14b-instruct: N”.

---

## 8) References

- Table: `db/migrations/runtime/20260127_add_module_chunk_comprehension.sql`
- Upsert + failure rows: `db/migrations/runtime/20260208_module_chunk_comprehension_upsert.sql` (adds UNIQUE(module_code, chunk_id), updated_at, comprehension_error)
- Writer: `tools/module_crawler/extract_module_comprehension_from_corpus.py` (idempotent upsert, writes failure rows on parse/LLM error, hard logging B1–B7)
- Forensic: `tools/module_crawler/run_forensic_comprehension.py` (A1/A2/A4), `tools/module_crawler/forensic_comprehension.sql` (raw queries)
- Consumer: `tools/module_crawler/extract_module_vulnerabilities_from_corpus.py` (reads comprehension to select chunks)
- Pipeline: `tools/module_crawler/run_module_generation_from_sources.py`
- Route: `app/api/admin/modules/[moduleCode]/standard/generate/route.ts` (runs TS-native comprehension when `REQUIRE_MODULE_COMPREHENSION=1`)
- Build/rebuild route: `app/api/admin/modules/[moduleCode]/comprehension/build/route.ts` (POST; optional body `{ forceRebuild: true }` to delete and rerun)
- TS runner: `app/lib/modules/comprehension/run_module_comprehension.ts`
