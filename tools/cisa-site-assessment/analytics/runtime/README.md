# Analytics Runtime - Baseline Questions Registry

## AUTHORITATIVE, FROZEN

**Status:** Frozen (versioned_only)  
**Change Policy:** Versioned changes only  
**Do not modify directly**

This file is the authoritative source for baseline questions. It is frozen and can only be changed through versioning.

### File
- `baseline_questions_registry.json` - Complete registry of all baseline questions

### Metadata
- **Version:** Baseline_Questions_v1
- **Status:** frozen
- **Frozen At:** 2025-01-27T00:00:00.000Z
- **Total Questions:** 416
- **Subtype Count:** 104

### Change Policy
- **Versioned Only:** Changes must create new versions
- **No Direct Edits:** Do not modify this file directly
- **Validation Required:** All changes must pass `validate_baseline_publish_ready.py`

### Validation
Run `tools/validate_baseline_publish_ready.py` before any changes:
- Validates subtype codes
- Validates question references
- Checks for placeholder language
- Validates response enums (YES/NO/N_A only)
- Verifies question count (416 expected)

