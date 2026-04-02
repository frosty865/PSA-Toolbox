# Intake Migration Complete

**Date:** 2026-01-24  
**Status:** ✅ COMPLETE

---

## Summary

All legacy intake variants have been replaced with a single, sustainable pipeline:

- ✅ **Deterministic Router**: Watched-folder router that routes ONLY using confirmed metadata (sidecar JSON)
- ✅ **Intake Wizard**: Human-confirmed metadata entry with optional Ollama suggestions (advisory only)
- ✅ **Hard Separation**: CORPUS sources vs MODULE sources (separate storage roots)
- ✅ **Deprecation**: Old intake versions archived and disabled

---

## What Was Done

### Phase A: Inventory & Deprecation ✅

1. **Identified Legacy Intake Systems:**
   - `app/api/admin/source-registry/upload/route.ts` - Direct ingestion API
   - `app/lib/sourceRegistry/ingestion.ts` - Direct ingestion functions
   - `tools/corpus_ingest_pdf.py` - Direct ingestion script

2. **Archived Deprecated Code:**
   - Created: `D:\psa-workspace\archive\intake_deprecated_20260124\`
   - Archived all deprecated files maintaining relative structure
   - See: `docs/INTAKE_DEPRECATION_INVENTORY.md`

3. **Disabled Old Entry Points:**
   - Upload API route now returns 410 Gone with migration instructions
   - Old ingestion functions still exist but are not entry points

4. **Created Guard Script:**
   - `scripts/guards/verifyNoLegacyIntakeRefs.js`
   - Prevents reintroduction of legacy intake references
   - Scans for: `old_intake`, `intake_v1`, `intake_v2`, `upload_watcher`, deprecated API routes

### Phase B: Deterministic Router ✅

Created router service in `services/router/`:

- **`meta_schema.py`**: Metadata validation (PSA scope only, required fields)
- **`hash_utils.py`**: SHA-256 hashing utilities
- **`router_service.py`**: Main router service
  - Watches `incoming/` → moves to `staging/unclassified/`
  - Watches `staging/unclassified/` for PDFs with `.meta.json` → routes to final destinations
  - Never calls Ollama, never guesses
  - Generates receipts and logs

**Directory Structure:**
```
services/router/
├── incoming/              # Drop PDFs here
├── staging/
│   ├── unclassified/      # PDFs waiting for metadata
│   └── classified/        # PDFs with metadata (transitional)
├── triage/                # Invalid metadata or errors
├── receipts/              # JSON receipts
├── logs/                  # Router logs
└── [router files]
```

**Routing Destinations:**
- Corpus: `sources/corpus/<discipline_code>/(sector/<sector_id>/subsector/<subsector_id>/)?`
- Module: `sources/modules/<module_id>/<discipline_code>/(sector/<sector_id>/subsector/<subsector_id>/)?`

### Phase C: Intake Wizard ✅

Created intake wizard in `tools/intake/`:

- **`intake_wizard.py`**: Interactive CLI for metadata entry
  - Lists PDFs in staging
  - (Optional) Runs Ollama analysis
  - Presents suggestions as "PROPOSED" only
  - Requires human confirmation for all fields
  - Writes `.meta.json` files
  - Supports bulk mode

- **`ollama_suggest.py`**: Ollama suggestion module (advisory only)
  - Extracts text sample from PDF
  - Checks for cyber/IT indicators (filters out)
  - Calls Ollama API with PSA-scope prompt
  - Returns proposed metadata with confidence
  - Never auto-routes

**Key Features:**
- Human confirmation required
- PSA scope only (filters cyber/IT terms)
- Bulk mode support
- Validation before writing

### Phase D: Wiring Scripts ✅

Created PowerShell scripts:

- **`scripts/run_router.ps1`**: Runs router service
  - Supports `--once`, `--base-dir`, `--poll-interval`
  - Uses PSA System venv (processor service)

- **`scripts/run_intake_wizard.ps1`**: Runs intake wizard
  - Supports `--staging-dir`, `--no-ollama`, `--bulk`, file arguments
  - Uses PSA System venv (processor service)

### Phase E: Documentation ✅

Created/updated documentation:

- **`services/router/README.md`**: Router service documentation
- **`tools/intake/README.md`**: Intake wizard documentation
- **`docs/INTAKE_DEPRECATION_INVENTORY.md`**: Deprecation inventory
- **`README.md`**: Added "Document Intake (Deterministic)" section

---

## New Workflow

1. **Drop PDFs** into `services/router/incoming/`
2. **Router stages** PDFs to `staging/unclassified/` (automatic)
3. **Run intake wizard**:
   ```powershell
   .\scripts\run_intake_wizard.ps1
   ```
   - (Optional) Ollama suggests metadata
   - Operator confirms or overrides each field
   - Wizard writes `.meta.json` files
4. **Router routes** PDFs based on confirmed metadata
5. **Ingestion pipeline** consumes from `sources/` (corpus/modules separated)

---

## Non-Negotiables (Enforced)

✅ **PSA scope only**: Physical security, governance, planning, operations  
✅ **No cyber/IT**: No classification fields or logic for cyber/data/IT  
✅ **Deterministic router**: Routes ONLY using confirmed metadata  
✅ **Ollama advisory only**: Suggestions require human confirmation  
✅ **Hard separation**: CORPUS sources vs MODULE sources (separate storage)  
✅ **No auto-routing**: Nothing is auto-routed without confirmation  

---

## Guard Script

Run before commits:

```powershell
node scripts/guards/verifyNoLegacyIntakeRefs.js
```

Fails on:
- `old_intake`, `intake_v1`, `intake_v2`
- `upload_watcher`
- Deprecated API routes
- Direct ingestion functions (outside archive/router/intake)

---

## Migration Notes

### Old Upload API

The old upload API (`/api/admin/source-registry/upload`) is disabled and returns:

```json
{
  "error": "DEPRECATED",
  "message": "This upload endpoint is deprecated. Use the deterministic router + intake wizard workflow instead.",
  "migration": {
    "steps": [
      "1. Drop PDFs into services/router/incoming/",
      "2. Run intake wizard: scripts/run_intake_wizard.ps1",
      "3. Router routes based on confirmed metadata"
    ]
  }
}
```

Status: **410 Gone**

### Old Ingestion Functions

The old ingestion functions (`ingestDocumentFromFile`, `ingestDocumentFromUrl`) still exist in `app/lib/sourceRegistry/ingestion.ts` but are no longer entry points. They may still be used by the ingestion pipeline AFTER routing, but should not be called directly for intake.

---

## Testing

### Test Router Service

```powershell
# Run once (test)
.\scripts\run_router.ps1 -Once

