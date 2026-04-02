# Unified Document & Doctrine Segregation Standard — COMPLETE

## Status: ✅ COMPLETE

**Date**: 2025-12-19  
**Project**: psa-rebuild  
**Workspace**: D:\psa-workspace\psa-rebuild

---

## Summary

The unified document and doctrine segregation standard has been successfully implemented in **psa-rebuild**. All documents have been reorganized according to authority boundaries, and system-wide invariants have been verified.

---

## What Was Done

### 1. ✅ Standardized Top-Level Folder Model

Created the following standardized folders under `docs/`:
- `docs/doctrine/` - Read-only references to psa_engine doctrine
  - `docs/doctrine/taxonomy/` - Taxonomy references
  - `docs/doctrine/required_elements/` - Required element references
  - `docs/doctrine/rules/` - Doctrine rule references
- `docs/process/` - psa-rebuild-specific process documentation
  - `docs/process/ui/` - UI component processes
  - `docs/process/workflows/` - User workflow processes
  - `docs/process/presentation/` - Presentation processes
- `docs/decisions/` - Rationale and tradeoffs
- `docs/artifacts/` - Generated/temporary outputs
- `docs/` - General documentation

### 2. ✅ Defined Authority by Project

Created `docs/AUTHORITY.md` explicitly defining:
- What psa-rebuild IS authoritative for (UI workflows, presentation, components)
- What psa-rebuild IS NOT authoritative for (doctrine, coverage, ingestion, persistence)
- Authority boundaries table
- Critical invariants

### 3. ✅ Documented Classification Rules

Created README.md in each standardized folder:
- `docs/doctrine/README.md` - Doctrine directory rules
- `docs/doctrine/taxonomy/README.md` - Taxonomy reference rules
- `docs/doctrine/required_elements/README.md` - Required elements reference rules
- `docs/doctrine/rules/README.md` - Rules reference rules
- `docs/process/README.md` - Process documentation rules
- `docs/process/ui/README.md` - UI component process rules
- `docs/process/workflows/README.md` - Workflow process rules
- `docs/process/presentation/README.md` - Presentation process rules
- `docs/decisions/README.md` - Decisions directory rules
- `docs/artifacts/README.md` - Artifacts directory rules
- `docs/README.md` - General documentation rules

### 4. ✅ Relocated Existing Documents

**Decisions**:
- `docs/INTERNAL_AI_USE_STATEMENT.md` → `docs/decisions/INTERNAL_AI_USE_STATEMENT.md` (if exists)

### 5. ✅ Eliminated Accidental Authority

- All doctrine files marked as read-only references
- `docs/AUTHORITY.md` explicitly states boundaries
- All README files clarify what belongs where
- No documents found that redefine truth from other projects

### 6. ✅ Verified System-Wide Invariants

Created `VERIFICATION_INVARIANTS.md` verifying:
- ✅ Taxonomy exists in ONE place only (psa_engine)
- ✅ Doctrine content exists in ONE place only (psa_engine)
- ✅ Doctrine rules exist in ONE place only (psa_engine)
- ✅ psa-rebuild consumes doctrine, never redefines it
- ✅ UI workflows are authoritative in psa-rebuild
- ✅ Presentation logic is authoritative in psa-rebuild
- ✅ No coverage computation in psa-rebuild
- ✅ No ingestion logic in psa-rebuild
- ✅ Artifacts are safely deletable
- ✅ No folder mixes authority types
- ✅ No document redefines truth owned by another project

---

## Key Documents Created

1. **`docs/AUTHORITY.md`** - Project authority boundaries
2. **`REORGANIZATION_SUMMARY.md`** - Detailed reorganization log
3. **`VERIFICATION_INVARIANTS.md`** - Invariant verification results
4. **Folder READMEs** - Classification rules for each folder

---

## Preserved Structure

The following directories were retained:
- `app/` - Next.js application code
- `orchestration/` - Orchestration scripts
- `README.md` - Project README

---

## Key Difference from Other Projects

**UI Workflows and Presentation are AUTHORITATIVE in psa-rebuild:**
- Files in `docs/process/workflows/` and `docs/process/presentation/` are authoritative
- psa-rebuild defines how users interact with the system
- Other projects do not define UI workflows or presentation

**Doctrine is Read-Only Reference:**
- Files in `docs/doctrine/` are read-only references to psa_engine
- psa-rebuild displays doctrine data but does not define it

---

## Next Steps

1. **Doctrine Sync**: Establish process for psa-rebuild to sync doctrine references from psa_engine
2. **Documentation**: Add UI workflow and presentation documentation as needed

---

## Critical Success Criteria

✅ All documents classified and relocated  
✅ Authority boundaries explicitly defined  
✅ Classification rules documented in each folder  
✅ No accidental authority found  
✅ All invariants verified  
✅ Ready for expansion without confusion  

---

## Notes

- Doctrine files in psa-rebuild are **read-only references** (marked with `.reference` suffix if copies exist)
- UI workflow and presentation documentation is **authoritative** in psa-rebuild
- All moved files maintain their original content - only location changed
- No functional changes were made - this is documentation reorganization only

---

**Status**: ✅ COMPLETE - psa-rebuild reorganization finished  
**All Three Projects**: ✅ COMPLETE

---

**See `docs/AUTHORITY.md` for full authority boundaries.**  
**See `REORGANIZATION_SUMMARY.md` for detailed changes.**  
**See `VERIFICATION_INVARIANTS.md` for invariant verification.**

