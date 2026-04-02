# SAFE Assessment Logic and Scoring System

## Overview
The SAFE (Security Assessment for Facilities and Environments) assessment uses a comprehensive scoring system that evaluates facility security across multiple disciplines. This document details the logic, scoring methodology, and how different response types contribute to the final assessment results.

## Assessment Structure

### Question Categories
The assessment is organized into four main security disciplines:

1. **Information Sharing** (14 questions)
   - Awareness, Law Enforcement, Fire Agency, Medical Agency, FBI, ISAC, HSIN, InfraGard, Federal Agencies, State/Local, Neighbor Facilities

2. **Security Plans** (7 questions)
   - Security Manager, Security Plan, Training, Coordination, Employee Training, Testing, Risk Assessment

3. **Physical Security** (7 questions)
   - Security Personnel, Perimeter Fencing, Access Control, Security Lighting, Standoff Distance, Building Envelope, Key Control

4. **Security Systems** (7 questions)
   - Video Surveillance, Video Coverage, Monitoring, Recording, Intrusion Detection, Alarm Monitoring, System Integration

### Question Response Types
Each question has three possible responses:

- **Yes**: Facility meets the security requirement
- **No**: Facility does not meet the security requirement
- **N/A**: Question is not applicable to this facility

## Scoring Logic

### Standards Counting

#### Total Standards Calculation
- **Base Standards**: 135 total possible standards across all questions
- **Applicable Standards**: Only standards from questions with "Yes" or "No" responses are counted
- **N/A Impact**: Standards from "N/A" questions are excluded from the total count
- **Custom Vulnerabilities**: Each custom vulnerability adds +1 to the total standards count

**Formula**: `Total Standards = Applicable Standards + Custom Vulnerabilities`

#### Standards Met Calculation
- **Counted From**: Checked checkboxes under "Yes" responses only
- **Not Counted**: Unchecked checkboxes under "Yes" responses (these become Enhancement Opportunities)
- **N/A Questions**: Standards are excluded from both total and met counts

**Formula**: `Standards Met = Sum of checked checkboxes under "Yes" responses`

### Response Type Processing

#### "Yes" Response Logic
- **Purpose**: Identifies security standards that are currently met
- **Checkbox Validation**: Must have at least one `Comp` checkbox selected
- **Scoring Impact**: 
  - Checked checkboxes → Count toward Standards Met
  - Unchecked checkboxes → Become Enhancement Opportunities
- **Example**: If "Security Plan" = Yes with 3 of 4 checkboxes checked:
  - Standards Met: +3
  - Enhancement Opportunities: +1 (the unchecked item)

#### "No" Response Logic
- **Purpose**: Identifies security vulnerabilities that need addressing
- **Checkbox Validation**: Must have at least one `NoOFC` checkbox selected
- **Scoring Impact**: Creates one vulnerability per "No" response question
- **Options for Consideration**: Selected `NoOFC` items become the vulnerability's options
- **Example**: If "Perimeter Fencing" = No with 2 OFCs selected:
  - Vulnerabilities: +1
  - Options for Consideration: Lists the 2 selected OFCs

#### "N/A" Response Logic
- **Purpose**: Excludes non-applicable questions from scoring
- **Checkbox Validation**: No checkbox validation required
- **Scoring Impact**: 
  - Standards are excluded from total count
  - Standards are excluded from met count
  - No vulnerabilities or enhancement opportunities created
- **Example**: If "Video Analytics" = N/A:
  - Total Standards: -10 (excludes all video analytics standards)
  - No other scoring impact

### Enhancement Opportunities

#### Definition
Enhancement Opportunities are unchecked checkboxes under "Yes" responses that represent areas for improvement.

#### Processing Logic
1. **Collection**: Identifies unchecked `Comp` checkboxes under "Yes" responses
2. **Transformation**: Converts checkbox text to actionable statements using `convertToActionStatement()`
3. **Display**: Shows as professional, actionable recommendations

#### Action Statement Examples
- **Before**: "Active InfraGard membership"
- **After**: "Join and maintain active InfraGard membership"

- **Before**: "Perimeter fencing with appropriate height and construction"
- **After**: "Install perimeter fencing with appropriate height and construction"

### Vulnerabilities

#### Definition
Vulnerabilities are security gaps identified through "No" responses that require immediate attention.

#### Processing Logic
1. **Collection**: Creates one vulnerability per "No" response question
2. **Question Text**: Uses `getQuestionText()` to convert to negative statements
3. **Options for Consideration**: Lists selected `NoOFC` items as actionable options

#### Question Text Transformation Examples
- **Question ID**: "SecurityPlan"
- **Displayed As**: "The facility does not have a comprehensive security plan."

- **Question ID**: "PerimeterFencing"
- **Displayed As**: "The facility does not have perimeter fencing or barrier systems."

