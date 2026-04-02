# SAFE V3.0 Assessment Mathematics & Scoring System

## Overview

The Security Assessment at First Entry (SAFE) V3.0 tool uses a comprehensive mathematical framework to calculate security posture metrics. This document explains the underlying mathematics and how each component is calculated.

## Core Mathematical Principles

### 1. Standards Total (Perfect Possible Score)
The total number of standards represents the maximum possible score achievable in the assessment.

```
Standards Total = (All YES response checkboxes) + (All NO response checkboxes)
```

**Why this works:**
- **YES responses**: Represent standards that could potentially be met
- **NO responses**: Represent standards that were missed but still exist as opportunities
- **N/A responses**: Exclude standards because the question doesn't apply to the facility

### 2. Standards Met (Sustain)
The number of standards actually achieved by the facility.

```
Standards Met = Σ(Checked checkboxes under YES responses)
```

**Calculation method:**
- Only count checkboxes under "YES" responses
- Only count checkboxes that are actually checked
- Visibility doesn't matter for counting (all checkboxes count toward total)

### 3. Enhancement Options (Opportunities)
The number of standards that could still be implemented.

```
Enhancement Options = Σ(Unchecked visible checkboxes under YES responses)
```

**Calculation method:**
- Only count checkboxes under "YES" responses
- Only count checkboxes that are NOT checked
- Only count checkboxes that are currently visible (not hidden by conditional logic)

## Mathematical Verification

### Primary Equation
```
Standards Met + Enhancement Options = Standards Total
```

### Example Calculation
```
Standards Total: 150
Standards Met: 59
Enhancement Options: 91

Verification: 59 + 91 = 150 ✓
```

## Conditional Logic Impact

### Video Surveillance Example
When a facility selects "No video surveillance system":

**Before conditional logic:**
- Video analytics checkboxes: 15 total
- Standards Total: Includes all 15 checkboxes

**After conditional logic:**
- Video analytics section: Hidden
- Standards Total: Still includes all 15 checkboxes (they exist as missed opportunities)
- Enhancement Options: 0 (section not visible for selection)

### Key Principle
Conditional logic affects **what users can see and select**, but doesn't change **what standards exist**. Hidden standards are still part of the total possible score.

## Response Type Impact

### YES Responses
- **Standards Total**: +All checkboxes
- **Standards Met**: +Checked checkboxes
- **Enhancement Options**: +Unchecked visible checkboxes

### NO Responses
- **Standards Total**: +All checkboxes (missed opportunities)
- **Standards Met**: +0 (no standards met)
- **Enhancement Options**: +0 (not enhancement options, these are vulnerabilities)

### N/A Responses
- **Standards Total**: +0 (question doesn't apply)
- **Standards Met**: +0 (no standards possible)
- **Enhancement Options**: +0 (no standards possible)

## Category-Based Calculations

### Information Sharing
- **Questions**: 14 total
- **Standards**: Varies by response type
- **Impact**: High due to multiple information exchange protocols

### Security Plans
- **Questions**: 7 total
- **Standards**: Management and planning elements
- **Impact**: Foundation for all other security measures

### Physical Security
- **Questions**: 7 total
- **Standards**: Perimeter, access, and building security
- **Impact**: Direct physical protection measures

### Security Systems
- **Questions**: 7 total
- **Standards**: Electronic and integrated systems
- **Impact**: Technology-based security capabilities

## TLP Color Coding

### Standards Met Progress Bars
Progress bars use Traffic Light Protocol (TLP) colors based on percentage achieved:

```
Percentage Range    | TLP Color | Meaning
90-100%            | Green     | Excellent performance
70-89%             | Yellow    | Good performance
0-69%              | Red       | Needs attention
```

### Color Calculation
```javascript
if (percentage >= 90) {
    tlpClass = 'tlp-green';     // Green for 90-100%
} else if (percentage >= 70) {
    tlpClass = 'tlp-yellow';    // Yellow for 70-89%
} else {
    tlpClass = 'tlp-red';       // Red for 0-69%
}
```

## Data Collection Process

### Step 1: Question Response Analysis
1. Identify all radio button responses (YES/NO/N/A)
2. Map responses to question categories
3. Determine which conditional sections are visible

### Step 2: Standards Counting
1. Count all checkboxes under YES responses
2. Count all checkboxes under NO responses
3. Exclude checkboxes under N/A responses
4. Calculate total possible standards

### Step 3: Achievement Calculation
1. Count checked checkboxes under YES responses
2. Count unchecked visible checkboxes under YES responses
3. Verify mathematical consistency

### Step 4: Enhancement Identification
1. Identify unchecked visible checkboxes under YES responses
2. Convert checkbox text to actionable statements
3. Group by category for reporting

## Validation Rules

### Mathematical Consistency
- Standards Met + Enhancement Options must equal Standards Total
- All percentages must be between 0% and 100%
- No negative values allowed

### Data Integrity
- All visible checkboxes must be accounted for
- Conditional logic must not break mathematical relationships
- Response types must be mutually exclusive

### Reporting Accuracy
- Category totals must sum to overall totals
- Individual question contributions must be traceable
- Enhancement options must be actionable

## Example Scenarios

### Scenario 1: High-Performing Facility
```
Standards Total: 150
Standards Met: 135
Enhancement Options: 15
Percentage: 90%
TLP Color: Green
```

### Scenario 2: Moderate-Performing Facility
```
Standards Total: 150
Standards Met: 105
Enhancement Options: 45
Percentage: 70%
TLP Color: Yellow
```

### Scenario 3: Needs Improvement Facility
```
Standards Total: 150
Standards Met: 45
Enhancement Options: 105
Percentage: 30%
TLP Color: Red
```

## Troubleshooting

### Common Issues
1. **Standards Total too low**: Check if NO response checkboxes are being counted
2. **Math doesn't add up**: Verify conditional logic isn't hiding checkboxes from counting
3. **Enhancement Options missing**: Ensure visibility checks are working correctly

### Debugging Steps
1. Check browser console for detailed logging
2. Verify question response types are correctly identified
3. Confirm conditional sections are properly hidden/shown
4. Validate checkbox counting logic

## Conclusion

The SAFE V3.0 mathematical framework provides a comprehensive and accurate assessment of facility security posture. By properly accounting for all possible standards while respecting conditional logic, the system delivers meaningful metrics that drive security improvement decisions.

The key insight is that **standards exist regardless of visibility** - conditional logic affects user experience but not mathematical accuracy. This ensures that facilities receive honest assessments of their security posture and clear guidance on improvement opportunities.

