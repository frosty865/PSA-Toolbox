# OFC Candidate Mining V3

This mining system extracts capability-level OFC candidates from CORPUS documents following locked doctrine.

## Doctrine

- **OFCs are capability-level solution patterns** - describe WHAT capability exists, not HOW to implement
- **OFCs attach only to NO answers** - address gaps identified by negative responses
- **Documents/chunks are EVIDENCE only** - guide problem definition and solution justification
- **Candidates must be authored patterns** - not scraped sentences from prose
- **PSA scope only** - physical security, governance, planning, operations
- **NO cyber/data/IT/CSA/regulatory language** - strictly excluded
- **Hard separation** - CORPUS only, never module tables

## Components

### 1. Coverage Report (`tools/analytics/report_ofc_candidate_coverage_by_subtype.py`)

Generates coverage analysis showing:
- Subtypes with questions but low/zero candidate coverage
- Subtypes with many candidates already (avoid duplicating)

**Outputs:**
- `analytics/reports/ofc_candidate_coverage_by_subtype.json` - Full coverage report
- `analytics/reports/ofc_candidate_undercovered_subtypes.json` - Prioritized list of under-covered subtypes

### 2. Miner V3 (`tools/corpus/mine_ofc_candidates_v3.py`)

Mines candidates from CORPUS documents:
- Loads under-covered subtypes from coverage report
- Finds relevant chunks using subtype keywords
- Authors capability-level OFC candidates
- Validates against PSA doctrine
- Deduplicates against existing candidates
- Inserts into `ofc_candidate_queue` with `ofc_origin='CORPUS'`

**Arguments:**
- `--limit_subtypes N` - Limit subtypes to mine (default: 25)
- `--max_per_subtype N` - Max candidates per subtype (default: 30)
- `--min_confidence F` - Min confidence for subtype binding (default: 0.75)
- `--dry_run` - Dry run (no database writes)
- `--run_id STR` - Run ID (default: timestamp)

**Outputs:**
- `analytics/reports/ofc_v3_run_<run_id>_summary.json` - Run summary
- `analytics/reports/ofc_v3_run_<run_id>_accepted.json` - Accepted candidates
- `analytics/reports/ofc_v3_run_<run_id>_rejected.json` - Rejected candidates with reasons

### 3. Validator (`tools/validators/ofc_candidate_validator.py`)

Validates candidate text against PSA doctrine:
- PSA scope only (rejects cyber/IT/regulatory terms)
- No implementation verbs (install, deploy, configure, etc.)
- No priorities/cost/timeline language
- No tech/vendor/product naming patterns
- Must be "what capability exists" form
- Length 12-40 words
- Must not restate the question
- Must be subtype-bound

### 4. Runner (`tools/run_mine_ofc_v3.py`)

Runs the complete pipeline:
1. Generates coverage report
2. Runs miner on under-covered subtypes

**Arguments:**
- `--dry_run` - Dry run (no database writes)
- `--limit_subtypes N` - Limit subtypes to mine (default: 25)
- `--max_per_subtype N` - Max candidates per subtype (default: 30)

### 5. Guard (`scripts/guards/verifyNoModuleTableAccessInCorpusMiners.js`)

Scans corpus miners for forbidden module table references:
- Checks `tools/corpus/` directory
- Checks `tools/run_mine_ofc_v3.py`
- Fails if module table patterns found

## How to Run

### Step 1: Generate Coverage Report

```bash
python tools/analytics/report_ofc_candidate_coverage_by_subtype.py
```

This creates:
- `analytics/reports/ofc_candidate_coverage_by_subtype.json`
- `analytics/reports/ofc_candidate_undercovered_subtypes.json`

### Step 2: Run Mining (Dry Run First)

```bash
# Dry run to see what would be mined
python tools/run_mine_ofc_v3.py --dry_run

# Or run miner directly with custom limits
python tools/corpus/mine_ofc_candidates_v3.py --limit_subtypes 25 --max_per_subtype 30 --dry_run
```

### Step 3: Review Outputs

