# ALT_SAFE Baseline Rebuild Plan

## Overview

This document outlines the plan to rebuild the PSA baseline assessment to match the ALT_SAFE assessment methodology. The current Baseline v2 uses a gate-ordered model (EXISTS/OPERABLE/RESILIENCE across 104 subtypes), which does not align with the ALT_SAFE methodology of primary questions + conditional details + technology decision points.

## Deliverables

### 1. Extraction Tool

**File**: `tools/extract_alt_safe_model.py`

**Purpose**: Extract authoritative assessment structure from `ALT_SAFE_Assessment.html`

**Usage**:
```bash
python tools/extract_alt_safe_model.py [path_to_html_file]
```

**Output**: `analytics/runtime/alt_safe_model_extracted.json`

**Extracts**:
- Sections and question groupings
- Primary questions (YES/NO/N/A radio buttons) with `question_key` (input name)
- Conditional detail blocks (checkboxes) with conditional logic
- Technology selectors (dropdowns) with dependent questions

**Features**:
- Parses HTML form structure
- Associates labels with inputs
- Detects conditional logic (show details when YES/NO)
- Captures technology selector options and dependencies

### 2. Schema Design

**File**: `docs/baseline/baseline_model_aligned_schema.md`

**Purpose**: Define canonical PSA baseline assessment schema aligned with ALT_SAFE methodology

**Key Tables**:

1. **`assessment_primary_questions`**
   - Primary scored questions (YES/NO/N/A)
   - One row per ALT_SAFE primary question
   - `question_key` matches HTML input `name` attribute

2. **`assessment_detail_items`**
   - Conditional detail items (checkboxes/evidence)
   - **NOT scored** - supporting evidence only
   - Conditional logic stored in JSONB

3. **`assessment_technology_selections`**
   - Technology decision points
   - Drives conditional questioning
   - Explicit selections (not inferred)

4. **`assessment_responses`** (Primary)
   - Responses to primary scored questions
   - Only these are used for scoring

5. **`assessment_detail_responses`**
   - Responses to conditional detail items
   - Not scored

6. **`assessment_technology_profile_responses`**
   - Technology selections made during assessment
   - Controls visibility of dependent questions

**Core Principles**:
- Only primary questions are scored
- Detail items are supporting evidence only
- Technology selections are explicit (not inferred)
- Conditional logic is explicit (stored in JSONB)
- No artificial gate multiplication

### 3. Mapping Template

**File**: `analytics/runtime/alt_safe_to_taxonomy_mapping.csv`

**Purpose**: Map ALT_SAFE primary questions to PSA taxonomy (discipline/subtype)

**Columns**:
- `primary_question_key`: Matches ALT_SAFE input name
- `question_text`: Full question text from ALT_SAFE
- `discipline_code`: PSA discipline code (e.g., ACS, VSS, PPS)
- `subtype_code`: PSA subtype code (optional if no subtype match)
- `notes`: Explanation of mapping rationale
- `mapping_confidence`: HIGH | MEDIUM | LOW | UNMAPPED

**Usage**: Populate after running extraction tool and analyzing question structure

## Workflow

### Step 1: Extract ALT_SAFE Structure

1. Obtain `ALT_SAFE_Assessment.html` file
2. Run extraction tool:
   ```bash
   python tools/extract_alt_safe_model.py ALT_SAFE_Assessment.html
   ```
3. Review `analytics/runtime/alt_safe_model_extracted.json`
4. Verify all primary questions, detail items, and technology selectors are captured

### Step 2: Map to PSA Taxonomy

1. Open `analytics/runtime/alt_safe_to_taxonomy_mapping.csv`
2. For each primary question in extracted JSON:
   - Identify corresponding PSA discipline/subtype (if applicable)
   - Document mapping rationale
   - Set mapping confidence level
3. Mark questions as UNMAPPED if no PSA taxonomy match exists

### Step 3: Design Database Schema

1. Review `docs/baseline/baseline_model_aligned_schema.md`
2. Create migration scripts for new tables:
   - `assessment_primary_questions`
   - `assessment_detail_items`
   - `assessment_technology_selections`
   - Update `assessment_responses` structure
   - Add `assessment_detail_responses`
   - Add `assessment_technology_profile_responses`
3. Preserve existing data where possible

### Step 4: Implement Migration

1. Create migration scripts
2. Populate `assessment_primary_questions` from extracted JSON
3. Populate `assessment_detail_items` from extracted JSON
4. Populate `assessment_technology_selections` from extracted JSON
5. Migrate existing responses where `question_key` matches
6. Archive or convert unmatched questions

### Step 5: Update UI and API

1. Update question rendering to show:
   - Primary questions (scored)
   - Conditional detail items (when appropriate)
   - Technology selectors with dependent questions
2. Update scoring logic to use only primary questions
3. Update OFC generation to use primary question responses

## Constraints

1. **No artificial gate multiplication** - One primary question per control topic unless ALT_SAFE explicitly splits it
2. **No confidence fields** - Response is YES/NO/N_A only
3. **No inferred technology** - Technology selections are explicit
4. **Detail items never scored** - They are evidence/supporting information only
5. **Conditional logic is explicit** - Stored in JSONB, not inferred
6. **No SAFE references** - Assessment methodology only
7. **No cyber/regulatory scope** - Physical security only
8. **No invention of new methodology** - Follow ALT_SAFE exactly

## Acceptance Criteria

- [ ] Extracted JSON reproduces exact question keys from HTML
- [ ] Conditional logic is represented explicitly (answer-driven + technology-driven)
- [ ] Mapping covers every primary question in the model
- [ ] Schema supports primary questions + detail items + technology selections
- [ ] Scoring uses only primary questions
- [ ] Detail items are captured but not scored
- [ ] Technology selections control visibility correctly

## Next Steps

1. **Obtain ALT_SAFE_Assessment.html** - Required to run extraction
2. **Run extraction** - Generate `alt_safe_model_extracted.json`
3. **Review extracted structure** - Verify completeness
4. **Create mapping** - Populate `alt_safe_to_taxonomy_mapping.csv`
5. **Design migration** - Create database migration scripts
6. **Implement schema** - Create tables and populate data
7. **Update UI/API** - Render new structure and scoring

## Notes

- This is an **extraction + redesign spec phase** - Baseline v2 is not modified yet
- Existing assessments will need migration strategy
- Technology differentiation layer (already implemented) aligns with this model
- OFC generation logic may need updates to work with new question structure

