# SAFE V3.0 Field Validation Rules & Relationships

## Overview
This document outlines the complete validation rules and field relationships for the SAFE V3.0 assessment system. The system enforces strict data quality requirements to ensure complete and accurate assessments.

## Field Categories

### 1. Facility Information
- **Required Fields**: `facilityName`, `assessmentDate`
- **Optional Fields**: All other facility details
- **Validation**: Required fields must not be empty

### 2. Security Questions (Information Sharing, Security Plans, Physical Security, Security Systems)
Each security question follows this pattern:

#### Primary Question (Radio Button)
- **Field Type**: Radio button with 3 options: Yes, No, NA
- **Required**: YES - Every question must have a response
- **Validation Rule**: Must select exactly one option

#### Follow-on Checkboxes (Conditional)
- **If Yes is selected**:
  - Must select at least one "Comp" checkbox (standards met)
  - Field pattern: `{QuestionName}Comp1`, `{QuestionName}Comp2`, `{QuestionName}Comp3`
  - Validation: At least one Comp checkbox required

- **If No is selected**:
  - Must select at least one "NoOFC" checkbox (options for consideration)
  - Field pattern: `{QuestionName}NoOFC1`, `{QuestionName}NoOFC2`, `{QuestionName}NoOFC3`
  - Validation: At least one NoOFC checkbox required

- **If NA is selected**:
  - No additional checkboxes required
  - Validation: Complete with just NA selection

### 3. Custom VOFCs (Vulnerabilities and Options for Consideration)
- **Required Fields**: All three fields must be populated
  - `customCategory{1-3}` (select dropdown)
  - `customVulnerability{1-3}` (textarea)
  - `customOFC{1-3}` (textarea)
- **Validation Rule**: ALL three fields must have content
- **Optional**: `customCommendable{1-3}` checkbox to mark as commendable

### 4. Commendable Practices
- **Required Fields**: All three fields must be populated
  - `commendableCategory{1-3}` (select dropdown)
  - `commendableAction{1-3}` (textarea)
  - `commendableImpact{1-3}` (textarea)
- **Validation Rule**: ALL three fields must have content

### 5. Points of Contact
- **Required Fields**: None (all optional)
- **Validation**: No validation required

## Validation Summary

### Critical Rules
1. **Every security question must have a response** (Yes/No/NA)
2. **Yes answers require at least one Comp checkbox**
3. **No answers require at least one NoOFC checkbox**
4. **Custom VOFCs require all three fields**
5. **Commendable practices require all three fields**

### Data Quality Enforcement
- Prevents incomplete assessments
- Ensures follow-on questions are answered
- Maintains data integrity for reporting
- Enforces business logic requirements

## Field Count Summary
- **Total Fields**: 300+ form fields
- **Required Fields**: 33 (facility info + security questions)
- **Conditional Fields**: 200+ (Comp/NoOFC checkboxes)
- **Optional Fields**: 70+ (custom items, contacts, etc.)

## JSON Structure Mapping
All fields map to a hierarchical JSON structure:
- `facilityInformation.*` - Facility details
- `informationSharing.*` - Information sharing questions
- `securityPlans.*` - Security planning questions
- `physicalSecurity.*` - Physical security questions
- `securitySystems.*` - Security systems questions
- `customVOFCs[]` - Custom vulnerabilities
- `commendablePractices[]` - Commendable practices
- `pointsOfContact.*` - Contact information

## Implementation Notes
- Validation runs on form submission
- Report generation requires complete data
- Auto-save preserves partial progress
- Export functions validate data completeness




