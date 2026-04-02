# Document Reorganization Summary — psa-rebuild

## Date: 2025-12-19

## Purpose

Reorganized psa-rebuild documentation to enforce unified document and doctrine segregation standards across all three projects (psa_engine, psaback, psa-rebuild).

## Changes Made

### 1. Created Standardized Folder Structure

- `docs/doctrine/` - Read-only references to doctrine from psa_engine
  - `docs/doctrine/taxonomy/` - Taxonomy references
  - `docs/doctrine/required_elements/` - Required element set references
  - `docs/doctrine/rules/` - Doctrine rule references
- `docs/process/` - psa-rebuild-specific process documentation
  - `docs/process/ui/` - UI component processes
  - `docs/process/workflows/` - User workflow processes
  - `docs/process/presentation/` - Presentation processes
- `docs/decisions/` - Rationale and tradeoffs
- `docs/artifacts/` - Generated/temporary outputs
- `docs/` - General documentation

### 2. Created Authority Documentation

- `docs/AUTHORITY.md` - Defines what psa-rebuild is authoritative for and what it is not

### 3. Created Classification READMEs

- Each standardized folder has a README.md explaining:
  - What belongs there
  - What does NOT belong there
  - Authority boundaries
  - Classification type

### 4. Relocated Documents

#### Decisions
- `docs/INTERNAL_AI_USE_STATEMENT.md` → `docs/decisions/INTERNAL_AI_USE_STATEMENT.md` (if exists)

### 5. Preserved Existing Structure

- `app/` - Retained (Next.js application code)
- `orchestration/` - Retained (orchestration scripts)
- `README.md` - Retained (project README)

## Authority Boundaries Established

### psa-rebuild IS Authoritative For
- UI workflows
- User interactions
- Presentation logic
- UI component architecture

### psa-rebuild IS NOT Authoritative For
- Taxonomy (psa_engine)
- Required elements (psa_engine)
- Doctrine rules (psa_engine)
- Coverage computation (psa_engine)
- Interpretation (psa_engine)
- Ingestion (psaback)
- Persistence (psaback)

## Critical Invariants Verified

- ✅ Doctrine references are marked as read-only
- ✅ Process documentation is in docs/process/ folders
- ✅ Decisions are in docs/decisions/ folder
- ✅ Artifacts are in docs/artifacts/ folder
- ✅ Authority boundaries are documented
- ✅ Classification rules are documented in each folder
- ✅ No doctrine, coverage, or ingestion logic found

## Next Steps

1. **Sync**: Establish process for psa-rebuild to sync doctrine references from psa_engine
2. **Code Updates**: Update any code paths that reference moved files (if needed)

## Notes

- Doctrine files in psa-rebuild are **read-only references** (marked with `.reference` suffix if copies exist)
- psa-rebuild displays data from psa_engine and psaback, but does not define that data
- All moved files maintain their original content - only location changed

---

**See `docs/AUTHORITY.md` for full authority boundaries.**  
**See `VERIFICATION_INVARIANTS.md` for invariant verification.**

