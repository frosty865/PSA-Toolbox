# Document Intake (Deterministic Router)

**Canonical workflow for PSA document intake with human-confirmed metadata.**

---

## Overview

PSA uses a deterministic intake pipeline that requires human confirmation of metadata before routing. The router never guesses or auto-infers metadata - it routes documents based solely on confirmed metadata in sidecar JSON files.

**Why no auto inference?** To ensure accuracy and prevent misclassification. Physical security documents require domain expertise to classify correctly, and automated inference can introduce errors that propagate through the system.

---

## Workflow Steps

### 1. Drop PDFs into Incoming Directory

Place PDF files into:
```
services/router/incoming/
```

The router service automatically detects new PDFs and moves them to staging.

### 2. Router Stages PDFs

The router service (running continuously or on-demand) automatically:
- Detects PDFs in `incoming/`
- Calculates SHA-256 hash
- Moves PDFs to `staging/unclassified/`
- Generates staged receipt in `receipts/`

**No action required** - this happens automatically when the router is running.

### 3. Run Intake Wizard

Run the intake wizard to classify PDFs in staging:

```powershell
.\scripts\run_intake_wizard.ps1
```

The wizard will:
- List all PDFs in `staging/unclassified/`
- (Optional) Run Ollama analysis to propose metadata
- Present suggestions as "PROPOSED" only (never auto-routes)
- Require human confirmation or override for each field
- Write `<filename>.meta.json` next to each PDF

**Bulk mode** (classify multiple files with same metadata):
```powershell
.\scripts\run_intake_wizard.ps1 -Bulk
```

**Without Ollama suggestions**:
```powershell
.\scripts\run_intake_wizard.ps1 -NoOllama
```

### 4. Router Routes PDFs

Once `.meta.json` files are written, the router automatically:
- Validates metadata
- Routes PDFs to final destinations:
  - **Corpus**: `sources/corpus/<discipline_code>/(sector/<sector_id>/subsector/<subsector_id>/)?`
  - **Module**: `sources/modules/<module_id>/<discipline_code>/(sector/<sector_id>/subsector/<subsector_id>/)?`
- Generates routed receipt in `receipts/`

**Invalid metadata** → PDF moved to `triage/` with error receipt.

### 5. Ingestion Pipeline Consumes

The ingestion pipeline consumes PDFs from `sources/`:
- Corpus sources: `sources/corpus/`
- Module sources: `sources/modules/`

**Hard separation**: Corpus and module sources never contaminate each other.

---

## Directory Structure

```
services/router/
├── incoming/              # Drop PDFs here
├── staging/
│   ├── unclassified/      # PDFs waiting for metadata
│   └── classified/        # PDFs with metadata (transitional)
├── triage/                # Invalid metadata or errors
├── receipts/              # JSON receipts for all operations
└── logs/                  # Router service logs

sources/
├── corpus/                # Corpus sources (authority documents)
│   └── <discipline_code>/
│       └── (sector/<sector_id>/subsector/<subsector_id>/)?
└── modules/               # Module sources (OFC documents)
    └── <module_id>/
        └── <discipline_code>/
            └── (sector/<sector_id>/subsector/<subsector_id>/)?
```

---

## Metadata Schema

Each PDF must have a corresponding `<filename>.meta.json` file:

```json
{
  "source_type": "corpus" | "module",
  "discipline_code": "ACS" | "COM" | "CPTED" | "EAP" | "EMR" | "FAC" | "ISC" | "INT" | "IDS" | "KEY" | "PER" | "SFO" | "SMG" | "VSS",
  "module_id": "string (required if source_type=module)",
  "sector_id": "string (optional)",
  "subsector_id": "string (optional; only valid if sector_id provided)",
  "source_key": "string (optional)",
  "notes": "string (optional)",
  "confirmed_by": "string (required; username/operator id)",
  "confirmed_at": "ISO8601 (required)"
}
```

**Validation Rules:**
- `source_type` required, must be "corpus" or "module"
- `discipline_code` required, must be in allowed set
- If `source_type == "module"` => `module_id` required
- `subsector_id` implies `sector_id`
- `confirmed_by` and `confirmed_at` required

---

## Running the Router Service

### Continuous Mode (Default)
```powershell
.\scripts\run_router.ps1
```

### Run Once (Testing)
```powershell
.\scripts\run_router.ps1 -Once
```

### Custom Poll Interval
```powershell
.\scripts\run_router.ps1 -PollInterval 10
```

---

## Non-Negotiables

✅ **PSA scope only**: Physical security, governance, planning, operations  
✅ **No cyber/IT**: No classification fields or logic for cyber/data/IT  
✅ **Deterministic router**: Routes ONLY using confirmed metadata  
✅ **Ollama advisory only**: Suggestions require human confirmation  
✅ **Hard separation**: CORPUS sources vs MODULE sources (separate storage)  
✅ **No auto-routing**: Nothing is auto-routed without confirmation  
✅ **Human confirmation required**: All metadata must be confirmed by operator  

---

## Validation Checklist

Use this checklist to verify the intake workflow:

- [ ] **Drop test PDF** into `services/router/incoming/`
- [ ] **Confirm PDF appears** under `staging/unclassified/` (router must be running)
- [ ] **Run intake wizard**: `.\scripts\run_intake_wizard.ps1`
- [ ] **Confirm metadata written**: `<filename>.meta.json` exists next to PDF
- [ ] **Confirm router routes**: PDF moved to `sources/corpus/<discipline_code>/...` or `sources/modules/<module_id>/...`
- [ ] **Confirm receipt created**: JSON receipt in `services/router/receipts/`
- [ ] **Confirm legacy upload API disabled**: Returns 410 with migration instructions

---

## Troubleshooting

### PDF Not Moving from Incoming

- Ensure router service is running: `.\scripts\run_router.ps1`
- Check router logs: `services/router/logs/router.log`

### Invalid Metadata Error

- Check metadata file syntax (must be valid JSON)
- Verify all required fields present
- Check discipline_code is in allowed set
- Ensure module_id provided if source_type is "module"

### PDF Stuck in Triage

- Review triage receipt for error details
- Fix metadata file and move PDF back to `staging/unclassified/`
- Or manually route PDF to correct destination

---

## Related Documentation

- `services/router/README.md` - Router service documentation
- `tools/intake/README.md` - Intake wizard documentation
- `docs/INTAKE_DEPRECATION_INVENTORY.md` - Deprecated intake systems
- `docs/INTAKE_MIGRATION_COMPLETE.md` - Migration summary

---

**Last Updated:** 2026-01-24