### Custom Vulnerabilities

#### Definition
User-defined security vulnerabilities that are not covered by the standard assessment questions.

#### Processing Logic
1. **Collection**: Gathers from custom vulnerability form fields
2. **Type Tagging**: All marked as `type: 'Vulnerability'` (no differentiation from assessment-driven)
3. **Scoring Impact**: Each custom vulnerability increases total standards by +1
4. **Display**: Included in main vulnerabilities section

#### Example
- **Category**: "Information Sharing"
- **Description**: "Limited social media monitoring for potential threats"
- **Options**: "Implement social media threat monitoring program"
- **Impact**: +1 to total standards count

### Commendables

#### Definition
Exceptional security practices or initiatives that exceed standard requirements.

#### Processing Logic
1. **Collection**: Gathers from commendable action form fields
2. **Scoring Impact**: No impact on standards count (bonus items)
3. **Display**: Listed separately as commendable practices

#### Example
- **Category**: "Access Control"
- **Action**: "Implemented comprehensive visitor management system with photo ID verification"
- **Impact**: "Significantly improved facility access control and visitor accountability"

## Mathematical Relationships

### Core Equations

```
Total Standards = Applicable Standards + Custom Vulnerabilities
Standards Met = Sum of checked checkboxes under "Yes" responses
Enhancement Opportunities = Sum of unchecked checkboxes under "Yes" responses
Vulnerabilities = Count of "No" responses + Custom vulnerabilities
```

### Validation Rules

#### "Yes" Response Validation
- Must have at least one `Comp` checkbox selected
- Validation checks: `[id*="${questionId}Comp"]`

#### "No" Response Validation
- Must have at least one `NoOFC` checkbox selected
- Validation checks: `[id*="${questionId}NoOFC"]`

#### "N/A" Response Validation
- No checkbox validation required
- Standards automatically excluded from calculations

### Report Generation Logic

#### Data Collection Order
1. **Vulnerabilities**: Collect from "No" responses and custom fields
2. **Standards Met**: Count checked checkboxes under "Yes" responses
3. **Enhancement Opportunities**: Transform unchecked "Yes" checkboxes to action statements
4. **Custom Vulnerabilities**: Include in vulnerability count and total standards
5. **Commendables**: Collect from commendable action fields

#### Display Formatting
- **Vulnerabilities**: "Vulnerability: [Negative Statement]" + "Options for Consideration: [Selected OFCs]"
- **Enhancement Opportunities**: [Action Statement] (no question text)
- **Standards Met**: [Category]: [Met]/[Total] ([Percentage]%)
- **Custom Vulnerabilities**: Integrated with regular vulnerabilities, no differentiation

## Example Calculations

### Scenario: 25-Question Assessment
- **Total Questions**: 25
- **Yes Responses**: 15 (with 60 total standards)
- **No Responses**: 7 (with 28 total standards)
- **N/A Responses**: 3 (with 12 total standards)
- **Custom Vulnerabilities**: 2

### Calculation Breakdown
```
Applicable Standards = 60 + 28 = 88
Total Standards = 88 + 2 = 90
Standards Met = 45 (from checked "Yes" checkboxes)
Enhancement Opportunities = 15 (from unchecked "Yes" checkboxes)
Vulnerabilities = 7 + 2 = 9
```

### Validation Results
- **Standards Met**: 45/90 (50%)
- **Enhancement Opportunities**: 15 actionable items
- **Vulnerabilities**: 9 items requiring attention
- **Custom Vulnerabilities**: 2 user-defined issues

## Key Principles

1. **One Vulnerability Per "No" Response**: Each "No" creates exactly one vulnerability, regardless of how many OFCs are selected
2. **Standards Exclusion for N/A**: N/A responses reduce the total applicable standards count
3. **Custom Integration**: Custom vulnerabilities are treated identically to assessment-driven ones
4. **Actionable Enhancement**: Enhancement opportunities are transformed into professional action statements
5. **Comprehensive Validation**: Each response type has appropriate checkbox validation rules

## Troubleshooting

### Common Issues
- **"Missing Checkbox" for "No" responses**: Check that validation is looking for `NoOFC` checkboxes, not `Comp` checkboxes
- **Incorrect Standards Count**: Verify that N/A responses are properly excluding standards from calculations
- **Duplicate Vulnerabilities**: Ensure vulnerability collection creates one per "No" response, not per unchecked checkbox
- **Generic Enhancement Text**: Verify that `convertToActionStatement()` function has comprehensive mapping table

### Debug Tools
- **Temporary Debug Box**: Shows raw counts and calculations for troubleshooting
- **Validation Results**: Displays missing responses and checkbox selections
- **Report Review**: Provides detailed breakdown of all collected data

