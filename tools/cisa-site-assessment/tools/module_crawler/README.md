# Module Crawler - Source-Driven Module Pipeline

This pipeline implements a V2 source-driven module creation system with a **comprehension layer** that interprets chunks before vulnerability extraction.

## Pipeline Overview

1. **Comprehension Pass**: Interprets chunks and creates structured, source-anchored meaning labels
2. **Vulnerability Extraction**: Consumes comprehension signals to extract vulnerabilities (only processes chunks marked `supports_question_generation=true`)
3. **Question Building**: Deduplicates vulnerabilities, selects <=12, and creates module questions with >=2 OFCs each

## Architecture

### Database Tables

**RUNTIME:**
- `module_chunk_comprehension`: Structured comprehension outputs from chunks
- `module_vulnerability_candidates`: Vulnerability candidates extracted from chunks
- `module_questions`: Final module questions (<=12) with OFCs and evidence

### Key Concepts

- **Comprehension Layer**: Structured interpretation of chunks before vulnerability extraction
  - Labels domains (LIFE_SAFETY, OPERATIONS, PHYSICAL_SECURITY, etc.)
  - Marks site-observable, generation priority, and signal flags
  - Filters out cyber technical content (only allows awareness-level cyber)

- **Vulnerability Extraction**: Consumes comprehension to force LIFE_SAFETY/OPS coverage when present
  - Only processes chunks with `supports_question_generation=true`
  - Uses `life_safety_signal` and `ops_signal` to prioritize extraction
  - Generates 2-4 OFCs per vulnerability

- **Question Building**: Final stage that ensures <=12 questions
  - Deduplicates similar vulnerabilities
  - Each question has >=2 OFCs (capped at 4)
  - Preserves evidence anchors

## Setup

### Prerequisites

1. Python dependencies:
```bash
pip install psycopg2-binary jsonschema requests
```

2. Environment variables (use same as rest of project):
```bash
# Prefer these (match .env.local):
export CORPUS_DATABASE_URL="postgresql://..."
export RUNTIME_DATABASE_URL="postgresql://..."

# Or legacy names:
export CORPUS_DB_URL="postgresql://..."
export RUNTIME_DB_URL="postgresql://..."

export OLLAMA_HOST="http://127.0.0.1:11434"  # Optional, defaults to this
```

3. Database migrations:
```bash
# Run on RUNTIME database
psql $RUNTIME_DB_URL -f db/migrations/runtime/20260127_add_module_chunk_comprehension.sql
psql $RUNTIME_DB_URL -f db/migrations/runtime/20260127_add_module_vulnerability_candidates.sql
```

## Usage

### Debug: Validate env and DB (--check)

Before running the pipeline, validate that DB URLs are set and the module has tagged sources and chunks:

```bash
python tools/module_crawler/run_module_generation_from_sources.py \
  --module-code MODULE_EV_PARKING \
  --check
```

This prints: source_registry row count for the module, document_chunks count, and whether the module exists in assessment_modules. If counts are 0, fix source tagging or ingestion first.

### Step 1: Comprehension Pass

Creates structured comprehension labels for chunks:

```bash
python tools/module_crawler/extract_module_comprehension_from_corpus.py \
  --module-code MODULE_EV_PARKING \
  --model llama3.1:8b-instruct \
  --max-chunks 160 \
  --apply
```

**What it does:**
- Reads chunks from CORPUS where `source_registry.scope_tags->>'module_code' = MODULE_EV_PARKING`
- For each chunk, calls LLM to generate comprehension labels
- Filters out cyber technical content
- Inserts into `module_chunk_comprehension` table

### Step 2: Vulnerability Extraction

Extracts vulnerabilities using comprehension signals:

```bash
python tools/module_crawler/extract_module_vulnerabilities_from_corpus.py \
  --module-code MODULE_EV_PARKING \
  --model llama3.1:8b-instruct \
  --max-chunks 140 \
  --apply
```

**What it does:**
- Reads comprehension rows where `supports_question_generation=true`
- Orders by priority (HIGH > MEDIUM > LOW)
- For each chunk, calls LLM to extract vulnerability + OFCs
- Uses `life_safety_signal`/`ops_signal` to force inclusion when present
- Inserts into `module_vulnerability_candidates` table

### Step 3: Build Questions

Deduplicates and creates final module questions:

```bash
python tools/module_crawler/build_module_questions_from_vulns.py \
  --module-code MODULE_EV_PARKING \
  --model llama3.1:8b-instruct \
  --max-questions 12 \
  --apply
```

**What it does:**
- Reads vulnerability candidates ordered by confidence
- Deduplicates by normalized title+vulnerability_text using Jaccard similarity
- Ensures coverage: LIFE_SAFETY (>=2) + OPERATIONS (>=2) when present
- Selects top <=12 candidates
- Creates `module_questions` with question text, OFCs, and evidence

**What it does:**
- Reads vulnerability candidates ordered by confidence
- Deduplicates by normalized title+vulnerability_text
- Filters to ensure >=2 OFCs per candidate
- Selects top <=12 candidates
- Creates `module_questions` with question text, OFCs, and evidence

## Output Guarantees

- **<=12 questions** per module
- **Each question has 2-4 OFCs** (minimum 2, maximum 4)
- **Evidence preserved** (source_registry_id, doc_id, chunk_id, locator)
- **Module-scoped** (all questions linked to module_code)

## File Structure

```
tools/module_crawler/
├── README.md (this file)
├── extract_module_comprehension_from_corpus.py
├── extract_module_vulnerabilities_from_corpus.py
├── build_module_questions_from_vulns.py
├── run_module_generation_from_sources.py (single runner)
└── llm/
    ├── ollama_json.py
    ├── module_chunk_to_comprehension.schema.json
    ├── system_prompt_module_chunk_to_comprehension.txt
    ├── module_chunk_to_vulnerability.schema.json
    └── system_prompt_module_chunk_to_vulnerability.txt
```

## Quick Start (Single Command)

Run the complete pipeline with a single command:

**PowerShell:**
```powershell
python tools/module_crawler/run_module_generation_from_sources.py --module-code MODULE_EV_PARKING --model llama3.1:8b-instruct --apply --max-questions 12
```

Or with line continuation (PowerShell uses backticks):
```powershell
python tools/module_crawler/run_module_generation_from_sources.py `
  --module-code MODULE_EV_PARKING `
  --model llama3.1:8b-instruct `
  --apply `
  --max-questions 12
```

**Bash/Linux:**
```bash
python tools/module_crawler/run_module_generation_from_sources.py \
  --module-code MODULE_EV_PARKING \
  --model llama3.1:8b-instruct \
  --apply \
  --max-questions 12
```

This executes all three steps in sequence.

## Troubleshooting

### "No chunks found for module_code"
- Check that `source_registry.scope_tags->>'module_code'` is set correctly
- Verify chunks exist in CORPUS for the module

### "No comprehension rows found"
- Run Step 1 (comprehension pass) first
- Check that chunks passed the cyber technical filter

### "No candidates with >=2 OFCs"
- Check vulnerability extraction output
- Verify LLM is generating OFCs (check schema validation)

## Notes

- The comprehension pass is **not a separate model** - it's a separate **PASS** with a separate system prompt + schema
- Any decent instruct model in Ollama can do it under JSON-mode constraints
- The pipeline enforces PSA scope: physical security only, no cyber technical controls
- Life safety and operations signals are used to prioritize extraction when present
