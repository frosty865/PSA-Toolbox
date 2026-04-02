# SAFE 3.0 Question Logic Documentation

This document describes the question logic extracted from SAFE 3.0 assessment.

## Overview

- **Total Questions**: 36
- **Categories**: 4 (Information Sharing, Security Plans, Physical Security, Security Systems)
- **Source File**: `ALT_SAFE_Assessment.html` (729K characters, single HTML file)

## Question Structure

Each question follows this pattern:

1. **Question ID**: Unique identifier (e.g., `Awareness`, `LawEnforcement`)
2. **Question Title**: Numbered title (e.g., "1. Public Awareness Campaign")
3. **Question Text**: Full question text
4. **Answer Options**: Radio buttons (Yes/No/N/A)
5. **Components**: Checkboxes shown when answer is "Yes" (represent security standards)
6. **Options for Consideration (OFC)**: Checkboxes shown when answer is "No" (represent recommendations)

## Question Groups

### Information Sharing (14 questions)
- Awareness
- LawEnforcement
- LawComm
- FireAgency
- FireComm
- MedicalAgency
- MedicalComm
- FBIInfo
- ISACInfo
- HSINInfo
- InfraGard
- FederalInfo
- StateLocalInfo
- NeighborInfo

### Security Plans (7 questions)
- SecurityManager
- SecurityPlan
- PlanTraining
- PlanCoordination
- EmployeeTraining
- PlanTesting
- RiskAssessment

### Physical Security (7 questions)
- SecurityPersonnel
- PerimeterFencing
- AccessControl
- SecurityLighting
- StandoffDistance
- BuildingEnvelope
- KeyControl

### Security Systems (8 questions)
- VideoSystemType (special: has digital/analog/hybrid/none/na options)
- VideoAnalytics (conditional: only shown if VideoSystemType is digital or hybrid)
- VideoCoverage
- VideoMonitoring
- VideoRecording
- IntrusionDetection
- AlarmMonitoring
- SystemIntegration

## Branching Logic

### toggleQuestionDetails(questionId, answer)

Controls visibility of question details based on answer selection.

**When answer = "yes":**
- Shows: `{questionId}Details` section (contains component checkboxes)
- Hides: `{questionId}NoDetails` section (contains OFC checkboxes)

**When answer = "no":**
- Hides: `{questionId}Details` section
- Shows: `{questionId}NoDetails` section

**When answer = "na":**
- Hides: Both Details and NoDetails sections

### toggleVideoAnalytics(systemType)

Special handling for VideoSystemType question.

- **digital** or **hybrid**: Shows VideoAnalytics section
- **analog**, **none**, or **na**: Hides VideoAnalytics section

## Scoring Logic

### Standards Met
- **Definition**: Number of checked component checkboxes for questions answered "Yes"
- **Calculation**: Count all `{questionId}Comp*` checkboxes that are checked where answer = "yes"
- **Example**: If `Awareness="yes"` and `AwarenessComp1` and `AwarenessComp3` are checked → 2 standards met

### Standards Lost
- **Definition**: Number of standards lost when questions are answered "No"
- **Calculation**: For each question answered "no", count ALL components (even if not visible/checked)
- **Example**: If `LawComm="no"` and has 3 components → 3 standards lost

### Total Standards
- **Definition**: Total number of possible standards across all questions
- **Calculation**: Sum of all component checkboxes for questions answered "yes" or "no"
- **Note**: N/A responses do not contribute to total standards

### Enhancement Opportunities
- **Definition**: Unchecked components for questions answered "Yes"
- **Calculation**: For each question answered "yes", count unchecked component checkboxes
- **Example**: If `SecurityPlan="yes"` and has 4 components but only 2 are checked → 2 enhancement opportunities

### Vulnerabilities
- **Definition**: Number of questions answered "No"
- **Calculation**: Count of questions where answer = "no"
- **Note**: Each NO response = 1 vulnerability. Checked NoOFC checkboxes are collected as "options for consideration"

## Example Question Structure

### Question: Awareness

**ID**: `Awareness`  
**Title**: "1. Public Awareness Campaign"  
**Question Text**: "Are facility personnel aware of the nationwide 'If You See Something, Say Something' public awareness campaign?"

