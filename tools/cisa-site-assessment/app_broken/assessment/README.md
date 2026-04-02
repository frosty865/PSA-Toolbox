# Assessment UI Integration

## Overview

This module provides UI consumption and presentation of scoring outputs from psa-back. It displays baseline and sector assessment results in dashboard, detail, and printable report formats.

## API Contract

The UI expects scoring data from psa-back in the following JSON format:

```json
{
  "baseline": {
    "disciplines": [
      {
        "discipline_name": "Security Management & Governance",
        "total": 8,
        "yes": 6,
        "no": 2,
        "na": 0,
        "percent": 75.0,
        "subtypes": [
          {
            "subtype_name": "Policy & Planning",
            "total": 4,
            "yes": 3,
            "no": 1,
            "na": 0,
            "percent": 75.0
          }
        ]
      }
    ],
    "summary": {
      "total": 36,
      "yes": 28,
      "no": 6,
      "na": 2,
      "percent": 82.4
    },
    "findings": [
      {
        "element_code": "BASE-001",
        "title": "Security Responsibility Designation",
        "discipline": "Security Management & Governance",
        "subtype": "Policy & Planning"
      }
    ]
  },
  "sector": {
    "sector_id": "uuid-here",
    "sector_name": "Commercial Facilities",
    "disciplines": [...],
    "summary": {...},
    "findings": [...]
  }
}
```

**Key Rules:**
- `percent` is `null` when denominator (total - na) is 0
- `findings` array contains only items with `no` responses (gaps)
- Sector section is optional (only present if facility has a sector)

## Pages & Components

### `/assessment` - Main Assessment Page

**URL Parameters:**
- `documentId` (required): Document identifier for fetching assessment data

**Features:**
- Assessment Dashboard (summary cards)
- Baseline/Sector toggle (only shown if sector data exists)
- Discipline Detail View with roll-ups
- Printable Report View

### Components

#### `AssessmentDashboard`
Displays summary statistics for baseline and sector assessments.

**Display Rules:**
- Shows baseline card always
- Shows sector card only if `data.sector` exists
- Percent displays as "N/A" when `percent === null`
- N/A count labeled as "Excluded (N/A)"

#### `DisciplineDetailView`
Shows discipline-level roll-ups with subtype breakdowns.

**Display Rules:**
- Percent values match backend exactly (no recalculation)
- N/A items clearly labeled and excluded from percent math
- Subtypes shown when available

#### `PrintableReportView`
Generates a print-friendly report with executive summary and detailed findings.

**Structure:**
1. Executive Summary
   - Baseline highlights and gaps
   - Sector highlights and gaps (if applicable)
2. Detailed Findings
   - Baseline gaps grouped by discipline
   - Sector gaps grouped by discipline (if applicable)

#### `AssessmentViewToggle`
Tab-style navigation between Baseline and Sector views.

**Behavior:**
- Only renders if `hasSector === true`
- Defaults to "baseline" view
- Automatically switches to baseline if sector data disappears

## Display Rules (Strict)

1. **N/A Handling:**
   - N/A must be displayed as "N/A" (not 0%)
   - N/A items labeled as "Excluded (N/A)"
   - N/A count shown separately from YES/NO counts

2. **Percent Math:**
   - Percent values come directly from backend (no UI recalculation)
   - If `percent === null`, display "N/A"
   - Percent denominator = total - na (excludes N/A from calculation)

3. **Sector Visibility:**
   - If `data.sector` is undefined/null, hide all sector UI elements
   - Do not show empty placeholders for sector data

4. **Findings Display:**
   - Only NO responses appear in findings lists
   - Findings grouped by discipline and optionally by subtype

## Usage

### Accessing Assessment Page

```
/assessment?documentId=<document-id>
```

### Example Scenarios

1. **Facility with no sector:**
   - Baseline dashboard visible
   - Sector dashboard hidden
   - Toggle not shown
   - Report shows only baseline findings

2. **Commercial Facilities sector:**
   - Baseline + Sector dashboards visible
   - Toggle shown
   - Report shows both baseline and sector findings

3. **Healthcare sector:**
   - Baseline + Healthcare sector visible
   - Sector shows exactly 4 promoted items (if applicable)
   - Clear separation in report

## Non-Negotiable Constraints

✅ **Implemented:**
- No scoring logic in UI (backend is authoritative)
- N/A displayed as excluded (not failure)
- Baseline and sector clearly separated
- Percent values match backend exactly
- Sector UI hidden when no sector data

❌ **Not Implemented:**
- Subsector UI logic (unless backend contract includes it)
- New scoring fields
- Convergence indicators
- Doctrine changes

## Print Support

All components include print-friendly CSS:
- Monochrome-friendly styling
- Page break controls
- Consistent section headers
- No UI-only artifacts

Use browser print functionality (Ctrl+P / Cmd+P) to generate PDFs.
