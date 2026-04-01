# New Function Specification Template

Use this template when proposing or implementing a new function in the Asset Dependency Assessment Tool. Copy it into a new document in `docs/new-function-proposals/` (or equivalent) and replace placeholders with concrete information.

---

## Metadata

- **Function Name:** `<Concise Name>`
- **Owning Team:** `<Team or Individual>`
- **Related Epic / Issue:** `<Link>`
- **Target Release:** `<YYYY-MM or version>`
- **Status:** Draft | In Review | Approved | Implemented

## Summary

Provide a short overview describing the purpose of the function and the primary outcome it delivers for users or the system.

## Problem Statement

- What gap or limitation does this function address?
- Who is impacted today and how?
- What is the measurable success criterion?

## Requirements

### Functional

- `REQ-1` — ...
- `REQ-2` — ...

### Non-Functional

- `NFR-1` — Performance, security, or UX considerations.
- `NFR-2` — Operational or maintenance constraints.

## Solution Overview

Describe the high-level architecture or workflow. Include diagrams if available.

## User Experience

- UI Mockups / Wireframes (if applicable).
- User flows and edge cases.

## Data Model

- New data structures or schema changes.
- Backward compatibility considerations (migration, defaults).

## API / Integration

- Endpoints, events, or interfaces impacted.
- External system dependencies.

## Testing Strategy

Outline unit, integration, and end-to-end tests, plus manual validation steps.

## Rollout Plan

- Feature flag strategy (if any).
- Migration steps.
- Communication plan (release notes, user training).

## Open Questions

List unresolved items or decisions pending stakeholder input.

## Appendix

Add any supporting material such as detailed diagrams, metrics, or references to related documents.
