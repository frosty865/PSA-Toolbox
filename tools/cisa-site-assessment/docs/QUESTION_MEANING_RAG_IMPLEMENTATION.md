# Question Meaning RAG Implementation

## Overview

This document describes the RAG (Retrieval-Augmented Generation) system for generating plain-language question meanings for the 14 core baseline questions using Ollama and corpus evidence.

## Architecture

### Components

1. **Discipline Frames** (`model/meaning/discipline_frames.v1.json`)
   - Hard-coded frames for each discipline (CPTED, ACS, PER, INT, VSS, GOV, EMR, COM)
   - Defines `meaning_goal`, `allowed_concepts`, and `forbidden_concepts`
   - Acts as anti-drift guardrails

2. **Database Schema** (`db/migrations/20260118_create_question_meaning.sql`)
   - `public.question_meaning` table stores derived meanings
   - Fields: `canon_id`, `discipline`, `meaning_text`, `citations`, `derived_at`, `model_name`, `locked`, `warnings`

3. **Retrieval** (`model/meaning/retrieve_evidence.py`)
   - Queries `citation_ready_statements` view (or corpus_documents)
   - Filters evidence by discipline frame (allowed/forbidden concepts)
   - Ensures diversity (at least 3 distinct documents)
   - Returns 6-12 evidence items

4. **Ollama Generation** (`model/meaning/ollama_generate_meaning.py`)
   - Uses Ollama API for closed-world compression
   - Prompt enforces 8th grade reading level, max 3 sentences
   - Returns JSON with `meaning_text` and `citations_used`

5. **Validation** (`model/meaning/validate_meaning.py`)
   - Hard fails on forbidden concepts, banned phrases
   - Validates sentence count (max 3)
   - Validates citations are subset of evidence
   - Checks meaning mentions key nouns from question

6. **Orchestrator** (`tools/meaning/build_core_14_meaning.py`)
   - Loads 14 core questions (discipline-level, subtype_code IS NULL)
   - For each question: retrieve → generate → validate → save
   - Generates report: `analytics/reports/core14_meaning_build.json`

7. **UI Integration**
   - API endpoint: `/api/runtime/question-meaning/[canonId]`
   - `IntentPanel` component displays `meaning_text` if available
   - Falls back to "Meaning not yet derived for this question" if missing

## Usage

### 1. Verify Database Configuration

```bash
# Test database connectivity and required tables
python tools/db/db_smoketest.py
```

This will verify:
- Database connection works
- `public.corpus_documents` table exists
- `public.citation_ready_statements` view exists
- `public.question_meaning` table exists

### 2. Create Database Table (if needed)

```bash
# Run migration (if table doesn't exist)
# Using psql with DATABASE_URL:
psql $DATABASE_URL -f db/migrations/20260118_create_question_meaning.sql

# Or using Supabase connection:
psql "postgresql://postgres:$SUPABASE_RUNTIME_DB_PASSWORD@$HOST:6543/postgres?sslmode=require" \
  -f db/migrations/20260118_create_question_meaning.sql
```

### 3. Create Citation Ready Statements View (if needed)

```bash
# Create view (adapt based on actual corpus schema)
psql $DATABASE_URL -f db/sql/create_citation_ready_statements_view.sql
```

### 4. Generate Meanings

```bash
# Set environment variables (or use .env.local)
export DATABASE_URL="postgresql://..."  # Preferred
# OR
export SUPABASE_RUNTIME_URL="https://..."
export SUPABASE_RUNTIME_DB_PASSWORD="..."
# OR (REST fallback)
export SUPABASE_URL="https://..."
export SUPABASE_SERVICE_ROLE_KEY="..."

export OLLAMA_URL="http://localhost:11434"  # Optional, defaults to localhost
export OLLAMA_MODEL="llama2"  # Optional, defaults to llama2

# Run orchestrator
python tools/meaning/build_core_14_meaning.py
```

The script will automatically:
- Detect available connection mode (Postgres or REST)
- Connect to database
- Load 14 core questions
- Retrieve evidence from corpus
- Generate meanings with Ollama
- Validate and save results

### 5. View Results

Check `analytics/reports/core14_meaning_build.json` for success/failure report.

## Configuration

### Environment Variables (Required for Scripts)

**Preferred (Postgres Direct Connection):**
- `DATABASE_URL`: Full PostgreSQL connection string (preferred)
  - Example: `postgresql://postgres:password@host:port/postgres?sslmode=require`

**Fallback Option 1 (Supabase Runtime):**
- `SUPABASE_RUNTIME_URL`: Supabase project URL
- `SUPABASE_RUNTIME_DB_PASSWORD`: Database password

**Fallback Option 2 (Supabase REST API):**
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for REST API

**Ollama Configuration:**
- `OLLAMA_URL`: Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Ollama model name (default: `llama2`)

### Database Connection Modes

The system automatically selects the connection mode:
1. **Postgres mode** (preferred): Uses direct PostgreSQL connection via `DATABASE_URL` or `SUPABASE_RUNTIME_URL` + password
2. **Supabase REST mode** (fallback): Uses PostgREST API when direct Postgres is unavailable

Run `python tools/db/db_smoketest.py` to verify your database configuration.

### Discipline Frames

Edit `model/meaning/discipline_frames.v1.json` to adjust:
- `meaning_goal`: What the explanation should teach
- `allowed_concepts`: Concepts that evidence must match
- `forbidden_concepts`: Concepts that evidence/meaning must avoid

## Validation Rules

Meanings are rejected if they:
- Contain any `forbidden_concepts` (case-insensitive)
- Contain banned phrases: "assesses whether", "authoritative guidance", "capability", "assumes", "OFC"
- Have more than 3 sentences
- Cite chunks not in provided evidence
- Don't mention key nouns from question (warning only)

## UI Display

The `IntentPanel` component displays:
1. **What this question means** (if `meaning_text` exists) - RAG-derived meaning
2. **Intent** - Condition-support model intent
3. **What counts as YES** - Standardized verification blocks
4. **What does NOT count** - Standardized verification blocks
5. **Typical evidence** - Standardized verification blocks
6. **Field tip** - Standardized verification blocks

If `meaning_text` is missing, shows: "Meaning not yet derived for this question."

## Troubleshooting

### No Evidence Retrieved

- Check `citation_ready_statements` view exists and has data
- Verify discipline frame `allowed_concepts` match corpus content
- Check keywords extracted from question text

### Ollama Generation Fails

- Verify `OLLAMA_URL` is accessible
- Check `OLLAMA_MODEL` is installed: `ollama list`
- Review Ollama logs for errors

### Validation Fails

- Check meaning doesn't contain forbidden concepts
- Ensure meaning is ≤3 sentences
- Verify citations match evidence chunk_ids

## Future Enhancements

- Batch meaning generation for all questions (not just core 14)
- Citation display in UI (show source documents)
- Meaning regeneration with updated corpus
- Meaning versioning/history
