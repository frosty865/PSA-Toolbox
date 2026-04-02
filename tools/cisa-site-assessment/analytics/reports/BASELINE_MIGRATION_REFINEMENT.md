# Baseline Migration Table Refinement - CONTROL_RESILIENCE Mapping

**Date:** 2025-12-28  
**Status:** COMPLETE

## Overview

The baseline migration table has been refined to correctly map MAINTENANCE_ASSURANCE questions to CONTROL_RESILIENCE for resilience-eligible subtypes.

## Refinement Process

### Initial State

- All MAINTENANCE_ASSURANCE questions mapped to CONTROL_OPERABLE (104 questions)

### Refinement Rules

MAINTENANCE_ASSURANCE questions are mapped to CONTROL_RESILIENCE if the subtype is:
- System-level and failure-sensitive
- Has centralized dependency or single-point failure risk

### Resilience-Eligible Subtypes

Based on user requirements and structural analysis:

1. **Video Surveillance Systems:**
   - Recording / Storage (NVR/DVR) - Centralized storage dependency
   - System Architecture - System-level architecture

2. **Access Control Systems:**
   - Electronic Access Control - Includes controllers/panels (centralized control)

3. **Intrusion Detection Systems:**
   - Alarm Panels - Centralized panel dependency

4. **Other (Centralized Dependency/Single-Point Failure Risk):**
   - Backup Communications - Backup system dependency
   - Redundancy / Backup Systems - Redundancy system
   - Sensitive Item Storage - Centralized storage dependency

## Refinement Results

### Questions Updated

**Total Updated:** 7 questions

**By Subtype:**
- Recording / Storage (NVR/DVR): 1
- System Architecture: 1
- Electronic Access Control: 1
- Alarm Panels: 1
- Backup Communications: 1
- Redundancy / Backup Systems: 1
- Sensitive Item Storage: 1

### Final Gate Distribution

| Gate | Count | Source |
|------|-------|--------|
| CONTROL_EXISTS | 104 | SYSTEMS dimension |
| CONTROL_OPERABLE | 97 | MAINTENANCE_ASSURANCE (standard) |
| CONTROL_RESILIENCE | 7 | MAINTENANCE_ASSURANCE (resilience-eligible) |

**Total:** 208 questions (104 + 97 + 7)

## Verification

✅ **Verification Passed**

- At least one CONTROL_RESILIENCE gate exists (7 found)
- No forbidden dimensions reintroduced
- All MAINTENANCE_ASSURANCE questions map to either CONTROL_OPERABLE or CONTROL_RESILIENCE (or RETIRE)

## Updated Files

1. **CSV:** `analytics/reports/baseline_migration_table.csv`
   - Updated with CONTROL_RESILIENCE mappings

2. **JSON:** `analytics/reports/baseline_migration_table.json`
   - Updated with refinement metadata and changes

3. **Summary:** `analytics/reports/baseline_migration_summary.md`
   - Updated with refinement changes

## Constraints Maintained

✅ **NO new questions** - Only existing questions remapped  
✅ **NO new IDs** - All IDs preserved  
✅ **NO framework language** - No changes to question text  
✅ **NO manual edits** - All changes determined by rules  
✅ **NO inference** - Only defined resilience-eligibility rules applied

## Related Documentation

- `docs/baseline/BASELINE_MIGRATION_TABLE.md` - Complete migration documentation
- `analytics/reports/baseline_migration_table.json` - Machine-readable migration table
- `analytics/reports/baseline_migration_table.csv` - CSV migration table

