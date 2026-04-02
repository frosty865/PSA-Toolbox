# Component Capability Layer

## Overview

The Component Capability Layer generates existence-based questions for physical security components exclusively from Phase 2 evidence. This layer is **optional**, **non-scoring**, and **evidence-gated**.

## Core Principle

**This layer asks existence questions for physical security components only when Phase 2 evidence indicates the component is present or relevant.**

## Layer Properties

### Optional
- Component capability questions are not required for baseline completeness
- Assessment scoring does not depend on this layer
- UI may choose to display or hide this layer

### Non-Scoring
- Component capability questions do not contribute to baseline, sector, or subsector scores
- Responses to component questions are informational only
- This layer does not gate baseline completeness

### Evidence-Gated
- Questions are generated only for components that appear in Phase 2 evidence
- Components without Phase 2 evidence linkage are not questioned
- Evidence must directly reference or imply the component

### Baseline-Adjacent
- This layer is separate from baseline questions
- Component questions do not modify, refine, or complete baseline behavior
- Component questions are additive and informational

## Generation Rules

### Component Identification

Components are identified from Phase 2 evidence through:

1. **Direct Reference**: Component name or code appears in evidence text
2. **Implied Presence**: Evidence describes activity that requires the component
   - Example: "monitoring video feeds" implies `VSS_MONITORING_WORKSTATION`
   - Example: "access control system" implies `ACS_CONTROLLER`

### Question Generation

For each observed component, generate **one existence question only**:

**Question Pattern:**
- "The facility has <component>."
- OR (if clarity required): "The facility has <component> supporting physical security operations."

**Audit Intent:**
- "Verify the existence of the specified physical security component."

**Constraints:**
- One question per component
- No refinement or configuration details
- No management nuance
- No schedules or procedures
- Existence verification only

## Scope

### In Scope
- Physical security components only
- Components from canonical component library
- Phase 2.5 materialized coverage evidence
- Existence-based questions

### Out of Scope
- Baseline question modifications
- Sector or subsector logic
- Scoring calculations
- Cyber or network components
- Regulatory or compliance content
- Components without Phase 2 evidence

## Relationship to Other Layers

### Baseline Questions
- Component capability layer does not modify baseline
- Component questions are separate from baseline questions
- Baseline scoring is independent of component questions

### Sector Overlays
- Component capability layer does not introduce sector logic
- Component questions are universal, not sector-specific

### Subsector Overlays
- Component capability layer does not introduce subsector logic
- Component questions are universal, not subsector-specific

## Non-Functional Guarantees

### Scoring
- **No Scoring Impact**: This layer does not affect baseline, sector, or subsector scoring
- Component capability questions are informational only
- Responses do not contribute to any scoring calculations

### Baseline Relationship
- **No Baseline Gating**: This layer does not gate baseline completeness
- Baseline questions remain independent of component capability questions
- Baseline scoring is unaffected by component question responses

### Presentation
- **Optional Presentation**: This layer is optional to present in UI
- UI may choose to display or hide component capability questions
- Component questions are not required for assessment completion

### Data Management
- **No Database Seeding**: Component questions are not automatically seeded into baseline tables
- Component questions remain in candidate/analytics space until explicitly promoted
- No automatic persistence to assessment databases

### OFC Integration
- **No OFC Attachment**: Component questions do not auto-attach OFCs
- Component questions are separate from OFC generation logic
- OFCs are not automatically associated with component questions

### Default Behavior
- **No Default Exposure**: Component questions are not exposed by default in assessments
- Component questions require explicit activation or selection
- Default assessment views do not include component capability layer

## Validation

Component capability questions must:

- Map to a canonical component code
- Have Phase 2 evidence support
- Not duplicate baseline questions
- Not contain sector or subsector fields
- Follow existence-only question pattern

## Authority

This layer is generated from Phase 2 evidence and canonical component library. It is read-only and does not modify doctrine or assessment logic.

---

**Last Updated:** 2025-01-27  
**Status:** Active  
**Layer Code:** `component_capability`

