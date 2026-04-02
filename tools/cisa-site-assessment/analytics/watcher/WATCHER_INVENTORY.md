# Watcher Inventory - Project Wide

Complete list of all watchers across psa_engine, psaback, and psa_rebuild repositories.

## Summary

| Repository | Watcher Count | Primary Purpose |
|------------|---------------|-----------------|
| **psa_engine** | 2 | Library indexing, duplicate prevention |
| **psaback** | 2 | Document ingestion, Phase 2 processing |
| **psa_rebuild** | 1 | Library organization (component-based) |
| **Total** | **5** | |

---

## psa_engine Watchers

### 1. `pipeline_watcher.py` (Root)
**Location**: `D:\PSA_System\psa_rebuild\psa_engine\pipeline_watcher.py`

**Purpose**: Orchestrates Phase 1 → Phase 1.5 → Phase 2 processing

**What it does**:
- Watches `D:\PSA_System\Tech_Sources\incoming` for PDFs
- Processes documents through Phase 1, Phase 1.5, and Phase 2
- Moves processed documents to `Tech_Sources\processed`

**Key characteristics**:
- Calls `phase1_parser`, `phase1_5`, and `phase2_doctrine_scan` directly
- Processes documents end-to-end
- Legacy/original pipeline watcher

---

### 2. `analytics/watcher/pipeline_watcher.py` ⭐ NEW
**Location**: `D:\PSA_System\psa_rebuild\psa_engine\analytics\watcher\pipeline_watcher.py`

**Purpose**: Deterministic intake controller with library indexing and duplicate prevention

**What it does**:
- Watches `D:\PSA_System\psa_rebuild\psa_engine\analytics\incoming` for documents
- Computes SHA-256 immediately on detection
- Checks library index for duplicates
- Rejects duplicates (moves to `incoming/duplicates/`)
- Moves new documents to `processing/` for pipeline ingestion
- Updates library index when documents are archived

**Key characteristics**:
- **Authoritative library index** (SHA-256 primary key)
- **Duplicate prevention** enforced at intake
- **File locking** for concurrent safety
- **JSON event logging** to `analytics/logs/watcher.log`
- Does NOT process documents (coordinates only)

**Related files**:
- `analytics/watcher/library_index_manager.py` - Index management with locking
- `analytics/library/library_index.json` - Authoritative index
- `analytics/tools/rebuild_library_index.py` - Index rebuild script

---

## psaback Watchers

### 3. `services/pipeline_watcher.py`
**Location**: `D:\PSA_System\psa_rebuild\psaback\services\pipeline_watcher.py`

**Purpose**: Combined pipeline watcher - processes PDFs and ingests directly into database

**What it does**:
- Watches `D:\PSA_System\psa_rebuild\psaback\Tech_Sources\incoming` for PDF files
- Processes through Phase 1 → Phase 1.5 → Phase 2 (using psa_engine)
- **Directly ingests Phase 2 output into database** (using psaback ingestion)
- Moves processed files to `Tech_Sources\processed`

**Key characteristics**:
- **Actually processes documents** (Phase 1, 1.5, 2)
- **Calls psa_engine** to parse and analyze
- **Ingests directly into database**
- Combines PDF processing and Phase 2 ingestion
- Eliminates intermediate step of writing to `phase2/` directory

**Related files**:
- `start_watcher.ps1` - PowerShell script to start watcher
- `scripts/install_pipeline_watcher_nssm.ps1` - NSSM service installation

---

### 4. `services/phase2_file_watcher.py`
**Location**: `D:\PSA_System\psa_rebuild\psaback\services\phase2_file_watcher.py`

**Purpose**: Watches Phase 2 output directory and ingests into database

**What it does**:
- Watches `D:\PSA_System\psa_rebuild\psaback\Tech_Sources\phase2` for Phase 2 JSON files
- Ingests Phase 2 output directly into database
- Moves processed files after ingestion

**Key characteristics**:
- **Database ingestion only** (no document processing)
- Watches for Phase 2 completion
- May be superseded by combined pipeline watcher

**Note**: May be legacy if combined pipeline watcher handles this.

---

## psa_rebuild Watchers

### 5. `analytics/watcher/pipeline_watcher.py`
**Location**: `D:\PSA_System\psa_rebuild\analytics\watcher\pipeline_watcher.py`

**Purpose**: Component-based library organization

