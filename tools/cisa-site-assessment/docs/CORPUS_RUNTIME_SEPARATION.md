# CORPUS vs RUNTIME Database Separation

## Overview

The PSA system uses **two separate Supabase projects** to maintain clear separation between corpus/document management and runtime assessment data.

## Project Mapping

### RUNTIME Project
- **Project ID**: `wivohgbuuwxoyfyzntsd`
- **URL**: `https://wivohgbuuwxoyfyzntsd.supabase.co`
- **Purpose**: Runtime assessment execution and OFC library
- **Tables**:
  - `assessments`
  - `assessment_instances`
  - `assessment_responses`
  - `ofc_nominations`
  - `ofc_library`
  - `ofc_library_citations`
  - `expansion_questions`
  - `assessment_expansion_responses`
  - All assessment-related tables

### CORPUS Project
- **Project ID**: `yylslokiaovdythzrbgt`
- **URL**: `https://yylslokiaovdythzrbgt.supabase.co`
- **Purpose**: Document corpus, ingestion, and candidate discovery
- **Tables**:
  - `canonical_sources`
  - `documents`
  - `document_chunks`
  - `ingestion_runs`
  - `ingestion_run_documents`
  - `ofc_candidate_queue`
  - `ofc_candidate_targets`

## Environment Variables

### Required Variables

```bash
# RUNTIME
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_ANON_KEY="..."
SUPABASE_RUNTIME_SERVICE_ROLE_KEY="..."

# CORPUS
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_ANON_KEY="..."
SUPABASE_CORPUS_SERVICE_ROLE_KEY="..."
```

### Hard Rules

1. **Do NOT set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`** (legacy, removed)
2. **Do NOT reuse keys between projects** - each project has its own keys
3. **Service role keys are server-only** - never ship them to the browser
4. **Explicit clients only** - use `getRuntimePool()` or `getCorpusPool()`, never a global client

## Database Clients

### Runtime Client

**File**: `app/lib/db/runtime_client.ts`

```typescript
import { getRuntimePool } from '@/app/lib/db/runtime_client';

const pool = getRuntimePool();
// Use for: assessments, ofc_library, expansion_questions, etc.
```

**Usage**: All routes under `/api/runtime/*` (except corpus-specific endpoints)

### Corpus Client

**File**: `app/lib/db/corpus_client.ts`

```typescript
import { getCorpusPool } from '@/app/lib/db/corpus_client';

const pool = getCorpusPool();
// Use for: canonical_sources, documents, ofc_candidate_queue, etc.
```

**Usage**: 
- Routes under `/api/corpus/*`
- Ingestion tools
- Candidate matching scripts

## Route Mapping

### Runtime Routes (use `getRuntimePool()`)
- `/api/runtime/assessments/*`
- `/api/runtime/assessments/[id]/questions`
- `/api/runtime/assessments/[id]/responses`
- `/api/runtime/assessments/[id]/status`
- `/api/runtime/ofc-library/*`
- `/api/runtime/expansion-profiles/*`
- `/api/runtime/assessments/[id]/expansion-*`

### Corpus Routes (use `getCorpusPool()`)
- `/api/runtime/ofc-candidates` (candidates are in CORPUS)
- `/api/runtime/question-coverage` (coverage uses CORPUS candidates)
- `/api/corpus/*` (future corpus endpoints)

## Schema Application

### CORPUS Schema

**Migration**: `migrations/20260113_create_corpus_schema.sql`

**Apply to**: CORPUS project only (`yylslokiaovdythzrbgt`)

**Safety Check** (run first):
```sql
SELECT current_database();
SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name IN ('assessments', 'assessment_instances')
  LIMIT 1;
```

If you see `assessments` or `assessment_instances`, **STOP** - you're in the wrong project.

### RUNTIME Schema

**Migrations**: All other migrations (assessment tables, OFC library, expansion, etc.)

**Apply to**: RUNTIME project only (`wivohgbuuwxoyfyzntsd`)

## Health Check

**Endpoint**: `GET /api/admin/health/dbs`

**Returns**:
```json
{
  "runtime_ok": true,
  "corpus_ok": true,
  "runtime_project": "wivohgbuuwxoyfyzntsd",
  "corpus_project": "yylslokiaovdythzrbgt",
  "runtime_matches": true,
  "corpus_matches": true
}
```

**Verification**:
- Queries RUNTIME: `SELECT 1 FROM assessments LIMIT 1`
- Queries CORPUS: `SELECT 1 FROM canonical_sources LIMIT 1`

## Migration Safety

### Before Running CORPUS Migration

1. **Confirm project**: Check Supabase dashboard URL shows `yylslokiaovdythzrbgt`
2. **Check for runtime tables**: Run safety check SQL
3. **Backup**: Consider backing up existing data (if any)

### After Running CORPUS Migration

1. **Verify tables exist**: Run post-check SQL
2. **Verify counts**: All tables should be empty (counts = 0)
3. **Test health endpoint**: Verify both databases are accessible

## Code Updates Required

### Update Existing Code

Replace all instances of:
```typescript
import { getPool } from '@/app/lib/db';
const pool = getPool();
```

With:
```typescript
// For runtime routes
import { getRuntimePool } from '@/app/lib/db/runtime_client';
const pool = getRuntimePool();

// For corpus routes
import { getCorpusPool } from '@/app/lib/db/corpus_client';
const pool = getCorpusPool();
```

### Deprecated Function

`getPool()` in `app/lib/db.ts` is deprecated and redirects to `getRuntimePool()` for backward compatibility. All new code should use explicit clients.

## Verification Checklist

- [ ] CORPUS schema exists only in `yylslokiaovdythzrbgt`
- [ ] Runtime assessment tables remain only in `wivohgbuuwxoyfyzntsd`
- [ ] Environment variables set correctly (no `SUPABASE_URL`)
- [ ] All routes use correct client (`getRuntimePool()` or `getCorpusPool()`)
- [ ] Health check endpoint returns `runtime_ok: true` and `corpus_ok: true`
- [ ] No legacy `DATABASE_URL` usage remains

## Related Documentation

- `docs/OFC_LIBRARY_EVIDENCE_MODEL.md` - OFC library (RUNTIME)
- `docs/OFC_DISCOVERY_COVERAGE.md` - Candidate discovery (CORPUS)

