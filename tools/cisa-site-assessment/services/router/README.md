# Router Service

Deterministic router service for PSA document intake. Routes PDFs based on confirmed metadata in sidecar JSON files. Never guesses, never calls Ollama - only routes using validated metadata.

## Overview

The router service implements a deterministic intake pipeline:

1. **Incoming**: PDFs dropped into `incoming/` are moved to `staging/unclassified/`
2. **Staging**: PDFs in `staging/unclassified/` with valid `.meta.json` files are routed to final destinations
3. **Routing**: Based on metadata, PDFs are moved to `sources/corpus/` or `sources/modules/`
4. **Triage**: Invalid metadata or routing errors move files to `triage/` for manual review

## Directory Structure

```
services/router/
├── incoming/              # Drop PDFs here
├── staging/
│   ├── unclassified/      # PDFs waiting for metadata
│   └── classified/        # PDFs with metadata (transitional)
├── triage/                # Files with invalid metadata or errors
├── receipts/              # JSON receipts for all operations
├── logs/                  # Router service logs
├── meta_schema.py         # Metadata validation
├── hash_utils.py          # SHA-256 utilities
└── router_service.py      # Main router service
```

## Metadata Contract

Each PDF in `staging/unclassified/` must have a corresponding `<filename>.meta.json` file:

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

### Validation Rules

- `source_type` required, must be "corpus" or "module"
- `discipline_code` required, must be in allowed set
- If `source_type == "module"` => `module_id` required
- `subsector_id` implies `sector_id`
- `confirmed_by` and `confirmed_at` required

If invalid => PDF + meta moved to `triage/` with error receipt.

## Routing Destinations

### Corpus Sources
```
sources/corpus/<discipline_code>/
  (sector/<sector_id>/subsector/<subsector_id>/)?
```

### Module Sources
```
sources/modules/<module_id>/<discipline_code>/
  (sector/<sector_id>/subsector/<subsector_id>/)?
```

## Receipts

All operations generate JSON receipts in `receipts/`:

- **Staged**: `<timestamp>__<file>__staged.json` - PDF moved to staging
- **Triaged**: `<timestamp>__<file>__triaged.json` - Invalid metadata or error
- **Routed**: `<timestamp>__<file>__routed.json` - Successfully routed to destination

Each receipt includes:
- `timestamp`: ISO8601 timestamp
- `receipt_type`: "staged", "triaged", or "routed"
- `original_path`: Original file path
- `filename`: PDF filename
- `sha256`: SHA-256 hash of PDF
- `metadata`: Metadata dictionary (if available)
- `destination`: Final destination path (if routed)
- `errors`: List of error messages (if triaged)

## Usage

### Run Continuously (Default)
```powershell
.\scripts\run_router.ps1
```

### Run Once (Testing)
```powershell
.\scripts\run_router.ps1 -Once
```

### Custom Base Directory
```powershell
.\scripts\run_router.ps1 -BaseDir "D:\PSA_System\psa_rebuild\services\router"
```

### Custom Poll Interval
```powershell
.\scripts\run_router.ps1 -PollInterval 10
```

### Direct Python Execution
```bash
python services/router/router_service.py
python services/router/router_service.py --once
python services/router/router_service.py --base-dir /path/to/router --poll-interval 5
```

## Workflow

1. **Drop PDFs** into `services/router/incoming/`
2. **Router stages** PDFs to `staging/unclassified/`
3. **Run intake wizard** to create `.meta.json` files (see `tools/intake/README.md`)
4. **Router routes** PDFs to final destinations based on metadata
5. **Ingestion pipeline** consumes from `sources/` (corpus/modules separated)

## Logs

Router logs are written to `logs/router.log` in JSON Lines format (one JSON object per line):

```json
{"timestamp": "2026-01-24T12:00:00Z", "level": "INFO", "message": "Staged PDF: document.pdf", "sha256": "abc123..."}
```

## Error Handling

- **Invalid metadata**: Moved to `triage/` with error receipt
- **Routing errors**: Moved to `triage/` with error receipt
- **Filename collisions**: Appended with `__<shortsha>` to avoid overwrites
- **File system errors**: Logged and file moved to triage

## Non-Negotiables

- **Deterministic**: Router NEVER guesses or infers metadata
- **No Ollama**: Router NEVER calls Ollama for analysis
- **Metadata-only**: Router ONLY uses confirmed metadata from `.meta.json` files
- **PSA scope**: Only physical security, governance, planning, operations
- **No cyber/IT**: Router rejects documents with cyber/IT classification fields

---

**Last Updated:** 2026-01-24