Check the reports in `analytics/reports/`:
- `ofc_v3_run_<run_id>_summary.json` - Summary statistics
- `ofc_v3_run_<run_id>_accepted.json` - Candidates that would be inserted
- `ofc_v3_run_<run_id>_rejected.json` - Rejected candidates with reasons

### Step 4: Run Actual Mining

```bash
# Set environment variable to allow writes
export ALLOW_MINER_APPLY=YES

# Run mining
python tools/run_mine_ofc_v3.py --limit_subtypes 25 --max_per_subtype 30
```

### Step 5: Verify Guard

```bash
node scripts/guards/verifyNoModuleTableAccessInCorpusMiners.js
```

Should pass with no violations.

## Environment Variables

Required:
- `CORPUS_DATABASE_URL` or `SUPABASE_CORPUS_URL`
- `CORPUS_DATABASE_PASSWORD` or `SUPABASE_CORPUS_SERVICE_ROLE_KEY`
- `RUNTIME_DATABASE_URL` or `SUPABASE_RUNTIME_URL`
- `RUNTIME_DATABASE_PASSWORD` or `SUPABASE_RUNTIME_SERVICE_ROLE_KEY`

Optional:
- `ALLOW_MINER_APPLY=YES` - Required for actual database writes (safety guard)

## Database Schema Requirements

### CORPUS Database
- `public.ofc_candidate_queue` with columns:
  - `candidate_id` (UUID, PK)
  - `snippet_text` (TEXT)
  - `source_id` (UUID, FK to canonical_sources)
  - `discipline_subtype_id` (UUID, nullable)
  - `status` (TEXT, default 'PENDING')
  - `ofc_origin` (TEXT, NOT NULL, CHECK IN ('CORPUS','MODULE'))
  - `document_chunk_id` (UUID, nullable)
  - `page_locator` (TEXT, nullable)
  - `section_heading` (TEXT, nullable)
- `public.documents` with `document_id`, `source_id`, `title`
- `public.document_chunks` with `chunk_id`, `document_id`, `chunk_text`, `page_number`, `section_heading`

### RUNTIME Database
- `public.discipline_subtypes` with `id`, `code`, `name`, `is_active`
- `public.disciplines` with `id`, `code`, `name`
- `public.baseline_spines_runtime` with `canon_id`, `discipline_subtype_id`, `active`

## Validation Rules

Candidates are rejected if they:
1. Contain PSA exclusion terms (cyber, IT, regulatory)
2. Contain implementation verbs (install, deploy, configure, etc.)
3. Contain priority/cost/timeline language
4. Contain tech/vendor/product patterns
5. Are not in capability form (what exists, not how-to)
6. Are too short (<12 words) or too long (>40 words)
7. Restate question patterns
8. Are not bound to a subtype
9. Are exact or near-duplicates of existing candidates

## Output Format

### Accepted Candidate
```json
{
  "candidate_id": "uuid",
  "snippet_text": "Access control systems are implemented at all entry points.",
  "discipline_subtype_id": "uuid",
  "source_id": "uuid",
  "document_id": "uuid",
  "chunk_id": "uuid",
  "page_number": 5,
  "section_heading": "Access Control",
  "subtype_code": "ACS_BIOMETRIC_ACCESS",
  "subtype_name": "Biometric Access"
}
```

### Rejected Candidate
```json
{
  "subtype_id": "uuid",
  "subtype_code": "ACS_BIOMETRIC_ACCESS",
  "candidate_text": "Install biometric access control systems.",
  "reject_reason": "validation_failed",
  "validation_reasons": ["Contains implementation verb: 'install'"],
  "chunk_id": "uuid",
  "document_id": "uuid"
}
```

## Notes

- The miner uses deterministic keyword matching to find relevant chunks (no LLM inference for chunk selection)
- The authoring step uses simple pattern extraction (can be enhanced with Ollama/LLM with strict constraints)
- Deduplication uses normalized text comparison and simple Jaccard similarity (can be enhanced with proper TF-IDF + cosine similarity)
- All candidates are inserted with `ofc_origin='CORPUS'` to enforce hard separation
- Candidates start with `status='PENDING'` and require review before promotion