# Run continuously
.\scripts\run_router.ps1
```

### Test Intake Wizard

```powershell
# Classify files in staging
.\scripts\run_intake_wizard.ps1

# Bulk mode
.\scripts\run_intake_wizard.ps1 -Bulk

# Without Ollama
.\scripts\run_intake_wizard.ps1 -NoOllama
```

### Test Guard Script

```powershell
node scripts/guards/verifyNoLegacyIntakeRefs.js
```

---

## Next Steps

1. ✅ **Router service**: Implemented and ready
2. ✅ **Intake wizard**: Implemented and ready
3. ✅ **Documentation**: Complete
4. ✅ **Guard script**: Created
5. ⏳ **Testing**: Test with real PDFs
6. ⏳ **Integration**: Ensure ingestion pipeline consumes from `sources/`

---

## Files Created

### Router Service
- `services/router/meta_schema.py`
- `services/router/hash_utils.py`
- `services/router/router_service.py`
- `services/router/__init__.py`
- `services/router/README.md`

### Intake Wizard
- `tools/intake/intake_wizard.py`
- `tools/intake/ollama_suggest.py`
- `tools/intake/__init__.py`
- `tools/intake/README.md`

### Scripts
- `scripts/run_router.ps1`
- `scripts/run_intake_wizard.ps1`
- `scripts/guards/verifyNoLegacyIntakeRefs.js`

### Documentation
- `docs/INTAKE_DEPRECATION_INVENTORY.md`
- `docs/INTAKE_MIGRATION_COMPLETE.md` (this file)
- Updated `README.md`

---

**Last Updated:** 2026-01-24
