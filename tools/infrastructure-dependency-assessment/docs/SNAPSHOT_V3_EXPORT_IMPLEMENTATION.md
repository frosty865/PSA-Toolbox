# Snapshot Model v3 Export Implementation

**Status:** Ready for template migration  
**Date:** February 15, 2026

## Overview

The Python DOCX reporter (`apps/reporter/main.py`) now supports **Snapshot Model v3** anchor validation and rendering alongside the legacy template system.

## Template Mode Configuration

The reporter operates in one of two modes:

### Legacy Mode (Default)
- Uses: `[[TABLE_SUMMARY]]`, `[[CHART_*]]`, `[[TABLE_VOFC]]`, etc.
- Default behavior when `ADA_TEMPLATE_MODE` is not set or set to `"legacy"`

### Snapshot Model v3 Mode
- Uses: `[[SNAPSHOT_POSTURE]]`, `[[INFRA_*]]`, `[[SYNTHESIS]]`, etc.
- Activated by setting environment variable: `ADA_TEMPLATE_MODE=v3`

## V3 Anchor → Render Function Mapping

| Anchor | Render Function | Purpose |
|--------|----------------|---------|
| `[[FACILITY_NAME]]` | (placeholder replacement only) | Cover page: facility name |
| `[[ASSESSMENT_DATE]]` | (placeholder replacement only) | Cover page: assessment date |
| `[[SNAPSHOT_POSTURE]]` | `renderPostureHeader()` | Overall risk classification |
| `[[SNAPSHOT_SUMMARY]]` | `renderPostureSummary()` | One-sentence posture summary |
| `[[SNAPSHOT_DRIVERS]]` | `renderDriverStrip()` | Key risk drivers list (3-6 items) |
| `[[SNAPSHOT_MATRIX]]` | `renderInfrastructureMatrix()` | Infrastructure exposure matrix |
| `[[SNAPSHOT_CASCADE]]` | `renderCascadingIndicator()` | Cascading risk indicator (conditional) |
| `[[EXEC_SUMMARY]]` | `renderExecutiveSummary()` | Executive narrative summary |
| `[[INFRA_ENERGY]]` | `renderInfrastructureSection('ENERGY')` | Energy section content |
| `[[INFRA_COMMS]]` | `renderInfrastructureSection('COMMS')` | Communications section content |
| `[[INFRA_IT]]` | `renderInfrastructureSection('IT')` | IT section content |
| `[[INFRA_WATER]]` | `renderInfrastructureSection('WATER')` | Water section content |
| `[[INFRA_WASTEWATER]]` | `renderInfrastructureSection('WASTEWATER')` | Wastewater section content |
| `[[SYNTHESIS]]` | `renderCrossInfrastructureSynthesis()` | Cross-infrastructure analysis |
| `[[APPENDIX_INDEX]]` | `renderAppendixTable()` | Vulnerability index table |

## Failsafe Validation

The v3 validation function (`_assert_template_has_v3_anchors()`) performs the following checks **before DOCX generation**:

### Required Anchors Check
- Scans template for all 17 required v3 anchors
- If any missing: lists them clearly and exits with error
- Does not allow partial report rendering

### Forbidden Anchors Check
- Scans template for legacy anchors
- If any found: lists them clearly and exits with error
- Ensures clean migration from legacy to v3

### Error Output Example

```
================================================================================
ERROR: Template missing required Snapshot Model v3 anchors
================================================================================
  MISSING: [[SNAPSHOT_POSTURE]]
  MISSING: [[INFRA_ENERGY]]

See docs/TEMPLATE_ANCHORS.md for anchor placement guide.
================================================================================
ERROR: Template contains forbidden legacy anchors
================================================================================
  REMOVE: [[TABLE_SUMMARY]]
  REMOVE: [[CHART_ELECTRIC_POWER]]

Legacy anchors must be removed for Snapshot Model v3.
See docs/TEMPLATE_ANCHORS.md for migration guide.

Anchor Map Validation FAILED.
Fix template and re-run: pnpm template:check
```

## Empty Vulnerability Handling

### Legacy Mode
- Renders table with row: "No vulnerabilities identified"
- Always renders table structure even if empty

### V3 Mode (`render_v3_appendix_at_anchor`)
- **If vulnerabilities exist:** Renders "Appendix: Vulnerability Index" table
- **If NO vulnerabilities:** Appends sentence only:
  
  > "No infrastructure dependency vulnerabilities were triggered under assessed conditions."

- **Does not render empty tables** per v3 specification

## Usage

### Running in V3 Mode

```bash
# Set template mode environment variable
export ADA_TEMPLATE_MODE=v3

# Run reporter (from apps/web or reporter scripts)
python apps/reporter/main.py < assessment.json
```

### Validation Flow

1. **Template is loaded** (`Document(template_path)`)
2. **Failsafe check runs** (`_assert_template_has_required_anchors(doc)`)
   - Validates all v3 anchors present
   - Validates no legacy anchors present
   - Exits if validation fails
3. **Rendering proceeds** only if validation passes
4. **Success message:** `✓ Template anchor validation passed (Snapshot Model v3)`

## Migration Steps

To migrate from legacy to v3:

1. **Update Template**
   - Follow guide: `docs/TEMPLATE_ANCHORS.md`
   - Remove all legacy anchors
   - Add all 17 v3 anchors

2. **Validate Template**
   ```bash
   pnpm template:check
   ```

3. **Test Export in V3 Mode**
   ```bash
   ADA_TEMPLATE_MODE=v3 pnpm export:smoke
   ```

4. **Update Environment**
   - Set `ADA_TEMPLATE_MODE=v3` in production
   - Update CI/CD pipelines

5. **Declare Success**
   - When export succeeds deterministically
   - When anchor validation passes
   - When no legacy sections appear

## Success Criteria

When migration is complete:
- ✅ No "template missing anchors" error
- ✅ Snapshot renders first in report
- ✅ No legacy table sections appear  
- ✅ Export succeeds deterministically
- ✅ `_assert_template_has_v3_anchors()` validation passes

## Declaration

Upon successful migration completion, declare:

**"Anchor Map Realigned – Template v3 Locked."**

---

## Implementation Status

**Code Changes:**
- ✅ V3 anchor constants defined
- ✅ V3 validation function implemented
- ✅ Anchor → function mapping documented
- ✅ Failsafe checks active before generation
- ✅ Empty vulnerability fallback implemented
- ✅ Template mode switching (env var)

**Pending:**
- ⏳ Template DOCX manual update (requires Word)
- ⏳ Render function implementations (stubs referenced)
- ⏳ Export smoke test in v3 mode
- ⏳ Production deployment