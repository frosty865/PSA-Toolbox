# Pipeline File Paths Documentation

## Overview

This document describes all pipeline-related file paths used across the PSA system.

## Environment Variable Configuration

### PSA_PIPELINE_ROOT

**Purpose:** Root directory for the document processing pipeline

**Environment Variable:** `PSA_PIPELINE_ROOT`

**Default:** Not set (must be configured)

**Used By:**
- Flask backend (`psaback/app.py`) - System status endpoints
- Coverage analysis (`psaback/api/coverage_analysis.py`)
- System status (`psaback/api/system_status.py`)

**Directory Structure (under PSA_PIPELINE_ROOT):**
```
<PSA_PIPELINE_ROOT>/
├── incoming/      # New documents to be processed
├── temp/          # Temporary files during processing
├── phase1/        # Phase 1 processing outputs
├── phase2/        # Phase 2 processing outputs
├── phase3/        # Phase 3 processing outputs
├── library/       # Processed documents archive
├── errors/        # Failed processing outputs
└── review/        # Documents awaiting review
```

**Example Configuration:**
```bash
# In .env or local.env
PSA_PIPELINE_ROOT=D:\psa-workspace\Tech_Sources
```

## Pipeline Watcher Paths

### Combined Pipeline Watcher (Legacy - Disabled)

**Location:** `psaback/services/pipeline_watcher.py`

**Status:** ⚠️ LEGACY_DISABLED - Do not use

**Paths (Hardcoded):**
- **Incoming:** `D:\PSA_System\psa_rebuild\psaback\Tech_Sources\incoming`
- **Processed:** `D:\PSA_System\psa_rebuild\psaback\Tech_Sources\processed`

**Note:** This watcher has been decommissioned. Use psa_engine watchers instead.

### Phase 2 File Watcher

**Location:** `psaback/services/phase2_file_watcher.py`

**Environment Variables:**
- `PHASE2_WATCHER_INCOMING_DIR` (default: `D:/PSA_System/psa_rebuild/psaback/Tech_Sources/phase2`)
- `PHASE2_WATCHER_PROCESSED_DIR` (default: `<INCOMING_DIR>/processed`)
- `PHASE2_WATCHER_REJECTED_DIR` (default: `<INCOMING_DIR>/rejected`)

**Paths:**
- **Incoming:** `D:/PSA_System/psa_rebuild/psaback/Tech_Sources/phase2`
- **Processed:** `<INCOMING_DIR>/processed`
- **Rejected:** `<INCOMING_DIR>/rejected`

## PSA Engine Pipeline Paths

### Root Pipeline Watcher

**Location:** `D:\PSA_System\psa_rebuild\psa_engine\pipeline_watcher.py`

**Purpose:** Orchestrates Phase 1 → Phase 1.5 → Phase 2 processing

**Paths:**
- **Incoming:** `D:\PSA_System\Tech_Sources\incoming`
- **Processed:** `D:\PSA_System\Tech_Sources\processed`

### Analytics Pipeline Watcher

**Location:** `D:\PSA_System\psa_rebuild\psa_engine\analytics\watcher\pipeline_watcher.py`

**Purpose:** Deterministic intake controller with library indexing

**Base Directory:** `D:\PSA_System\psa_rebuild\psa_engine\analytics` (default)

**Directory Structure:**
```
analytics/
├── incoming/              # New documents placed here
│   └── duplicates/        # Duplicate documents (rejected)
├── processing/            # Documents being processed
│   └── <source_document_id>/
│       ├── <filename>
│       ├── pipeline_trigger.json
│       ├── phase2.json
│       └── phase2_5_materialized.json
├── processed/             # Transitional storage (moved to library)
│   └── <source_document_id>/
├── library/               # Authoritative long-term evidence store
│   └── <discipline>/
│       └── <component_code>/
│           └── <source_document_id>/
└── watcher/               # Watcher state and manifests
    ├── watcher_state.json
    └── intake_manifest.json
```

**Paths:**
- **Incoming:** `<base_dir>/incoming`
- **Processing:** `<base_dir>/processing`
- **Processed:** `<base_dir>/processed`
- **Library:** `<base_dir>/library`
- **State File:** `<base_dir>/watcher/watcher_state.json`
- **Manifest File:** `<base_dir>/watcher/intake_manifest.json`

**Custom Base Directory:**
Can be overridden with `--base-dir` command-line argument:
```bash
python analytics/watcher/pipeline_watcher.py --base-dir /path/to/analytics
```

## PSA Rebuild Pipeline Paths

**Location:** `D:\PSA_System\psa_rebuild\analytics`

**Runtime Directories (KEPT - Referenced by Watcher):**
- `analytics/incoming/` - Watcher input directory
- `analytics/library/` - Watcher output directory
- `analytics/processed/` - Watcher processing directory

## NSSM Service Configuration

### Pipeline Watcher Service

**Service Name:** `psa-backend-pipeline`

**Command:** `python -m services.pipeline_watcher`

**Working Directory:** `D:\PSA_System\psa_rebuild\psaback`

**Logs:**
- **Stdout:** `<psaback>/logs/pipeline_watcher.out.log`
- **Stderr:** `<psaback>/logs/pipeline_watcher.err.log`

## Summary Table

| Component | Incoming Path | Processed/Output Path | Config Method |
|-----------|--------------|----------------------|---------------|
| **PSA_PIPELINE_ROOT** | `<ROOT>/incoming` | `<ROOT>/phase2`, `<ROOT>/library` | Environment variable |
| **Combined Watcher** (Legacy) | `D:\psa-workspace\psaback\Tech_Sources\incoming` | `D:\psa-workspace\psaback\Tech_Sources\processed` | Hardcoded |
| **Phase 2 Watcher** | `D:/psa-workspace/psaback/Tech_Sources/phase2` | `<INCOMING>/processed` | Environment variable |
| **PSA Engine Root** | `D:\psa-workspace\Tech_Sources\incoming` | `D:\psa-workspace\Tech_Sources\processed` | Hardcoded |
| **PSA Engine Analytics** | `<base>/analytics/incoming` | `<base>/analytics/library` | Command-line arg |
| **PSA Rebuild Analytics** | `psa_rebuild/analytics/incoming` | `psa_rebuild/analytics/library` | Hardcoded |

## Configuration Recommendations

1. **Set PSA_PIPELINE_ROOT** in your environment:
   ```bash
   PSA_PIPELINE_ROOT=D:\PSA_System\Tech_Sources
   ```

2. **Use PSA Engine Watchers** (not legacy psaback watchers):
   - Root watcher: `psa_engine/pipeline_watcher.py`
   - Analytics watcher: `psa_engine/analytics/watcher/pipeline_watcher.py`

3. **Verify Paths Exist:**
   - All pipeline directories should exist before starting watchers
   - Watchers will create directories if they don't exist, but it's better to pre-create them

## Related Documentation

- `analytics/watcher/README.md` - Pipeline Watcher documentation
- `analytics/watcher/WATCHER_INVENTORY.md` - Complete watcher inventory
- `psaback/docs/process/ingestion/README_COMBINED_PIPELINE_WATCHER.md` - Combined watcher docs

