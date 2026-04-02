# Pipeline Watcher

Deterministic intake controller for pipeline processing and component-based library management.

## Overview

The Pipeline Watcher monitors incoming documents, coordinates pipeline ingestion, and moves processed evidence into a long-term, component-organized library. The `/library/` directory is the authoritative long-term evidence store, and `/processed/` is transitional only.

## Responsibilities

### What the Watcher Does

1. **Detects new documents** in `analytics/incoming/`
2. **Moves documents** into `analytics/processing/<source_document_id>/` for pipeline ingestion
3. **Monitors** for successful Phase 2.5 completion
4. **Moves** processed outputs from `analytics/processed/` to `analytics/library/<discipline>/<component_code>/<source_document_id>/`

### What the Watcher Does NOT Do

- Parse document content
- Infer components
- Modify pipeline outputs
- Regenerate candidates
- Call Phase 1 / Phase 2 code directly

## Usage

### Running the Watcher

**Continuous mode (default):**
```bash
python analytics/watcher/pipeline_watcher.py
```

**Run once (for testing):**
```bash
python analytics/watcher/pipeline_watcher.py --once
```

**Custom base directory:**
```bash
python analytics/watcher/pipeline_watcher.py --base-dir /path/to/analytics
```

**Custom poll interval:**
```bash
python analytics/watcher/pipeline_watcher.py --poll-interval 5
```

### Directory Structure

```
analytics/
├── incoming/              # New documents placed here
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
│               ├── <filename>
│               ├── phase2.json
│               ├── phase2_5.json
│               └── manifest.json
└── watcher/
    ├── pipeline_watcher.py
    ├── watcher_state.json
    └── intake_manifest.json
```

## Processing Flow

### 1. Intake Detection

- Watches `analytics/incoming/` for new files
- Verifies file is stable (size unchanged for N seconds)
- Computes SHA256 hash
- Checks for duplicates (by SHA256)
- Creates intake manifest entry
- Moves file to `analytics/processing/<source_document_id>/`

### 2. Pipeline Handoff

- Writes `pipeline_trigger.json` in processing directory
- Updates manifest status to "processing"
- Pipeline reads trigger file and processes document

### 3. Phase 2.5 Completion Detection

The watcher checks for completion using multiple methods:

1. **Explicit marker**: `<source_document_id>.phase2_5.done`
2. **Phase 2.5 file**: `phase2_5_materialized.json` exists
3. **Phase 2 file**: `phase2.json` exists with valid structure

### 4. Move to Processed

After Phase 2.5 completion:
- Moves document from `processing/` to `processed/`
- Updates manifest status to "ready_for_library"

### 5. Component Resolution

- Extracts components from Phase 2.5 records
- Chooses primary component (alphabetically first if multiple)
- Records secondary components in manifest

### 6. Move to Library

- Moves (not copies) entire directory from `processed/` to `library/<discipline>/<component_code>/<source_document_id>/`
- Creates `manifest.json` in library location with metadata
- Updates manifest status to "archived"
- Verifies `/processed/` is cleaned up (no duplication)

### 7. Cleanup

- Ensures `/processed/<source_document_id>/` no longer exists after move
- Library is the only retained copy

## State Management

### Watcher State

Stored in `analytics/watcher/watcher_state.json`:

```json
{
  "watcher_started_at": "2025-01-27T12:00:00",
  "last_scan_at": "2025-01-27T12:05:00",
  "documents": {
    "<source_document_id>": {
      "current_stage": "archived",
      "detected_at": "2025-01-27T12:00:00",
      "filename": "document.pdf",
      "processing_started_at": "2025-01-27T12:00:05",
      "phase2_5_completed_at": "2025-01-27T12:02:00",
      "archived_at": "2025-01-27T12:03:00"
    }
  }
}
```

### Intake Manifest

Stored in `analytics/watcher/intake_manifest.json`:

