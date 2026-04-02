# OFC Library Evidence Model

## Overview

The OFC Library system replaces formulaic OFC generation with an evidence-backed, citation-required library. Every OFC must be sourced from referenceable material (citations), not generated from assessment responses.

## Core Principles

### 1. Citation-Required (Non-Negotiable)

- **Every OFC must have ≥1 citation** - Hard rule enforced in code and import validation
- **No generated text** - OFCs are selected from library, never invented from responses
- **Bibliographic references** - All sources stored in `canonical_sources` table

### 2. Selection-Only Nomination

- **Deterministic selection** - When response == NO, find eligible library OFC(s) and nominate
- **Scope precedence** - SUBSECTOR > SECTOR > BASELINE (more restrictive wins)
- **Missing library stubs** - If no library OFC exists, create nomination with:
  - `ofc_id = NULL`
  - `ofc_text_snapshot = NULL`
  - `status_reason = 'MISSING_LIBRARY_OFC'`
  - This is a work queue item, not an invented OFC

### 3. No Text Generation

- **Hard guardrails** - API endpoints reject any free-text `ofc_text` payloads
- **Library text only** - OFC text must come from `ofc_library.ofc_text`
- **Snapshot on nomination** - Text is copied to `ofc_text_snapshot` when nominated

## Data Model

### Tables

1. **`canonical_sources`**
   - Bibliographic references (PDF, WEB, GUIDE, STANDARD, MEMO, OTHER)
   - Required: `title`, `citation_text`, `source_type`
   - Optional: `author`, `publisher`, `published_date`, `uri`, `content_hash`

2. **`ofc_library`**
   - Curated OFC entries (WHAT capability, not HOW)
   - Required: `scope`, `link_type`, `link_key`, `ofc_text`, `solution_role`
   - Scope constraints:
     - BASELINE: `sector = NULL`, `subsector = NULL`
     - SECTOR: `sector IS NOT NULL`, `subsector = NULL`
     - SUBSECTOR: `sector IS NOT NULL`, `subsector IS NOT NULL`
   - Unique constraint: `(scope, sector, subsector, link_type, link_key, trigger_response, ofc_text)`

3. **`ofc_library_citations`**
   - Links OFCs to sources (≥1 required per OFC)
   - Optional: `excerpt`, `page_locator`

4. **`ofc_nominations` (updated)**
   - Added fields: `ofc_id`, `link_type`, `link_key`, `scope`, `ofc_text_snapshot`
   - Behavior:
     - If `ofc_id` provided: text comes from library
     - If `ofc_id = NULL`: MISSING_LIBRARY_OFC stub (no text)

### View

**`v_eligible_ofc_library`**
- Returns only OFCs with `status = 'ACTIVE'` and `citation_count >= 1`
- Used for nomination selection

## Eligibility Rules

### 1. Citation Required
- `citation_count >= 1` (enforced by view)
- `status = 'ACTIVE'`

### 2. Scope Precedence
- **SUBSECTOR > SECTOR > BASELINE** (more restrictive wins)
- When multiple OFCs match, select highest precedence scope

### 3. Scope Constraints
- **BASELINE**: Must have `scope='BASELINE'`, `sector=NULL`, `subsector=NULL`
- **SECTOR**: Must have `scope='SECTOR'`, `sector IS NOT NULL`
- **SUBSECTOR**: Must have `scope='SUBSECTOR'`, both `sector` and `subsector` set

## Workflow

### 1. Source Import
```bash
python tools/import_sources.py <sources.csv|sources.json>
```
- Imports bibliographic references into `canonical_sources`
- Outputs: `analytics/reports/source_import_report.json`

### 2. OFC Library Import
```bash
python tools/import_ofc_library.py
```
- Imports from:
  - `public/doctrine/ofc_library_baseline.json`
  - `public/doctrine/ofc_library_sector.json`
  - `public/doctrine/ofc_library_subsector.json`
- **Hard validation**: Rejects any OFC without citations
- Outputs: `analytics/reports/ofc_library_import_report.json`

### 3. Nomination Generation
```bash
python tools/generate_ofc_nominations_from_assessment.py [assessment_id]
```
- Processes assessment responses (NO answers)
- Selects eligible OFCs from library
- Creates nominations with library text snapshot
- Creates MISSING_LIBRARY_OFC stubs where gaps exist
- Outputs:
  - `analytics/reports/ofc_nomination_generation_report.json`
  - `analytics/reports/ofc_missing_library_queue.json`

## API Endpoints

### Public
- `GET /api/runtime/ofc-library` - List eligible OFCs (filtered)
- `GET /api/runtime/ofc-library/[ofcId]/citations` - Get citations for OFC

### Nomination
- `POST /api/ofc/nominations` - Create nomination (enforces no generated text)
  - Requires: `ofc_id` OR `link_type` + `link_key` (for MISSING_LIBRARY_OFC)
  - Rejects: Free-text `ofc_text` without `ofc_id`

## Hard Guardrails

### 1. No Generated Text
- `enforceNoGeneratedText()` in `app/lib/ofc_library/eligibility.ts`
- API endpoints reject free-text OFCs
- Only library text or NULL (for stubs) allowed

### 2. Citation Required
- Import validation: Rejects OFCs with zero citations
- View filter: Only returns OFCs with `citation_count >= 1`
- Eligibility check: `isEligible()` returns false if no citations

### 3. Scope Constraints
- Database CHECK constraints enforce scope rules
- Application validation: `validateScopeConstraints()`

## Missing Library OFCs

When no eligible library OFC exists for a NO answer:
- Create nomination with:
  - `ofc_id = NULL`
  - `ofc_text_snapshot = NULL`
  - `status_reason = 'MISSING_LIBRARY_OFC'`
  - `link_type` and `link_key` set to identify the gap
- This creates a work queue for curation
- UI shows "Needs library OFC" badge

## Acceptance Criteria

1. ✅ Cannot import an OFC without citations (hard fail)
2. ✅ Cannot nominate an OFC unless it has citations
3. ✅ Nomination generation produces:
   - Nominations with snapshot text only from library
   - MISSING_LIBRARY_OFC stubs where library gaps exist
4. ✅ No endpoint accepts free-text OFCs or "generated" OFC payloads

## Related Documentation

- `docs/SECTOR_SUBSECTOR_EXPANSION_ARCHITECTURE.md` - Expansion questions
- `docs/baseline/ALT_SAFE_REBUILD_PLAN.md` - ALT_SAFE model alignment
- `analytics/runtime/alt_safe_model_extracted.json` - Question keys

