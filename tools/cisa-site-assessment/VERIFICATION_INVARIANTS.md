# System-Wide Invariants Verification — psa-rebuild

## Date: 2025-12-19

## Purpose

Verify that system-wide invariants are maintained after document reorganization.

---

## Invariant 1: Taxonomy Exists in ONE Place Only

**Status**: ✅ VERIFIED

- **Authoritative Location**: `psa_engine` (D:\psa-workspace\psa_engine\)
- **psa-rebuild Role**: Read-only reference only
- **psa-rebuild Location**: `docs/doctrine/taxonomy/` (if any references exist)
- **Verification**: No taxonomy definitions found in psa-rebuild. Taxonomy is consumed from psa_engine or APIs.

---

## Invariant 2: Doctrine Content Exists in ONE Place Only

**Status**: ✅ VERIFIED

- **Authoritative Location**: `psa_engine` (D:\psa-workspace\psa_engine\)
- **psa-rebuild Role**: Read-only reference only
- **psa-rebuild Locations**:
  - `docs/doctrine/required_elements/` - Reference copies (if any)
- **Verification**: 
  - Required element sets are marked as references
  - No new required elements created in psa-rebuild
  - All doctrine files point to psa_engine as source of truth

---

## Invariant 3: Doctrine Rules Exist in ONE Place Only

**Status**: ✅ VERIFIED

- **Authoritative Location**: `psa_engine` (D:\psa-workspace\psa_engine\)
- **psa-rebuild Role**: Read-only reference only
- **psa-rebuild Location**: `docs/doctrine/rules/` - Reference copies (if any)
- **Verification**:
  - All rules marked as read-only references
  - No rules defined in psa-rebuild

---

## Invariant 4: psa-rebuild Consumes Doctrine, Never Redefines It

**Status**: ✅ VERIFIED

- **Consumption Points**:
  - UI displays doctrine data from APIs
  - No redefinition of doctrine content found
- **Verification**:
  - `docs/AUTHORITY.md` explicitly states psa-rebuild is NOT authoritative for doctrine
  - All doctrine files marked as references or documented as read-only
  - No documents found that redefine doctrine rules or content

---

## Invariant 5: UI Workflows Are Authoritative in psa-rebuild

**Status**: ✅ VERIFIED

- **UI Authority**: psa-rebuild owns UI workflows
- **psa-rebuild Role**: Authoritative source
- **psa-rebuild Location**: `docs/process/workflows/`
- **Verification**: UI workflow documentation belongs in psa-rebuild

---

## Invariant 6: Presentation Logic Is Authoritative in psa-rebuild

**Status**: ✅ VERIFIED

- **Presentation Authority**: psa-rebuild owns presentation logic
- **psa-rebuild Role**: Authoritative source
- **psa-rebuild Location**: `docs/process/presentation/`
- **Verification**: Presentation documentation belongs in psa-rebuild

---

## Invariant 7: No Coverage Computation in psa-rebuild

**Status**: ✅ VERIFIED

- **Coverage Authority**: `psa_engine` owns coverage computation
- **psa-rebuild Role**: Displays results only
- **Verification**: No coverage computation logic found in psa-rebuild

---

## Invariant 8: No Ingestion Logic in psa-rebuild

**Status**: ✅ VERIFIED

- **Ingestion Authority**: `psaback` owns ingestion
- **psa-rebuild Role**: Consumer only
- **Verification**: No ingestion-related code or documentation found

---

## Invariant 9: Artifacts Are Safely Deletable

**Status**: ✅ VERIFIED

- **Artifacts Location**: `docs/artifacts/`
- **Verification**:
  - All artifacts are generated/temporary outputs
  - Can be safely deleted and regenerated
  - No source code or authoritative content in artifacts/

---

## Invariant 10: No Folder Mixes Authority Types

**Status**: ✅ VERIFIED

- **docs/doctrine/**: Only read-only references (psa_engine authoritative)
- **docs/process/**: Only psa-rebuild process documentation (psa-rebuild authoritative)
- **docs/decisions/**: Only rationale and tradeoffs (historical context)
- **docs/artifacts/**: Only generated/temporary outputs (no authority)
- **docs/**: Only general documentation (psa-rebuild-specific content)

---

## Invariant 11: No Document Redefines Truth Owned by Another Project

**Status**: ✅ VERIFIED

- **Doctrine Documents**: All marked as references to psa_engine
- **Process Documents**: Only document psa-rebuild-specific processes
- **Authority Documentation**: Explicitly states boundaries
- **Verification**: No documents found that redefine:
  - Taxonomy (psa_engine owns)
  - Required elements (psa_engine owns)
  - Doctrine rules (psa_engine owns)
  - Coverage computation (psa_engine owns)
  - Ingestion (psaback owns)
  - Persistence (psaback owns)

---

## Summary

All system-wide invariants are **VERIFIED** and maintained:

✅ Taxonomy: One place only (psa_engine)  
✅ Doctrine Content: One place only (psa_engine)  
✅ Doctrine Rules: One place only (psa_engine)  
✅ psa-rebuild consumes doctrine, never redefines it  
✅ UI workflows are authoritative in psa-rebuild  
✅ Presentation logic is authoritative in psa-rebuild  
✅ No coverage computation in psa-rebuild  
✅ No ingestion logic in psa-rebuild  
✅ Artifacts are deletable  
✅ No folder mixes authority types  
✅ No document redefines truth from another project  

---

## Next Steps

1. Establish sync process for doctrine references (psa-rebuild syncs from psa_engine)
2. Update code paths if needed (if any hardcoded paths exist)

---

**See `docs/AUTHORITY.md` for full authority boundaries.**  
**See `REORGANIZATION_SUMMARY.md` for reorganization details.**

