# Module-Baseline Table Separation

## Overview

Modules and baseline content are **completely separate** and must never access each other's tables. This document defines the separation rules and enforcement mechanisms.

## Separation Rules

### 1. Module Tables (Module-Only Access)

**Modules can ONLY read/write to these tables:**

- `assessment_modules` - Module metadata
- `module_questions` - Module-specific questions (MODULEQ_*)
- `module_ofcs` - Module-specific OFCs (MOD_OFC_*)
- `module_ofc_sources` - Sources for module OFCs
- `module_risk_drivers` - Module risk drivers (read-only context)
- `module_import_batches` - Import history
- `assessment_module_instances` - Module-to-assessment links
- `assessment_module_question_responses` - User responses to module questions
- `module_instances` - Doctrine-generated instances
- `module_instance_criteria` - Instance criteria questions
- `module_instance_criterion_responses` - Instance criterion responses
- `module_instance_ofcs` - Instance OFCs
- `module_drafts` - Draft shells
- `module_draft_sources` - Draft sources
- `module_draft_questions` - Draft questions
- `module_sources` - Module research sources (RUNTIME)
- `module_vofc_library` - Module VOFC library
- `module_vulnerability_candidates` - Vulnerability candidates
- `module_chunk_comprehension` - Chunk comprehension
- `module_corpus_links` - Read-only pointers to CORPUS
- `module_documents` - Module-scoped documents
- `module_chunks` - Module-scoped chunks
- `module_evidence` - Module evidence

**Shared Reference Tables (OK for modules to read):**
- `disciplines` - Shared taxonomy
- `discipline_subtypes` - Shared taxonomy
- `assessments` - To check assessment state
- `sectors` / `subsectors` - For reconciliation

### 2. Baseline Content Tables (Modules Must NOT Access)

**Modules must NEVER query these tables:**

- `baseline_spines_runtime` - Baseline question registry
- `baseline_questions` - Baseline questions
- `baseline_ofcs` - Baseline OFCs
- `baseline_references` - Baseline references
- `ofc_library` - Baseline OFC library
- `ofc_candidate_queue` - Baseline OFC candidates
- `canonical_sources` - Baseline canonical sources

### 3. CORPUS Tables (Modules Can ONLY Read Module Corpus, Not General Corpus)

**Modules can ONLY read from MODULE corpus (filtered by scope_tags):**

- `source_registry` - ONLY sources with `scope_tags->'tags'->>'module_code' = <module_code>` AND `scope_tags->>'ingestion_stream' = 'MODULE'`
- `corpus_documents` - ONLY documents linked to module corpus sources
- `document_chunks` - ONLY chunks from module corpus documents
- `module_source_documents` - Cross-database links to module corpus (CORPUS)
- `module_chunk_links` - Cross-database links to module corpus chunks (CORPUS)

**Modules CANNOT read from general assessment corpus:**
- Sources with `ingestion_stream = 'GENERAL'` are forbidden
- Must always filter by `scope_tags->'tags'->>'module_code'` and `ingestion_stream = 'MODULE'`

**Modules CANNOT write to CORPUS** (enforced by read-only guard in `corpus_client.ts`)

## Enforcement

### 1. Table Access Guards

**File:** `app/lib/modules/table_access_guards.ts`

Provides:
- `guardModuleQuery(sql, context)` - Comprehensive guard for module queries
- `assertModuleNoBaselineContent(sql, context)` - Blocks baseline content table access
- `assertModuleWriteOnly(sql, context)` - Ensures writes only to module tables
- `assertNoBaselineReferences(sql, context)` - Blocks BASE-* question ID references

### 2. Applied Guards

Guards are applied to:
- `app/lib/modules/generation/generate_module_content.ts` - Module content generation
- `app/lib/modules/module_suggestions.ts` - Module question suggestions
- `app/lib/admin/module_import_v2.ts` - Module import (write operations)

### 3. Validation Rules

**Module Import Validation:**
- Rejects questions with `BASE-*` IDs
- Rejects OFCs with `IST_OFC_*` IDs (must use `MOD_OFC_*`)
- Validates discipline ownership (ensures questions are module-scoped)

**Module Generation:**
- Only reads from CORPUS (source_registry, corpus_documents, document_chunks)
- Only writes to module tables
- Never references baseline questions/OFCs

## Query Patterns

### ✅ Allowed Module Queries

```sql
-- Read module questions
SELECT * FROM module_questions WHERE module_code = 'MODULE_EV_PARKING';

-- Read module OFCs
SELECT * FROM module_ofcs WHERE module_code = 'MODULE_EV_PARKING';

-- Read from CORPUS (read-only)
SELECT * FROM source_registry WHERE id = '...';
SELECT * FROM corpus_documents WHERE source_registry_id = '...';
SELECT * FROM document_chunks WHERE document_id = '...';

-- Write to module tables
INSERT INTO module_questions (module_code, ...) VALUES (...);
INSERT INTO module_ofcs (module_code, ...) VALUES (...);
```

### ❌ Forbidden Module Queries

```sql
-- ❌ Access baseline content tables
SELECT * FROM baseline_questions;
SELECT * FROM baseline_ofcs;
SELECT * FROM ofc_library;
SELECT * FROM baseline_spines_runtime;

-- ❌ Reference baseline question IDs
SELECT * FROM module_questions WHERE question_id LIKE 'BASE-%';

-- ❌ Write to CORPUS
INSERT INTO corpus_documents (...);  -- Blocked by read-only guard
INSERT INTO source_registry (...);  -- Blocked by read-only guard
```

## Database-Level Enforcement

### RUNTIME Database

- Module tables are in RUNTIME
- Baseline reference tables (baseline_spines_runtime) are in RUNTIME
- Modules can read baseline_spines_runtime for validation only (not for content)

### CORPUS Database

- Runtime app has READ-ONLY access (enforced in `corpus_client.ts`)
- Modules can read source_registry, corpus_documents, document_chunks
- Modules cannot write to CORPUS

## Migration Path

1. ✅ Guards created in `table_access_guards.ts`
2. ✅ Applied to key module functions
3. ⏳ Add guards to all module API routes
4. ⏳ Add database-level constraints (if needed)
5. ⏳ Add CI checks to prevent regressions

## Verification

Run guards to verify separation:

```typescript
import { guardModuleQuery } from '@/app/lib/modules/table_access_guards';

// In module functions:
guardModuleQuery(sql, 'function_name: operation');
```

## Files

- `app/lib/modules/table_access_guards.ts` - Guard functions
- `app/lib/modules/generation/generate_module_content.ts` - Content generation (guarded)
- `app/lib/modules/module_suggestions.ts` - Question suggestions (guarded)
- `app/lib/admin/module_import_v2.ts` - Module import (guarded)