**What it does**:
- Watches `analytics/incoming/` for documents
- Moves documents to `analytics/processing/` (triggers pipeline)
- Monitors for Phase 2.5 completion
- **Organizes processed evidence** into component-based library
- Moves from `analytics/processed/` to `analytics/library/<discipline>/<component_code>/`

**Key characteristics**:
- **Does NOT process documents** (just coordinates)
- **Does NOT call Phase 1/Phase 2** code directly
- **Does NOT ingest into database**
- Only organizes and archives processed evidence
- Component-aware archiving based on Phase 2.5 evidence

**Related files**:
- `analytics/watcher/scripts/start_watcher.ps1` - Start script (Windows)
- `analytics/watcher/scripts/start_watcher.sh` - Start script (Linux)
- `analytics/watcher/scripts/install_windows_service.ps1` - NSSM installation
- `analytics/watcher/DEPLOYMENT.md` - Deployment guide
- `analytics/watcher/DEPLOYMENT_WINDOWS.md` - Windows-specific guide

---

## Watcher Comparison Matrix

| Feature | psa_engine (root) | psa_engine (analytics) | psaback (pipeline) | psaback (phase2) | psa_rebuild |
|---------|------------------|------------------------|-------------------|------------------|-------------|
| **Processes PDFs?** | ✅ Yes | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Ingests to DB?** | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Calls psa_engine?** | ✅ Yes | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Organizes by component?** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Duplicate prevention?** | ❌ No | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Library indexing?** | ❌ No | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Watches** | `Tech_Sources/incoming` | `analytics/incoming` | `Tech_Sources/incoming` | `Tech_Sources/phase2` | `analytics/incoming` |

---

## Watcher Scripts and Tools

### psaback
- `start_watcher.ps1` - Start pipeline watcher
- `scripts/install_pipeline_watcher_nssm.ps1` - Install as Windows service
- `tools/check_watcher_status.py` - Check watcher status
- `tools/diagnose_watcher.py` - Diagnose watcher issues
- `tools/test_watcher_processing.py` - Test watcher processing
- `tools/verify_watcher_fix.py` - Verify watcher fixes

### psa_rebuild
- `analytics/watcher/scripts/start_watcher.ps1` - Start watcher (Windows)
- `analytics/watcher/scripts/start_watcher.sh` - Start watcher (Linux)
- `analytics/watcher/scripts/stop_watcher.ps1` - Stop watcher (Windows)
- `analytics/watcher/scripts/stop_watcher.sh` - Stop watcher (Linux)
- `analytics/watcher/scripts/check_watcher.ps1` - Check status (Windows)
- `analytics/watcher/scripts/check_watcher.sh` - Check status (Linux)
- `analytics/watcher/scripts/restart_watcher.ps1` - Restart watcher (Windows)
- `analytics/watcher/scripts/restart_watcher.sh` - Restart watcher (Linux)
- `analytics/watcher/scripts/install_windows_service.ps1` - Install as NSSM service
- `analytics/watcher/scripts/install_task_scheduler.ps1` - Install as Task Scheduler task
- `analytics/watcher/scripts/debug_stuck_document.py` - Debug stuck documents
- `analytics/watcher/scripts/cron_watcher.sh` - Cron-based monitoring

---

## Authority Boundaries

### psaback Watchers
- **Authoritative for**: Document ingestion, database persistence
- **Watches**: `Tech_Sources/incoming` (psaback-owned directory)
- **Processes**: Full pipeline (Phase 1 → 1.5 → 2)
- **Outputs**: Database records, processed files

### psa_engine Watchers
- **Authoritative for**: Library indexing, duplicate prevention, doctrine processing
- **Watches**: `analytics/incoming` (psa_engine-owned directory)
- **Processes**: Doctrine scanning, library organization
- **Outputs**: Library index, organized evidence

### psa_rebuild Watchers
- **Authoritative for**: UI workflows, component-based organization
- **Watches**: `analytics/incoming` (may overlap with psa_engine)
- **Processes**: Component resolution, library organization
- **Outputs**: Component-organized library structure

---

## Recommendations

1. **Consolidate overlapping watchers**: psa_engine and psa_rebuild both watch `analytics/incoming` - consider consolidation
2. **Clarify responsibilities**: Ensure clear boundaries between watchers
3. **Document dependencies**: Some watchers depend on others completing first
4. **Standardize paths**: Some watchers use different directory structures

---

**Last Updated**: 2025-01-27

