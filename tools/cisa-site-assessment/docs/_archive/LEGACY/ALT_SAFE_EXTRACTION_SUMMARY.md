# ALT_SAFE Extraction Summary

## Extraction Results

**Date**: 2025-01-13  
**Source**: `ALT_SAFE_Assessment.html`  
**Output**: `analytics/runtime/alt_safe_model_extracted.json`

### Statistics

- **Total Sections**: 79
- **Total Primary Questions**: 36
- **Questions with Conditional Detail Blocks**: Multiple (checkboxes/evidence items)
- **Technology Selectors**: Multiple (dropdowns for technology/system type selection)

### Structure Captured

#### 1. Sections
- Facility Information
- Information Sharing & Communication
- Various control topic sections
- Each section contains question_items array

#### 2. Primary Questions
- **Format**: Radio buttons (YES/NO/N/A)
- **Question Key**: Matches HTML input `name` attribute (e.g., "Awareness")
- **Question Text**: Extracted from labels (may need manual review for accuracy)
- **Response Enum**: `["YES", "NO", "N_A"]`

#### 3. Conditional Detail Blocks
- **Format**: Checkboxes
- **Structure**: Grouped by `block_id`
- **Items**: Each checkbox has `item_id`, `label`, `value`
- **Conditional Logic**: Shows when primary question answer is YES (default)

**Example**:
```json
{
  "question_key": "Awareness",
  "conditional_detail_blocks": [
    {
      "block_id": "AwarenessComp1",
      "items": [
        {
          "item_id": "AwarenessComp1",
          "label": "Regular employee training on suspicious activity recognition",
          "value": ""
        }
      ]
    }
  ],
  "conditional_logic": {
    "show_details_when": "YES",
    "trigger_answer": "YES"
  }
}
```

#### 4. Technology Selectors
- **Format**: Dropdown/select elements
- **Selector ID**: Matches HTML select `id` or `name` (e.g., "publicAccess")
- **Options**: Array of `{value, label}` pairs
- **Dependent Questions**: Array of question keys that appear based on selection
- **Dependent Detail Items**: Array of detail item IDs that appear based on selection

**Example**:
```json
{
  "selector_id": "publicAccess",
  "selector_label": "",
  "options": [
    {"value": "Open to Public", "label": "Open to Public"},
    {"value": "Limited Public Access", "label": "Limited Public Access"},
    {"value": "By Appointment Only", "label": "By Appointment Only"},
    {"value": "No Public Access", "label": "No Public Access"}
  ],
  "dependent_questions": [],
  "dependent_detail_items": []
}
```

## Known Issues / Improvements Needed

### 1. Question Text Extraction
- **Issue**: Some question text may be incomplete or missing
- **Reason**: HTML structure may have labels in different locations
- **Action**: Manual review and correction may be needed
- **Location**: Review `question_text` field in extracted JSON

### 2. Conditional Logic Detection
- **Current**: Defaults to "show when YES"
- **Improvement**: Parse JavaScript or data attributes to detect actual conditional logic
- **Action**: Review HTML for actual conditional logic patterns

### 3. Technology Selector Dependencies
- **Issue**: `dependent_questions` and `dependent_detail_items` arrays are empty
- **Reason**: Dependencies may be defined in JavaScript, not HTML structure
- **Action**: Review `SAFE3.0_Question_Logic.json` or JavaScript files for dependency mappings

### 4. Section Organization
- **Current**: 79 sections (many may be informational headers)
- **Action**: Review and consolidate sections that don't contain questions

## Next Steps

### 1. Review Extracted JSON
- [ ] Verify all primary questions are captured
- [ ] Check question text accuracy
- [ ] Identify missing conditional logic
- [ ] Map technology selector dependencies

### 2. Enhance Extraction (if needed)
- [ ] Improve label-to-question association
- [ ] Parse JavaScript for conditional logic
- [ ] Extract technology selector dependencies from logic files

### 3. Create Taxonomy Mapping
- [ ] Open `analytics/runtime/alt_safe_to_taxonomy_mapping.csv`
- [ ] For each primary question, map to PSA discipline/subtype
- [ ] Document mapping rationale
- [ ] Set confidence levels

### 4. Design Database Migration
- [ ] Review schema in `docs/baseline/baseline_model_aligned_schema.md`
- [ ] Create migration scripts
- [ ] Populate `assessment_primary_questions` table
- [ ] Populate `assessment_detail_items` table
- [ ] Populate `assessment_technology_selections` table

## Related Files

- **Extraction Tool**: `tools/extract_alt_safe_model.py`
- **Extracted Model**: `analytics/runtime/alt_safe_model_extracted.json`
- **Schema Design**: `docs/baseline/baseline_model_aligned_schema.md`
- **Mapping Template**: `analytics/runtime/alt_safe_to_taxonomy_mapping.csv`
- **Question Logic**: `C:\Users\frost\OneDrive\Desktop\Projects\SAFE_V3.0_MASTER\ALT_SAFE_DEPLOYMENT_2025-09-16_14-56-00\SAFE3.0_Question_Logic.json`

## Notes

- The extraction successfully captured the structure of ALT_SAFE assessment
- Primary questions are clearly identified by their `question_key`
- Conditional detail blocks are captured as separate items (not scored)
- Technology selectors are identified but dependencies need to be populated from logic files
- Manual review and enhancement may be needed for complete accuracy

