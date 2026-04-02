# VSS — REWRITE_TO_CONTROL_ASSERTION

Generated: 2026-01-15T16:57:36.874164Z
Count: 3

## 1. BASE-380 | VSS_EXTERIOR_CAMERAS | SYSTEMS | REWRITE_TO_CONTROL_ASSERTION

**Question text**

Do cameras cover exterior areas where video monitoring is needed for security?

**Analyzer notes**

Template available for rewrite

**Lint**

- ok: True

**Reviewer decision**

- Baseline spine candidate? (YES/NO)
- Boundary statement (if YES):
- If NO: DROP or COMPONENT?

## 2. BASE-392 | VSS_INTERIOR_CAMERAS | SYSTEMS | REWRITE_TO_CONTROL_ASSERTION

**Question text**

Do cameras cover interior areas where video monitoring is needed for security?

**Analyzer notes**

Template available for rewrite

**Lint**

- ok: True

**Reviewer decision**

- Baseline spine candidate? (YES/NO)
- Boundary statement (if YES):
- If NO: DROP or COMPONENT?

## 3. BASE-404 | VSS_RECORDING_STORAGE_NVR_DVR | SYSTEMS | REWRITE_TO_CONTROL_ASSERTION

**Question text**

Is video recorded from cameras that cover areas monitored for security?

**Analyzer notes**

Unanchored question; rewritten with boundary anchor

**Reason codes**

UNANCHORED_NO_BOUNDARY

**Lint**

- ok: True

**Reviewer decision**

- Baseline spine candidate? (YES/NO)
- Boundary statement (if YES):
- If NO: DROP or COMPONENT?
