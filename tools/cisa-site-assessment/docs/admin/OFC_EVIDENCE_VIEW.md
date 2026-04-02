# OFC Evidence Drilldown View

## Overview

The OFC Evidence Drilldown View is a **read-only admin tool** that explains why each OFC exists by showing the bound Phase 2.5 evidence and citations.

## Purpose

This view answers one question: **"Why does this OFC exist?"**

It provides transparency and traceability by showing:
- The OFC definition and metadata
- All Phase 2.5 evidence records that support the OFC
- Source document IDs and page numbers for each evidence excerpt

## Access

**Route**: `/admin/ofcs/[ofc_code]/evidence`

**Access Control**: Admin-only (enforced server-side)

**Example**: `/admin/ofcs/OFC-BL-BASE-001/evidence`

## What It Does

### Backend API (`/api/admin/ofc-evidence`)

1. **Loads OFC Definition** (file-based, read-only)
   - Searches OFC template files in `app/lib/fixtures/` and `public/doctrine/`
   - Matches by `ofc_code` or `required_element_code`

2. **Resolves Evidence**
   - Uses OFC's `discipline_name` and `discipline_subtype_name`
   - Loads matching Phase 2.5 records from `psa_engine/analytics/coverage_library/`
   - Handles both `coverage_record.v1` (single record per file) and legacy Phase 2 structures

3. **Returns Evidence Data**
   - OFC metadata (code, discipline, subtype, layer, text)
   - Evidence excerpts with source document IDs and page numbers
   - Sorted by source document ID, then by page number

### Frontend UI

Displays:
- **OFC Information Card**: Code, title, required element, discipline, subtype, layer, OFC text
- **Evidence Table**: 
  - Excerpt (read-only, verbatim)
  - Source Document name/ID
  - Page number
- **Evidence Count**: Total number of supporting records

## What It Does NOT Do

### ❌ No Mutation
- Does not modify OFC definitions
- Does not modify evidence records
- Does not create or delete anything

### ❌ No Editing
- No edit buttons
- No regenerate buttons
- No delete actions
- No save functionality

### ❌ No Inference
- Does not infer or compute evidence
- Does not generate new evidence
- Does not suggest changes
- Displays only what exists in Phase 2.5 records

### ❌ No File Writes
- Does not write to filesystem
- Does not create new files
- Does not modify existing files
- Read-only file access only

### ❌ No Side Effects
- No database writes
- No API calls that modify state
- No logging that affects system behavior
- Pure read-only operation

## Data Sources

### OFC Definitions
- `app/lib/fixtures/ofc_templates_*.json`
- `public/doctrine/ofc_templates_*.json`

### Phase 2.5 Evidence
- `psa_engine/analytics/coverage_library/baseline/[DISCIPLINE]/[SUBTYPE]/[DOCUMENT_ID]/[RECORD_ID].json`

### Evidence Record Structure

```json
{
  "schema_version": "coverage_record.v1",
  "discipline_name": "Video Surveillance Systems",
  "subtype_name": "Monitoring",
  "source_document_id": "738190672-2-Std-SG-ORM1-2017-STD",
  "page": 24,
  "excerpt": "..."
}
```

## Why Evidence is Immutable

### Trust Through Visibility

Evidence records are **immutable** because:
1. They represent validated Phase 2.5 materializations
2. They are bound to specific source documents and pages
3. They provide traceability for audit and compliance
4. Modifying evidence would break the chain of trust

### Read-Only Design

The view is read-only to:
- Preserve evidence integrity
- Maintain audit trail
- Prevent accidental modification
- Ensure transparency without risk

## Usage

### For Administrators

1. Navigate to `/admin/ofcs/[ofc_code]/evidence`
2. View OFC metadata and supporting evidence
3. Use evidence excerpts to understand why the OFC exists
4. Reference source documents and page numbers for verification

### Example Workflow

1. Admin sees OFC `OFC-BL-BASE-001` in assessment results
2. Navigates to `/admin/ofcs/OFC-BL-BASE-001/evidence`
3. Reviews evidence table showing 5 supporting records
4. Verifies evidence excerpts match source documents
5. Uses page numbers to locate original citations

## Technical Details

### API Endpoint

**GET** `/api/admin/ofc-evidence?ofc_code=[OFC_CODE]`

**Response**:
```json
{
  "ofc_code": "OFC-BL-BASE-001",
  "ofc_metadata": {
    "required_element_code": "BASE-001",
    "discipline_name": "Security Management & Governance",
    "discipline_subtype_name": "Governance & Oversight",
    "layer": "baseline",
    "ofc_text": "...",
    "title": "..."
  },
  "evidence": [
    {
      "excerpt": "...",
      "page": 24,
      "source_document_id": "738190672-2-Std-SG-ORM1-2017-STD",
      "source_document_name": "ANSI/ASIS ORM.1-2017"
    }
  ],
  "evidence_count": 5
}
```

### Error Handling

- **400**: Missing `ofc_code` parameter
- **404**: OFC not found in template files
- **500**: Server error (file read failure, etc.)

### Performance

- File-based reads (no database queries)
- Efficient directory traversal
- Cached file system operations
- Suitable for admin use (not high-traffic)

## Related Documentation

- `docs/admin/INGESTION_STATUS_VIEW.md` - Similar read-only admin view pattern
- `docs/README_COVERAGE_UI.md` - Phase 2 coverage UI documentation
- `app/admin/README.md` - Admin toolbox overview

## Future Considerations

If evidence linking becomes more complex:
- Consider database-backed evidence links
- Maintain read-only nature
- Preserve immutability guarantees
- Keep audit trail intact

---

**Last Updated**: 2025-01-27  
**Status**: Active  
**Access**: Admin-only  
**Mutability**: Read-only

