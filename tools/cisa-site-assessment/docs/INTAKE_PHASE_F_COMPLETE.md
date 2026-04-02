# Phase F - Intake Migration Finalization Complete

**Date:** 2026-01-24  
**Status:** ✅ COMPLETE

---

## Summary

Phase F finalization complete. All guard scripts, canonical workflow documentation, and API disabling are in place.

---

## Completed Tasks

### ✅ Phase 1: Guard Script

**Created:** `scripts/guards/verifyNoLegacyIntakeRefs.js`

**Features:**
- Scans repo recursively for forbidden legacy intake references
- Excludes: node_modules, .next, .git, archive, dist, build, out, coverage, venv, docs, analytics, psa_engine, tools/outputs
- Hard-fails (process.exit(1)) if matches found
- Prints file path + line number + matched token

**Forbidden Tokens:**
- `psa-workspace` (old workspace root)
- `old_intake`, `intake_v1`, `intake_v2`
- `upload_watcher`
- `/api/upload`, `/api/admin/upload`, `/api/admin/source-registry/upload`
- `incoming/upload` or `incoming\upload`
- `ingestDocumentFromFile`, `ingestDocumentFromUrl` (with exclusions for ingestion pipeline)

**Package Script Hook:**
- Added `"guard:intake": "node scripts/guards/verifyNoLegacyIntakeRefs.js"` to package.json
- Integrated into build pipeline: `npm run build` now includes `npm run guard:intake`

**Status:** ✅ Guard script passes (no legacy intake references found)

### ✅ Phase 2: Canonical Workflow Documentation

**Created:** `docs/intake.md`

**Contents:**
- Complete workflow steps with exact paths
- Directory structure diagram
- Metadata schema documentation
- Router service usage
- Non-negotiables list
- Validation checklist
- Troubleshooting guide

**Updated:** `README.md` - Added reference to canonical intake documentation

**Status:** ✅ Complete canonical workflow documented

### ✅ Phase 3: Legacy Upload API Disabled

**File:** `app/api/admin/source-registry/upload/route.ts`

**Changes:**
- Replaced handler with stub returning 410 Gone
- Returns JSON with migration instructions:
  ```json
  {
    "ok": false,
    "error": {
      "code": "LEGACY_UPLOAD_DISABLED",
      "message": "Legacy upload API is disabled. Use deterministic router workflow.",
      "migration": {
        "step1": "Drop PDFs into services/router/incoming/",
        "step2": "Run .\\scripts\\run_intake_wizard.ps1 to generate .meta.json",
        "step3": "Router will route into sources/ automatically after confirmation"
      }
    }
  }
  ```
- Does NOT write files or call ingestion

**UI Updated:** `app/admin/source-registry/page.tsx`
- Handles 410 response with meaningful error message
- Shows migration steps to user

**Status:** ✅ Legacy upload API disabled with clear migration response

### ✅ Phase 4: Script Entry Points Verified

**Scripts Exist:**
- `scripts/run_router.ps1` - Router service runner
- `scripts/run_intake_wizard.ps1` - Intake wizard runner

**Features:**
- Use PSA System venv (processor service)
- Support command-line arguments
- Proper error handling

**Status:** ✅ Script entry points verified and working

### ✅ Phase 5: Validation Checklist

**Added to:** `docs/intake.md`

**Checklist:**
- [ ] Drop test PDF into `services/router/incoming/`
- [ ] Confirm PDF appears under `staging/unclassified/`
- [ ] Run intake wizard and write meta.json
- [ ] Confirm router moves into `sources/corpus/<discipline_code>/...` or `sources/modules/<module_id>/...`
- [ ] Confirm receipt JSON created under `services/router/receipts/`
- [ ] Confirm legacy upload API returns 410 with migration instructions

**Status:** ✅ Validation checklist documented

---

## Target State Achieved

✅ **1. Guard Script Exists**
- `scripts/guards/verifyNoLegacyIntakeRefs.js` created and integrated
- Fails CI/build/run if legacy intake references reappear
- Passes current codebase scan

✅ **2. New Workflow is Canonical**
- Drop PDFs into `services/router/incoming/`
- Router stages to `staging/unclassified/` automatically
- Operator runs `.\scripts\run_intake_wizard.ps1`
- Optional Ollama suggestions (advisory only)
- Human confirms/overrides each field
- Wizard writes `.meta.json` next to PDF
- Router routes deterministically into `sources/...`
- Ingestion consumes from `sources/` with corpus/modules separated

✅ **3. Non-Negotiables Enforced**
- PSA scope only ✅
- No cyber/IT classification fields or logic ✅
- Router routes ONLY using confirmed metadata ✅
- Ollama is advisory only (no auto-routing) ✅
- Corpus and module sources are hard separated ✅
- No auto-routing without confirmation ✅

✅ **4. Old Upload API Disabled**
- Returns 410 Gone with migration instructions in JSON ✅
- Does NOT ingest or stage anything ✅
- UI shows meaningful message ✅

---

## Files Created/Modified

### Created
- `scripts/guards/verifyNoLegacyIntakeRefs.js` - Guard script
- `docs/intake.md` - Canonical workflow documentation
- `docs/INTAKE_PHASE_F_COMPLETE.md` - This file

### Modified
- `package.json` - Added `guard:intake` script, integrated into build
- `app/api/admin/source-registry/upload/route.ts` - Disabled with 410 response
- `app/admin/source-registry/page.tsx` - Handle 410 response with migration message
- `README.md` - Added reference to canonical intake documentation

---

## Next Steps

1. ✅ **Guard script**: Created and passing
2. ✅ **Canonical workflow**: Documented in `docs/intake.md`
3. ✅ **Legacy API**: Disabled with migration instructions
4. ✅ **Script entry points**: Verified
5. ✅ **Validation checklist**: Documented
6. ⏳ **Testing**: Test workflow with real PDFs
7. ⏳ **Integration**: Ensure ingestion pipeline consumes from `sources/`

---

## Verification

Run guard script:
```powershell
npm run guard:intake
```

Or directly:
```powershell
node scripts/guards/verifyNoLegacyIntakeRefs.js
```

**Expected:** `[OK] No legacy intake references found in source code`

---

**Last Updated:** 2026-01-24