```json
{
  "<source_document_id>": {
    "source_document_id": "<source_document_id>",
    "filename": "document.pdf",
    "sha256": "abc123...",
    "detected_at": "2025-01-27T12:00:00",
    "status": "archived",
    "error": null,
    "phase2_5_completed_at": "2025-01-27T12:02:00",
    "archived_at": "2025-01-27T12:03:00"
  }
}
```

## Status Values

- `queued`: Document intaken, waiting for pipeline
- `processing`: Pipeline triggered, processing in progress
- `ready_for_library`: Phase 2.5 complete, ready to move to library
- `archived`: Successfully moved to library
- `failed`: Error occurred during processing

## Error Handling

- Errors are logged with full traceback
- Failed documents are marked with status "failed"
- Error message stored in manifest entry
- No automatic retry (manual intervention required)
- Files are never deleted on error

## Restart Safety

The watcher is restart-safe:

- State persisted to JSON files
- Duplicate detection via SHA256
- Status tracking prevents reprocessing
- Can resume from any stage

## Component Identification

Components are identified from Phase 2.5 materialized records using the existing `identify_components_from_phase2.py` function. The watcher:

- Reads Phase 2.5 data (or Phase 2 as fallback)
- Uses component keyword matching
- Extracts component codes from evidence
- Does NOT infer components - only reads from Phase 2.5 outputs

### Primary Component Selection

When multiple components are referenced:
- Primary component: Alphabetically first (or most references if counting implemented)
- Secondary components: All other components
- Both recorded in `manifest.json` in library location

## Validation

The watcher ensures:

- ✅ Duplicate documents ignored via SHA256
- ✅ Restart does not reprocess completed items
- ✅ Library reflects component attribution correctly
- ✅ No pipeline behavior is altered
- ✅ Files are never duplicated (moved, not copied)
- ✅ `/processed/` does not accumulate files
- ✅ `/library/` grows deterministically

## Integration with Pipeline

The watcher triggers the pipeline by writing `pipeline_trigger.json`:

```json
{
  "source_document_id": "<source_document_id>",
  "triggered_at": "2025-01-27T12:00:05",
  "status": "queued"
}
```

The pipeline should:
1. Monitor `analytics/processing/` for trigger files
2. Process documents when trigger found
3. Write Phase 2.5 outputs to processing directory
4. Create completion marker when done

## Configuration

Default configuration (can be modified in code):

- `file_stability_seconds`: 5 (wait for file to be stable)
- `poll_interval`: 2 (seconds between directory scans)

## Logging

Logs are written to stdout with format:
```
2025-01-27 12:00:00 [INFO] Pipeline Watcher initialized
2025-01-27 12:00:05 [INFO] Intake: document.pdf -> abc123_document
2025-01-27 12:00:10 [INFO] Pipeline triggered for abc123_document
2025-01-27 12:02:00 [INFO] Phase 2.5 completed for abc123_document
2025-01-27 12:03:00 [INFO] Archived abc123_document to Video_Surveillance_Systems/VSS_CAMERA/
```

## Troubleshooting

### Document Stuck in "processing"

- Check if Phase 2.5 completion marker exists
- Verify Phase 2.5 materialized records file exists
- Check pipeline logs for errors
- Verify both `phase2.json` and `phase2_5.json` exist

### Document Stuck in "ready_for_library"

- Verify Phase 2.5 records contain valid component references
- Check component library file exists
- Verify discipline names are valid for filesystem
- Check for file permission issues

### No Components Found

- Verify Phase 2.5 materialized records contain evidence
- Check component identification function is working
- Ensure component library file exists

### Library Move Failed

- Verify `/processed/<source_document_id>/` exists
- Check library path doesn't already exist
- Verify component library file exists
- Check for file permission issues

### Files Still in /processed/

- Verify move to library completed successfully
- Check for errors in watcher logs
- Manually verify library location exists

### Duplicate Detection Not Working

- Check SHA256 computation is correct
- Verify manifest file is being saved
- Check for file permission issues

