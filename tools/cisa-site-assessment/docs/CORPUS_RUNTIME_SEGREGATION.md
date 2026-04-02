# CORPUS-RUNTIME Hard Segregation

## Overview

This document describes the hard segregation between CORPUS (global evidence store) and RUNTIME (module-scoped data). Module uploads **NEVER** become CORPUS rows. Modules can only **ATTACH** (pointer) to CORPUS evidence via read-only references.

## Non-Negotiable Rules

1. **Module uploads NEVER become CORPUS rows**
   - No copy, no promote, no "ingest into corpus"
   - Module uploads remain in RUNTIME only

2. **Modules may ATTACH (pointer) to CORPUS evidence**
   - Read-only reference via `module_corpus_links` table
   - Stores only `corpus_source_registry_id` from CORPUS DB
   - No copying of documents/chunks

3. **UI must never show module data inside CORPUS views or vice-versa**
   - Two separate sections: "Module Uploads" and "Attached Evidence (CORPUS)"
   - No mixing, no promotion buttons

## Database Structure

### RUNTIME Database

#### `module_documents`
- Stores module-scoped evidence documents
- `source_type` = 'MODULE_UPLOAD' only
- Never copied to CORPUS

#### `module_chunks`
- Text chunks extracted from `module_documents`
- Module-scoped only
- Locators are module-local

#### `module_corpus_links`
- Read-only pointers to CORPUS sources
- Stores `corpus_source_registry_id` (ID from CORPUS DB)
- No copying, no promotion

### CORPUS Database

#### Read-Only Access from Runtime App
- Runtime app role has `SELECT` only
- No `INSERT`, `UPDATE`, `DELETE` permissions
- Physical segregation enforced at database level

## API Endpoints

### Disabled
- `POST /api/admin/modules/[moduleCode]/sources/[moduleSourceId]/promote-to-corpus`
  - Returns `410 Gone` with error message
  - Promotion is disabled

### New Endpoints

#### `POST /api/admin/modules/[moduleCode]/corpus-links`
Attach a CORPUS source to a module via read-only pointer.

**Body:**
```json
{
  "corpus_source_registry_id": "uuid",
  "label": "optional label",
  "notes": "optional notes"
}
```

**Action:** Insert into `RUNTIME.module_corpus_links` only. Does NOT copy documents/chunks.

#### `GET /api/admin/modules/[moduleCode]/corpus-links`
List CORPUS sources attached to this module.

**Returns:** Pointers from `RUNTIME.module_corpus_links`. For display, fetch CORPUS metadata separately (read-only SELECT from CORPUS).

## Code Enforcement

### Read-Only Guard in `corpus_client.ts`

The `getCorpusPool()` function wraps the pool to enforce read-only access:

```typescript
function assertReadOnly(sql: string): void {
  const normalized = sql.trim().toUpperCase();
  const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
  for (const keyword of writeKeywords) {
    if (normalized.startsWith(keyword)) {
      throw new Error('CORPUS database is read-only from runtime app...');
    }
  }
}
```

Any attempt to execute a write query against CORPUS from the runtime app will throw an error.

### Guard Script

**File:** `scripts/guards/verifyNoPromoteToCorpus.js`

Prevents reintroduction of promotion functionality by checking for forbidden terms:
- "Promote to CORPUS"
- "promoteToCorpus"
- "PROMOTE_TO_CORPUS"
- "promote-to-corpus"

**Usage:**
```bash
npm run guard:no-promote-to-corpus
```

## UI Structure

### Evidence Tab Sections

1. **"Attached Evidence (CORPUS)"**
   - Shows read-only pointers from `module_corpus_links`
   - Displays CORPUS metadata (fetched via read-only SELECT)
   - No promotion/copy actions

2. **"Module Uploads"**
   - Shows files from `module_documents`
   - Module-scoped only
   - No "Promote to CORPUS" button
   - Helper text: "Module uploads remain module-scoped. Use 'Attach CORPUS Source' to create read-only references."

## Migrations

### RUNTIME Migrations

1. **`db/migrations/runtime/20260126_module_evidence_tables.sql`**
   - Creates `module_documents` table
   - Creates `module_chunks` table
   - Module-scoped evidence storage

2. **`db/migrations/runtime/20260126_module_corpus_links.sql`**
   - Creates `module_corpus_links` table
   - Read-only pointer storage

### CORPUS Migration

**`db/migrations/corpus/20260126_revoke_corpus_writes_from_runtime_role.sql`**
- Revokes `INSERT`, `UPDATE`, `DELETE` on all tables from `psa_runtime_app`
- Grants `SELECT` only
- Physical segregation enforcement

**Note:** Adjust role names (`psa_runtime_app`) to match your environment.

## Verification

### Run Guards
```bash
npm run guard:no-promote-to-corpus
npm run guard:no-module-attributes
```

### Manual Verification Checklist

- [ ] Evidence tab shows two separate sections
- [ ] No "Promote to CORPUS" button appears
- [ ] Module uploads live only in `RUNTIME.module_documents/module_chunks`
- [ ] Attaching CORPUS creates only a pointer row in `RUNTIME.module_corpus_links`
- [ ] CORPUS DB shows no new rows created from module actions
- [ ] OFC panels remain segregated (module candidates never appear in baseline/canonical panels)
- [ ] Attempting to write to CORPUS throws read-only error

## Files Modified

1. `app/admin/modules/[moduleCode]/page.tsx` - Removed promotion button, updated helper text
2. `app/api/admin/modules/[moduleCode]/sources/[moduleSourceId]/promote-to-corpus/route.ts` - Disabled (410 Gone)
3. `app/lib/db/corpus_client.ts` - Added read-only guard
4. `app/api/admin/modules/[moduleCode]/corpus-links/route.ts` - New endpoint for attaching CORPUS sources
5. `db/migrations/runtime/20260126_module_evidence_tables.sql` - New migration
6. `db/migrations/runtime/20260126_module_corpus_links.sql` - New migration
7. `db/migrations/corpus/20260126_revoke_corpus_writes_from_runtime_role.sql` - New migration
8. `scripts/guards/verifyNoPromoteToCorpus.js` - New guard script
9. `package.json` - Added guard script

## Support

If issues arise:
1. Check application logs for read-only errors
2. Verify guard passes: `npm run guard:no-promote-to-corpus`
3. Verify database permissions: Runtime app should have SELECT only on CORPUS
4. Check browser console for errors
5. Review this document for architecture details
