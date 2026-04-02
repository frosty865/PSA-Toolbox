# Storage roots (Corpus, Module, Technology)

All ingestion lands under **incoming/**; PDFs are placed in **raw/** with **no additional folders**.

Base path: `D:\PSA_System\psa_rebuild\storage` (or repo-relative `storage/`).

## Env (from .env.local or process.env)

- **CORPUS_SOURCES_ROOT** — default `storage/corpus_sources`. Corpus evidence library.
- **MODULE_SOURCES_ROOT** — default `storage/module_sources`. Module uploads and staging.
- **TECHNOLOGY_SOURCES_ROOT** — default `storage/technology_sources`. Technology library.

## Layout (all three)

Each root has only **incoming/** and **raw/**.

**CORPUS** (`storage/corpus_sources/`):

- **incoming/** — where corpus ingestion lands (e.g. crawler, download). No subdirs.
- **raw/** — canonical PDFs. Flat: `raw/<filename>.pdf`. No tier, blob, or collection subdirs.

**MODULE** (`storage/module_sources/`):

- **incoming/** — where module PDFs land before ingest. Flat; no per-module subdirs.
- **raw/** — canonical PDFs. Flat: `raw/<sha256>.pdf` (one file per SHA256). No `_blobs` or prefix subdirs.

**TECHNOLOGY** (`storage/technology_sources/`):

- **incoming/** — staging for technology PDFs. No subdirs.
- **raw/** — canonical PDFs. Flat: `raw/<filename>.pdf`. No additional folders.

## Path normalization (existing DBs)

To update existing DB paths to this organization (flat raw only):

```bash
cd psa_rebuild
npx tsx scripts/normalize_storage_paths_to_flat_raw.ts [--dry-run]
```

Then ensure PDFs on disk are under the corresponding `storage/*/raw/` to match. For corpus you can run:

```bash
npx tsx scripts/backfill_corpus_document_paths_from_disk.ts [--dry-run]
```

to set `corpus_documents.canonical_path` from files found under CORPUS_SOURCES_ROOT.

## Rules

- Corpus ingestion: under `storage/corpus_sources/incoming` → PDFs in `storage/corpus_sources/raw`.
- Module ingestion: under `storage/module_sources/incoming` → PDFs in `storage/module_sources/raw`.
- Technology: under `storage/technology_sources/incoming` → PDFs in `storage/technology_sources/raw`.
- Do not create additional folders under `raw/` (no tier1, _blobs, MODULE_*, etc.).
- Never mix: do not write module uploads into corpus or technology, or the reverse.
