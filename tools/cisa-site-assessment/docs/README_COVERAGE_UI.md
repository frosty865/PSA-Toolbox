# Phase 2 Coverage v1 - Read-Only UI

## Overview

This implementation provides a **read-only UI** for viewing Phase 2 Coverage v1 data. It is designed to be:
- **Read-only** - No editing, no mutation
- **Phase 2 v1 schema only** - No other schemas supported
- **No derived logic** - Data displayed exactly as stored
- **No interpretation** - Pure visibility of trusted data

## Architecture

### Backend Components

1. **Data Access Layer** (`db/coverage_repo.py`)
   - `get_documents()` - Returns list of documents with latest coverage info
   - `get_latest_coverage(document_id)` - Returns raw payload for a document
   - No business logic, no computed fields

2. **API Endpoints** (`api/coverage.py`)
   - `GET /documents` - Returns array of documents with latest coverage
   - `GET /documents/{document_id}/coverage` - Returns raw Phase 2 payload verbatim

3. **UI Routes** (`app.py`)
   - `GET /coverage` - Document list page
   - `GET /coverage/{document_id}` - Document detail page

### Frontend Components

1. **Document List View** (`templates/coverage_list.html`)
   - Table showing all ingested documents
   - Columns: Document Name, Coverage %, Schema Version, Ingested At, View button
   - Clicking "View" navigates to document detail

2. **Document Detail View** (`templates/coverage_detail.html`)
   - Header with document name, coverage percent, generated timestamp
   - Grouped by discipline
   - Each subdiscipline shows:
     - Subdiscipline name
     - Covered status (visual indicator: check/dot)
     - Evidence count
   - Expandable evidence sections showing:
     - Page number
     - Excerpt (verbatim, pre-wrapped)
     - No truncation beyond UI collapse

## Visual Rules

- **Covered** = Green dot indicator
- **Not covered** = Gray/muted indicator
- **Language**: "Covered in documentation" (NOT "Compliant" or "Meets standard")
- **No colors tied to judgment**
- **No maturity language**
- **No recommendations**

## Usage

### Accessing the UI

1. **Document List**: Navigate to `http://localhost:5000/coverage`
2. **Document Detail**: Click "View" on any document, or navigate to `http://localhost:5000/coverage/{document_id}`

### API Endpoints

1. **List Documents**:
   ```bash
   curl http://localhost:5000/documents
   ```
   Returns array of documents with latest coverage info.

2. **Get Coverage**:
   ```bash
   curl http://localhost:5000/documents/{document_id}/coverage
   ```
   Returns raw Phase 2 payload exactly as stored.

## Data Flow

1. Phase 2 coverage files are ingested via `POST /ingest/phase2`
2. Data is stored in `documents` and `coverage_runs` tables
3. UI reads from database via API endpoints
4. Data is displayed verbatim - no transformation, no interpretation

## Acceptance Criteria

✅ **UI is complete when:**
- A non-technical user can:
  - See which topics appear in a document
  - Click and read the exact supporting text
  - Understand page provenance

❌ **UI is NOT complete when:**
- Anyone asks "so is this good enough?"
  - That's not this layer's job.

## Files Created/Modified

### New Files
- `db/coverage_repo.py` - Data access layer
- `api/coverage.py` - API endpoints
- `templates/coverage_list.html` - Document list UI
- `templates/coverage_detail.html` - Document detail UI
- `static/cisa.css` - CSS styles (copied from styles/)

### Modified Files
- `app.py` - Added UI routes and registered coverage routes

## Notes

- The new `/documents` endpoint returns an array directly (not wrapped in an object)
- The old `/documents` endpoint in `api/documents.py` is overridden by the new one
- All data is read-only - no mutation, no enrichment, no interpretation
- UI reflects data as-is, including "ugly" excerpts and reference sections

