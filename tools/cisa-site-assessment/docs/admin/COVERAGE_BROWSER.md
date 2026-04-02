# Coverage Browser - Admin UI Documentation

## Overview

The Coverage Browser is a read-only admin UI that exposes baseline + sector overlay + subsector overlay coverage in a sector-first, drill-down interface. It provides visibility into the coverage library structure without allowing mutation or editing.

## Purpose

**What it does:**
- Displays coverage chunks organized by sector, discipline, and subtype
- Shows baseline (universal) coverage separately from sector and subsector overlays
- Provides visual differentiation between coverage layers
- Enables drill-down navigation from sector → discipline → subtype

**What it does NOT do:**
- Edit or mutate coverage data
- Create or delete coverage chunks
- Expose filesystem paths
- Allow cross-sector data visibility
- Generate or modify OFCs

## Sector-First Model

The Coverage Browser reflects the sector-first coverage library structure:

1. **Sector is REQUIRED context** - All coverage is viewed within a sector context
2. **Baseline is universal** - Baseline coverage applies to all sectors
3. **Overlays are additive** - Sector and subsector overlays add sector-specific requirements
4. **No cross-sector visibility** - Coverage from one sector is never shown in another sector's view

## UI Flow

### 1. Sector Selection (Required)

User must select a sector from the canonical list of 17 DHS Critical Infrastructure Sectors:
- Chemical
- Commercial Facilities
- Communications
- Critical Manufacturing
- Dams
- Defense Industrial Base
- Emergency Services
- Energy
- Financial Services
- Food and Agriculture
- Government Facilities
- Healthcare
- Information Technology
- Nuclear Reactors, Materials & Waste
- Transportation Systems
- Water and Wastewater
- Other

### 2. Discipline Selection

After selecting a sector, user can select a discipline from the canonical taxonomy.

### 3. Subtype Selection

After selecting a discipline, user can select a subtype from the canonical taxonomy (filtered by discipline).

### 4. Optional Subsector Selection

User can optionally enter a subsector name to view subsector overlay coverage.

## Display Panels

### Baseline Coverage (Always Shown)

**Label:** "Baseline (Universal)"

**Styling:**
- Neutral colors (gray border, light gray background)
- Always visible when coverage is loaded

**Content:**
- All baseline chunks for the selected sector/discipline/subtype
- Baseline chunks are sector-agnostic and apply universally

### Sector Overlay (Shown if Exists)

**Label:** "Sector Overlay (Additive)"

**Styling:**
- Highlighted colors (blue border, light blue background)
- Only shown if sector overlay chunks exist

**Content:**
- Sector-specific chunks that add requirements beyond baseline
- These chunks are additive only - they never replace baseline

### Subsector Overlay (Shown if Exists)

**Label:** "Subsector Overlay (Additive)"

**Styling:**
- Emphasized colors (dark blue border, darker blue background)
- Only shown if subsector overlay chunks exist and subsector is specified

**Content:**
- Subsector-specific chunks that add requirements beyond baseline and sector overlay
- These chunks are additive only - they never replace baseline or sector overlay

## Chunk Display

Each chunk shows:
- **Excerpt:** The evidence text
- **Source Document:** Document ID or name
- **Page:** Page number from source document
- **Discipline:** Discipline name (if available)
- **Subtype:** Subtype name (if available)

## Visual Differentiation

### Baseline
- Border: Gray (#71767a)
- Background: Light gray (#f8f9fa)
- Label: "Baseline (Universal)"

### Sector Overlay
- Border: Blue (#005ea2)
- Background: Light blue (#e7f3ff)
- Label: "Sector Overlay (Additive)"

### Subsector Overlay
- Border: Dark blue (#1a4480)
- Background: Darker blue (#d9e8f6)
- Label: "Subsector Overlay (Additive)"

## Baseline vs Overlay Meaning

### Baseline (Universal)

- Applies to ALL sectors
- Sector-agnostic requirements
- Universal system capabilities, documented plans, maintenance activities, roles and responsibilities
- Always asked in assessments

### Sector Overlay (Additive)

- Applies ONLY to specific sector
- Sector-specific requirements (regulatory, industry standards, operational constraints)
- Adds to baseline, never replaces it
- Asked only if assessment sector matches

### Subsector Overlay (Additive)

- Applies ONLY to specific subsector within a sector
- Subsector-specific requirements
- Adds to baseline and sector overlay, never replaces them
- Asked only if assessment sector and subsector match

## Read-Only Intent

The Coverage Browser is designed to be read-only:

1. **No editing controls** - No buttons to edit, delete, or create chunks
2. **No mutation** - All data is displayed as-is from the coverage library
3. **No filesystem exposure** - File paths are not shown to users
4. **View-only** - UI explains the system but does not control it

## Access Control

- **Admin roles only** - Access is restricted to administrative users
- **Server-side enforcement** - Access control is enforced at the API level
- **No public access** - Coverage data is not exposed to non-admin users

## API Endpoints

### GET /api/admin/coverage

**Query Parameters:**
- `sector` (required): Sector name
- `discipline` (optional): Discipline name
- `subtype` (optional): Subtype name
- `subsector` (optional): Subsector name

**Response:**
```json
{
  "sector": "healthcare",
  "discipline": "VIDEO_SURVEILLANCE",
  "subtype": "VSS_MONITORING",
  "baseline": [...],
  "sector_overlay": [...],
  "subsector_overlay": [...],
  "baseline_count": 44,
  "sector_overlay_count": 0,
  "subsector_overlay_count": 0,
  "total_count": 44
}
```

## Validation

The Coverage Browser enforces:

1. **Sector is required** - Cannot load coverage without sector context
2. **Baseline always loads** - Baseline chunks are always available
3. **Overlays never appear without baseline** - Overlays are shown as additive layers
4. **No cross-sector data** - Coverage from other sectors is never shown
5. **Empty states handled** - Clean display when no coverage is found

## Related Documentation

- `docs/OVERLAY_RULES.md` - Overlay rules and semantics
- `analytics/library/COVERAGE_LOADER_README.md` - Coverage loader API
- `analytics/coverage_library/FLATTENING_COMPLETE.md` - Coverage library structure

