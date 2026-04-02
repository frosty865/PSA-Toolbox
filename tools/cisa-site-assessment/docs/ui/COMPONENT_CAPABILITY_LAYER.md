# Component Capability Layer UI

## Overview

The Component Capability Layer provides optional, non-scoring questions about physical security components that are identified from Phase 2 evidence. This layer is displayed in the assessment execution UI but does not affect baseline scoring, sector logic, or assessment outcomes.

## Purpose

The Component Capability Layer exists to provide:

- **Visibility into physical components** implied by evidence in source materials
- **Structured confirmation** of component existence based on observed systems
- **Evidence-driven questions** that complement baseline assessment without modifying it

## UI Behavior

### Optional Display

- **User-controlled toggle**: Component capability layer can be shown or hidden
- **Auto-show**: Layer automatically displays if component questions are available
- **Non-blocking**: Layer does not block assessment completion
- **Non-required**: Responses are not required for assessment submission

### Placement

The Component Capability Layer appears in the assessment execution page:

- **After Baseline Questions**
- **Before Sector / Subsector Overlays**

This placement reflects that component questions are:
- Separate from baseline (not baseline questions)
- Separate from sector logic (not sector overlays)
- Evidence-driven (generated from Phase 2 coverage)

### Visual Distinction

**Label**: "Component Capability (Evidence-Based)"

**Subtext**: "These questions are generated from observed systems in source materials and do not affect baseline scoring."

**Badge**: "Optional" badge displayed next to the section title

**Styling**:
- Neutral styling (no scoring indicators)
- No progress bar inclusion
- No warning banners
- Subtle differentiation from baseline/sector sections

## Interaction Model

### Question Display

Each component question displays:
- Component name (from canonical component library)
- Question text (existence-based)
- Response options: YES / NO / N/A

### Response Handling

- **Auto-save**: Responses are saved automatically when selected
- **Separate storage**: Component responses stored separately from baseline responses
- **No scoring impact**: Responses do not affect any scoring calculations
- **No completion gating**: Responses are not required for assessment completion

### Response Storage

Component capability responses are stored in:
- **Fixture mode**: In-memory state with localStorage persistence
- **Backend mode**: Separate API endpoint (`/api/assessments/[assessmentId]/component-capability/responses`)

**Storage fields**:
- `assessment_id`
- `component_code`
- `response` (YES / NO / N/A)
- `timestamp`

## Data Source

### Questions

Component capability questions are loaded from:
- **File**: `analytics/candidates/component_capability_questions.json`
- **API**: `/api/assessments/[assessmentId]/component-capability/questions`

**Behavior**:
- If file doesn't exist: Layer is not shown (non-blocking)
- If questions array is empty: Layer is not shown
- Questions are read-only (not modified at render time)

### Responses

Component capability responses are:
- Loaded separately from baseline responses
- Stored separately from baseline responses
- Not aggregated into scoring views
- Not mixed with baseline response data

## Non-Scoring Guarantees

### Scoring Independence

- **Baseline scoring unchanged**: Component responses do not affect baseline scores
- **Sector scoring unchanged**: Component responses do not affect sector scores
- **Subsector scoring unchanged**: Component responses do not affect subsector scores
- **No aggregation**: Component responses are not included in any scoring calculations

### Assessment Completion

- **No gating**: Component responses are not required for assessment completion
- **No blocking**: Missing component responses do not prevent submission
- **Optional participation**: Users can choose to answer or skip component questions

### OFC Integration

- **No auto-attachment**: Component questions do not automatically attach OFCs
- **Separate from OFC logic**: Component responses do not trigger OFC generation
- **No OFC display**: OFCs are not shown for component questions

## Access Control

**Permissions**: Same users who can conduct assessments

**No special permissions required**: Component capability layer uses the same access control as assessment execution

## Relationship to Other Layers

### Baseline Questions

- Component capability layer is **separate** from baseline
- Component questions do **not** modify baseline behavior
- Component responses do **not** affect baseline scoring
- Component layer appears **after** baseline questions in UI

### Sector Overlays

- Component capability layer is **separate** from sector overlays
- Component questions do **not** introduce sector logic
- Component responses do **not** affect sector scoring
- Component layer appears **before** sector overlays in UI

### Subsector Overlays

- Component capability layer is **separate** from subsector overlays
- Component questions do **not** introduce subsector logic
- Component responses do **not** affect subsector scoring

## Validation

The Component Capability Layer UI ensures:

- ✅ Baseline scoring unchanged with or without component responses
- ✅ Component layer can be hidden/shown without side effects
- ✅ No OFCs auto-attach from this layer
- ✅ Sector overlays unaffected by component responses
- ✅ Assessment completion not blocked by component questions

## Technical Implementation

### Data Provider Functions

- `getComponentCapabilityQuestions(assessmentId)` - Loads questions from file/API
- `getComponentCapabilityResponses(assessmentId)` - Loads saved responses
- `saveComponentCapabilityResponse(assessmentId, componentCode, response)` - Saves response

### API Endpoints

- `GET /api/assessments/[assessmentId]/component-capability/questions` - Returns questions
- `GET /api/assessments/[assessmentId]/component-capability/responses` - Returns responses
- `POST /api/assessments/[assessmentId]/component-capability/responses` - Saves response

### UI Components

- Component Capability Layer section in assessment execution page
- Toggle button to show/hide layer
- Question display with YES/NO/N/A radio buttons
- Auto-save functionality

## Future Considerations

### Database Persistence

Currently, component capability responses are stored in-memory (fixture mode) or via API (backend mode). Future implementation may include:

- Database table: `component_capability_responses`
- Fields: `assessment_id`, `component_code`, `response`, `timestamp`
- Separate from baseline response tables

### Reporting

Component capability responses may be included in:
- Assessment detail reports (optional section)
- Component coverage analysis
- Evidence-to-component mapping reports

**Note**: Component responses remain non-scoring and informational only.

---

**Last Updated**: 2025-01-27  
**Status**: Active  
**Layer**: `component_capability`

