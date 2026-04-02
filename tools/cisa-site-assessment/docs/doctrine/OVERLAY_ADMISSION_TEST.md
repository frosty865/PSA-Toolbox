# Overlay Admission Test Doctrine

## Core Principle

**Baseline questions define the minimum physical security capabilities that must exist at all facilities, regardless of sector or use. Sector and subsector overlays may only introduce new capability expectations that arise solely because of sector- or subsector-specific operational conditions. Overlays must never refine, qualify, or complete baseline behavior.**

---

## Overlay Admission Test

A capability MAY be introduced as a sector or subsector overlay ONLY IF ALL of the following are true:

1. **The capability would NOT reasonably apply to all facility types.**
   - The capability is not universally applicable across diverse facility contexts
   - It would be unreasonable to expect all facilities to have this capability

2. **The capability exists solely because of sector- or subsector-specific operations, missions, or use conditions.**
   - The need for the capability is directly caused by sector/subset operational characteristics
   - The capability would not be necessary absent these specific operational conditions

3. **The capability introduces a NEW expectation, not a refinement of baseline behavior.**
   - The capability is additive, not a clarification or enhancement of existing baseline
   - It does not complete, expand, or detail baseline questions

4. **The capability cannot be expressed as a baseline existence question without environmental qualifiers.**
   - A baseline question would require sector-specific language or context
   - The capability inherently depends on sector/subset characteristics

5. **The absence of the capability would NOT indicate baseline failure.**
   - Missing the capability does not mean baseline questions are inadequately answered
   - The capability is genuinely additional, not a baseline gap

**IF ANY TEST FAILS:**
→ The capability does NOT qualify as an overlay.

---

## What Overlays Must Never Do

Overlays MUST NOT:

- **Clarify baseline procedures** - Overlays cannot add detail to how baseline procedures should work
- **Add detail to baseline management practices** - Overlays cannot expand baseline management requirements
- **Introduce environmental nuance to baseline systems** - Overlays cannot refine baseline system requirements based on context
- **Replace or restate baseline questions** - Overlays cannot duplicate or modify baseline expectations
- **Compensate for intentionally minimal baseline design** - Overlays cannot fill perceived gaps in baseline scope

**If a capability feels like it is "finishing" baseline behavior, it is not an overlay.**

---

## Sector vs Subsector Overlays

### Sector Overlay

A **Sector Overlay** applies to all facilities within a DHS sector and introduces capabilities required due to broad sector operations.

**Characteristics:**
- Applies universally within the sector
- Driven by sector-wide operational characteristics
- Addresses capabilities needed across the sector's diverse facilities
- Must satisfy the Overlay Admission Test with sector-level applicability

**Example scope:**
- Capabilities required by all healthcare facilities
- Capabilities required by all transportation facilities
- Capabilities required by all commercial facilities

### Subsector Overlay

A **Subsector Overlay** applies only to a subset of facilities within a sector and introduces capabilities required due to specialized missions, populations, or environments.

**Characteristics:**
- Applies to a narrower subset than sector overlay
- Driven by specialized operational conditions within a sector
- Addresses capabilities needed for specific facility types or missions
- Must satisfy the Overlay Admission Test with narrower applicability

**Example scope:**
- Capabilities required by hospitals (within healthcare sector)
- Capabilities required by airports (within transportation sector)
- Capabilities required by data centers (within commercial facilities sector)

**Subsector overlays are more restrictive than sector overlays and must satisfy the same admission test with narrower applicability.**

---

## Common Non-Qualifying Examples

The following concepts are commonly proposed as overlays but do NOT qualify:

### Video Retention Procedures in Sensitive Areas
- **Why it fails:** This refines baseline video surveillance system management. Baseline already covers system existence and basic procedures. Retention specifics based on area sensitivity are operational refinements, not new capabilities.

### Access Control Refinements Based on Space Usage
- **Why it fails:** This adds environmental nuance to baseline access control. Baseline covers access control system existence. Space-specific access rules are operational details, not new capabilities.

### Additional Documentation Requirements
- **Why it fails:** This expands baseline documentation expectations. Baseline covers policy existence. Additional documentation types are procedural refinements, not new capabilities.

### Expanded Role Clarity or Training
- **Why it fails:** This adds detail to baseline personnel role definition. Baseline covers role existence. Expanded role descriptions are management refinements, not new capabilities.

### Operational Constraints That Apply Broadly Across Environments
- **Why it fails:** If constraints apply broadly, they may belong in baseline. If they are truly sector-specific, they must still pass the admission test. Many operational constraints are refinements of baseline systems, not new capabilities.

**These concepts may be important, but they are not overlays. They either belong in baseline or do not belong in the assessment model.**

---

## Governance and Enforcement

### Mandatory Application

- **This test is mandatory for all future overlay authoring** - No overlay content may be created without passing this test
- **Overlay content that fails the test must be rejected** - Content that does not meet all five admission criteria must not be included in overlays
- **Baseline v1 remains frozen** - Baseline Questions v1 cannot be modified. Overlays cannot compensate for baseline scope decisions.
- **Baseline v2 requires explicit versioning and justification** - Future baseline versions require formal version increment and justification. Overlays cannot serve as a workaround for baseline expansion.

### Review Process

All proposed overlay content must be evaluated against this doctrine before inclusion. Reviewers must verify that:

1. All five admission test criteria are satisfied
2. The overlay does not violate any "must never do" restrictions
3. The overlay is correctly classified as sector or subsector
4. The overlay does not duplicate or refine baseline behavior

### Authority

This doctrine is authoritative and non-negotiable. It defines the boundary between baseline and overlay content to prevent:

- Baseline erosion through overlay refinement
- Overlay misuse for baseline gaps
- Scope creep that blurs baseline and overlay distinctions
- Assessment model contamination with non-qualifying content

---

**Last Updated:** 2025-01-27  
**Status:** Authoritative Doctrine  
**Applies To:** Baseline Questions, Sector Overlays, Subsector Overlays, Vulnerability Patterns, OFC Patterns