**Answer Options**:
- Yes (`Awareness="yes"`)
- No (`Awareness="no"`)
- N/A (`Awareness="na"`)

**Components** (shown when Yes is selected):
- `AwarenessComp1`: "Regular employee training on suspicious activity recognition"
- `AwarenessComp2`: "Visible signage promoting the campaign"
- `AwarenessComp3`: "Clear reporting procedures for suspicious activity"

**Options for Consideration** (shown when No is selected):
- `AwarenessNoOFC1`: "Consult your local PSA for information about the 'If You See Something, Say Something' public awareness campaign. For more information, visit the DHS website at https://www.dhs.gov/see-something-say-something/campaign-materials."

## Field Naming Conventions

- **Question Answer**: `{questionId}` (e.g., `Awareness`, `LawEnforcement`)
- **Components**: `{questionId}Comp{number}` (e.g., `AwarenessComp1`, `LawEnforcementComp2`)
- **Options for Consideration**: `{questionId}NoOFC{number}` (e.g., `AwarenessNoOFC1`, `LawEnforcementNoOFC2`)
- **Details Text Areas**: `{questionId}Details` (e.g., `LawEnforcementDetails`)

## Special Cases

### VideoSystemType
- Has different answer options: `digital`, `analog`, `hybrid`, `none`, `na`
- Does not have standard Comp checkboxes
- Affects visibility of VideoAnalytics question

### VideoAnalytics
- Only shown if VideoSystemType is `digital` or `hybrid`
- Has 12 components (Comp1-Comp12) for various analytics capabilities
- Follows same scoring logic as other questions when visible

## Code Locations

### Branching Logic
- `toggleQuestionDetails()`: Lines 5636-5667
- `toggleVideoAnalytics()`: Lines 5670-5728
- `toggleVideoAnalyticsDetails()`: Lines 5730-5745

### Scoring Logic
- Vulnerability collection: Lines 7228-7251
- Standards met calculation: Lines 7308-7327
- Total standards calculation: Lines 7334-7367
- Standards lost calculation: Lines 7369-7392
- Enhancement opportunities: Lines 7395-7420

## Data Storage

Question responses are stored in a JSON object with these fields:
- `{questionId}`: Answer value ("yes", "no", "na", or "digital"/"analog"/"hybrid"/"none" for VideoSystemType)
- `{questionId}Comp{number}`: Boolean (true/false) for each checked component
- `{questionId}NoOFC{number}`: Boolean (true/false) for each checked OFC
- `{questionId}Details`: String (for text areas like LawEnforcementDetails)

## Extracting Full Question Details

To get the complete text of all questions, components, and OFCs, you would need to parse the HTML file directly. The HTML structure is:

```html
<div class="question-item">
    <h4>{number}. {Title}</h4>
    <p>{Question Text}</p>
    <div class="radio-group">
        <input type="radio" name="{questionId}" value="yes">
        <input type="radio" name="{questionId}" value="no">
        <input type="radio" name="{questionId}" value="na">
    </div>
    <div class="conditional-section" id="{questionId}Details">
        <!-- Component checkboxes -->
        <input type="checkbox" id="{questionId}Comp1">
        <label for="{questionId}Comp1">{Component Text}</label>
        ...
    </div>
    <div class="conditional-section" id="{questionId}NoDetails">
        <!-- OFC checkboxes -->
        <input type="checkbox" id="{questionId}NoOFC1">
        <label for="{questionId}NoOFC1">{OFC Text}</label>
        ...
    </div>
</div>
```

## Summary

The question logic is embedded in a single HTML file (`ALT_SAFE_Assessment.html`). The structure is:
- **36 questions** organized into **4 categories**
- **Branching logic** via JavaScript functions (`toggleQuestionDetails`, `toggleVideoAnalytics`)
- **Scoring logic** counts checked components as "standards met"
- **Field naming** follows consistent patterns: `{questionId}Comp{number}` and `{questionId}NoOFC{number}`

For complete question text extraction, use the provided Python script or parse the HTML directly using the patterns described above.
