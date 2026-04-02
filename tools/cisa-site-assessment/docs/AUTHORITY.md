# Project Authority Boundaries — psa-web

## STATUS

This document defines what **psa-web** is authoritative for and what it is **NOT** authoritative for. This prevents accidental redefinition of truth owned by other projects.

---

## psa-web IS Authoritative For

### 1. UI Workflows
- **User workflows**: All user interaction flows and navigation patterns
- **UI behavior**: How the interface responds to user actions
- **Workflow design**: User journey and task flows
- **Location**: `docs/process/workflows/`

### 2. Presentation Logic
- **Data presentation**: How data is formatted and displayed to users
- **UI components**: Component behavior and styling
- **Visual design**: Layout, styling, and visual presentation
- **Location**: `docs/process/presentation/`

### 3. UI Components
- **Component architecture**: How UI components are structured
- **Component behavior**: Component-specific logic and interactions
- **Location**: `docs/process/ui/`

---

## psa-web IS NOT Authoritative For

### 1. Taxonomy
- **Source of truth**: `psa-engine` owns all taxonomy definitions
- **psa-web role**: Consumes taxonomy as read-only reference data
- **What NOT to do**: Do not redefine, modify, or extend taxonomy in psa-web

### 2. Doctrine Content
- **Source of truth**: `psa-engine` owns all required element definitions
- **psa-web role**: Displays doctrine data, does not define it
- **What NOT to do**: Do not create, modify, or extend required elements in psa-web

### 3. Doctrine Rules
- **Source of truth**: `psa-engine` owns all doctrine rules (scoring, N/A gating, etc.)
- **psa-web role**: Displays results based on rules, but does not define rules
- **What NOT to do**: Do not encode doctrine rules in psa-web code or documentation

### 4. Ingestion
- **Source of truth**: `psa-backend` owns ingestion mechanics
- **psa-web role**: Consumes ingested data via APIs, does not define ingestion
- **What NOT to do**: Do not define how documents are ingested or stored

### 5. Persistence
- **Source of truth**: `psa-backend` owns database schema and persistence
- **psa-web role**: Reads data via APIs, does not define storage
- **What NOT to do**: Do not define database schemas or storage formats

### 6. Coverage Computation
- **Source of truth**: `psa-engine` owns coverage computation logic
- **psa-web role**: Displays coverage results, does not compute coverage
- **What NOT to do**: Do not implement coverage computation logic

### 7. Interpretation Logic
- **Source of truth**: `psa-engine` owns interpretation logic
- **psa-web role**: Displays interpretation results, does not interpret
- **What NOT to do**: Do not implement interpretation logic

---

## Authority Boundaries Summary

| Domain | Authoritative Project | psa-rebuild Role |
|--------|----------------------|------------------|
| Taxonomy | `psa-engine` | Read-only reference |
| Required Elements | `psa-engine` | Display only |
| Doctrine Rules | `psa-engine` | Display only |
| Coverage Computation | `psa-engine` | Display results only |
| Interpretation | `psa-engine` | Display results only |
| Ingestion | `psa-backend` | Consumer only |
| Persistence | `psa-backend` | Consumer only |
| UI Workflows | **psa-web** | **Authoritative** |
| Presentation | **psa-web** | **Authoritative** |
| UI Components | **psa-web** | **Authoritative** |

---

## Critical Invariants

1. **No Doctrine Redefinition**: psa-web must never redefine taxonomy, required elements, or rules
2. **Reference Only**: When psa-web needs doctrine data, it must reference `psa-engine` as source of truth
3. **Display, Not Compute**: psa-web displays results from psa-engine, but does not compute them
4. **UI Authoritative**: psa-web defines how users interact with the system and how data is presented

---

## Enforcement

- All doctrine-related files in psa-web must be marked as **read-only references**
- Any document that appears to define doctrine must be relocated to `docs/decisions/` (historical) or replaced with a reference
- Code that appears to encode doctrine rules must be refactored to reference `psa-engine` rules
- UI workflow and presentation logic belongs in `docs/process/`

---

**END OF AUTHORITY DOCUMENT**

