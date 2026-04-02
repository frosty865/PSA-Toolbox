# Database Ownership Enforcement

## Overview

This document describes the ownership enforcement system that prevents cross-contamination between CORPUS and RUNTIME databases.

## Single Source of Truth

**File**: `config/db_ownership.json`

This file is the authoritative mapping of which database owns which table. All pool guards and diagnostics use this file.

## Components

### 1. Pool Introspection (`app/lib/db/pool_introspection.ts`)
- `dbIdentity()` - Get database identity (db name, user, schema, search_path)
- `tableExists()` - Check if a table exists (using fully qualified table name)

### 2. Pool Guard (`app/lib/db/pool_guard.ts`)
- `assertTableOnOwnerPool(fqtn)` - Assert table exists ONLY on its owner pool
- `assertTablesOnOwnerPools(fqtns[])` - Assert multiple tables at once
- Throws `PoolOwnershipViolation` with detailed error information if violated

### 3. Diagnostics Endpoint
**Route**: `/api/admin/diagnostics/ownership`

Returns compliance status for all tables in the ownership map.

**Response format**:
```json
{
  "ok": true,
  "total_tables": 20,
  "compliant": 20,
  "violations": 0,
  "results": [
    {
      "fqtn": "public.ofc_candidate_queue",
      "expected": "CORPUS",
      "ok": true
    },
    ...
  ]
}
```

## Guarded Routes

### CORPUS-Owned Tables
- `/api/admin/ofcs/candidates/[candidate_id]` (PATCH, GET)
  - Guards: `ofc_candidate_queue`, `ofc_candidate_targets`, `ofc_library_citations`

### RUNTIME-Owned Tables
- `/api/runtime/assessments` (GET, POST)
  - Guards: `assessments`
- `/api/runtime/assessments/[assessmentId]` (GET)
  - Guards: `assessments`
- `/api/runtime/assessments/[assessmentId]/expansion-questions` (GET)
  - Guards: `assessments`, `expansion_questions`, `disciplines`, `discipline_subtypes`

## Error Handling

When a pool ownership violation is detected:

1. **Guard throws `PoolOwnershipViolation`** with details:
   - Expected owner pool
   - Observed state (inCorpus, inRuntime)
   - Database identities
   - Error code: `POOL_OWNERSHIP_VIOLATION`

2. **Route returns 500 error** with details:
   ```json
   {
     "error": "Failed to update candidate",
     "message": "Table must exist ONLY on its owner pool. No duplicates.",
     "details": {
       "error_code": "POOL_OWNERSHIP_VIOLATION",
       "fqtn": "public.ofc_candidate_queue",
       "expected_owner": "CORPUS",
       "observed": {
         "inCorpus": true,
         "inRuntime": true
       },
       ...
     }
   }
   ```

## Verification

### 1. Check Ownership Compliance
```bash
curl http://localhost:3000/api/admin/diagnostics/ownership
```

Should return `"ok": true` with all tables compliant.

### 2. Run Pool Audit
```bash
npm run db:audit
```

Should report:
- `duplicates: 0`
- `mapping_errors: 0`

### 3. Test Guarded Routes
- Promote candidate route should fail fast if tables are duplicated
- Assessment routes should fail fast if taxonomy tables are on wrong pool

## Adding New Tables

1. **Add to ownership map**: `config/db_ownership.json`
   ```json
   {
     "owners": {
       "public.new_table": "CORPUS"  // or "RUNTIME"
     }
   }
   ```

2. **Add guards to routes** that use the table:
   ```typescript
   import { assertTableOnOwnerPool } from '@/app/lib/db/pool_guard';
   
   // At start of route handler
   await assertTableOnOwnerPool("public.new_table");
   ```

3. **Verify**: Run diagnostics endpoint and audit

## Hard Rules

- ✅ **NO TABLE MAY EXIST IN BOTH POOLS**
- ✅ Tables must exist ONLY on their owner pool
- ✅ Guards fail fast (hard error, no silent failures)
- ✅ Ownership map is authoritative (single source of truth)

## Related Tools

- `npm run db:audit` - General pool separation audit
- `npm run db:pool-diff` - Compare CORPUS vs RUNTIME schemas
- `npm run db:pool-cleanup-sql` - Generate cleanup SQL
- `/api/admin/diagnostics/ownership` - Ownership compliance check
