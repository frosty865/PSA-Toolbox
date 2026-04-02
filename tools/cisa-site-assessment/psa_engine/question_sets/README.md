# Question Sets

This directory contains the **frozen, versioned question set definitions** for PSA assessments.

## Structure

### `BASELINE_CORE.index.json`
- **Purpose**: Universal baseline questions (applies to all facilities)
- **Version**: BASELINE_CORE_V1
- **Layer**: BASELINE_CORE
- **Groups**: Organized by functional area (GOVERNANCE, RISK_AND_PLANNING, etc.)
- **Rules**: 
  - Must be universal (telecom/small business included)
  - No sector-specific language
  - No context-dependent questions

### `MODULE.index.json`
- **Purpose**: Optional additive modules (not sector/subsector)
- **Layer**: MODULE
- **Modules**: 
  - MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT
  - MODULE_PUBLIC_VENUE_CREDENTIALING
  - MODULE_PUBLIC_INFORMATION
  - MODULE_MEDICAL_SUPPORT
  - MODULE_INSIDER_THREAT
- **Rules**: 
  - Additive only (no exclusion)
  - Selected at assessment creation
  - Questions are context-dependent but PSA-selectable

### `SECTOR.index.json`
- **Purpose**: Sector-specific additive questions
- **Layer**: SECTOR
- **Status**: Currently empty (reserved for future use)

### `SUBSECTOR.index.json`
- **Purpose**: Subsector-specific additive questions
- **Layer**: SUBSECTOR
- **Status**: Currently empty (reserved for future use)

## Composition Logic

When an assessment is created:

1. **BASELINE_CORE** is always included (universal)
2. **MODULES** are optionally selected (additive)
3. **SECTOR** questions are optionally included (additive)
4. **SUBSECTOR** questions are optionally included (additive)

The final question universe is frozen in `assessment_question_universe` table with deterministic ordering.

## Validation

Run before deployment:
```bash
python tools/quality/validate_baseline_core_universality.py
```

This ensures no non-universal questions are in BASELINE_CORE.

## Versioning

- Baseline core version is stored in `assessment_definitions.baseline_core_version`
- Past assessments remain reproducible (versioned question set)
- No "exclude" logic; only "include modules" logic


