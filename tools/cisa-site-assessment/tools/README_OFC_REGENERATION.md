# OFC Regeneration Against Baseline v2

## Overview

This script regenerates OFCs (Options for Consideration) against frozen Baseline v2, implementing gate-ordered evaluation and comprehensive validation.

## Purpose

**PHASE: STEP 4 of 5 — OFC REGENERATION + SIGNAL VALIDATION**

The script:
1. Evaluates assessment responses against Baseline v2 questions
2. Respects gate ordering (EXISTS → OPERABLE → RESILIENCE)
3. Triggers OFCs only when gates evaluate to NO
4. Creates OFC nominations with SYSTEM/ENGINE attributes
5. Produces comprehensive reports

## Prerequisites

1. **Database Connection**: Ensure `DATABASE_URL` or database credentials are set in `env.local`
2. **Baseline v2**: `analytics/runtime/baseline_questions_registry_v2.json` must exist
3. **Migration Table**: `analytics/reports/baseline_migration_table.json` must exist
4. **OFC Templates**: `public/doctrine/ofc_templates_baseline_v1.json` must exist
5. **Python Dependencies**: `psycopg2-binary` must be installed

## Usage

```bash
cd tools
python regenerate_ofcs_baseline_v2.py
```

## Process Flow

### 1. Baseline Evaluation
- Loads Baseline v2 questions (416 questions)
- Loads migration table for gate mappings
- Groups questions by discipline subtype

### 2. Gate Evaluation (Per Subtype)
- **CONTROL_EXISTS**: Evaluated first
- **CONTROL_OPERABLE**: Skipped if EXISTS = NO
- **CONTROL_RESILIENCE**: Skipped if EXISTS = NO or OPERABLE = NO
- Excludes N_A from scoring and OFC triggers

### 3. OFC Trigger Conditions
OFCs are triggered ONLY when:
- Gate = CONTROL_EXISTS AND response = NO
- Gate = CONTROL_OPERABLE AND response = NO (if EXISTS passed)
- Gate = CONTROL_RESILIENCE AND response = NO (if EXISTS and OPERABLE passed)

### 4. Validation Guards
The script will **FAIL** if:
- OFCs attach to retired baseline questions
- OFCs attach to forbidden dimensions (PLANS_PROCEDURES, PERSONNEL_RESPONSIBILITY)
- Any validation errors are detected

### 5. OFC Nomination Creation
Each OFC nomination is created with:
- `status = SUBMITTED`
- `submitted_by = SYSTEM`
- `submitted_role = ENGINE`
- Links to assessment, discipline, and subtype

## Output Reports

All reports are written to `analytics/reports/`:

### 1. `ofc_attachment_report.json`
- Total OFCs generated
- Breakdown by gate type
- Breakdown by discipline
- Per-assessment statistics

### 2. `ofc_comparison_v1_vs_v2.json`
- Comparison of v1 vs v2 OFC counts
- Delta calculations
- Per-assessment comparisons

### 3. `ofc_validation_log.json`
- All validation errors
- Skipped questions (with reasons)
- Failed OFC creation attempts

### 4. `sample_assessment_walkthrough.json`
- Example assessment showing baseline failures → OFCs
- Gate evaluation flow
- OFC attachment details

## Expected Outcomes

- **Total OFC count decreases** (due to gate ordering)
- **OFCs are more specific and actionable**
- **Resilience OFCs appear only where structurally justified**
- **No OFCs reference retired dimensions or framework language**

## Constraints

- ❌ NO modification to baseline questions
- ❌ NO modification to OFC templates
- ❌ NO new OFC logic paths
- ❌ FAIL task if OFCs attach to forbidden or retired baseline elements

## Database Schema Requirements

The script expects the following tables:
- `public.assessments` (assessment_id, name, created_at)
- `public.assessment_responses` (assessment_id, element_id, response, updated_at)
- `public.ofc_nominations` (with all required fields)

## Troubleshooting

### Error: "Table does not exist"
- Check database connection
- Verify table names match your schema
- Update table names in script if needed

### Error: "No migration table found"
- Ensure `analytics/reports/baseline_migration_table.json` exists
- Run `tools/generate_baseline_migration_table.py` if missing

### Validation Errors
- Review `ofc_validation_log.json` for details
- Check if questions are properly marked as retired
- Verify gate mappings in migration table

### No OFCs Generated
- Check if assessments have NO responses
- Verify gate evaluation logic
- Check if OFC templates exist for failed gates

## Notes

- The script processes ALL assessments in the database
- Existing OFC nominations are NOT deleted (new ones are created)
- Gate ordering is strictly enforced (cannot skip gates)
- N_A responses are excluded from OFC triggers

