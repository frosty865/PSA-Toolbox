# ACS — REWRITE_TO_CONTROL_ASSERTION

Generated: 2026-01-15T16:17:32.868312Z
Count: 2

## 1. BASE-000 | ACS_BIOMETRIC_ACCESS | SYSTEMS | REWRITE_TO_CONTROL_ASSERTION

**Question text**

Are biometric identity verification decisions made at controlled entry points before access is granted?

**Analyzer notes**

Template available for rewrite

**Lint**

- ok: True

**Reviewer decision**

- Baseline spine candidate? (YES/NO)
- Boundary statement (if YES):
- If NO: DROP or COMPONENT?

## 2. BASE-004 | ACS_CREDENTIAL_BADGE_SYSTEMS | SYSTEMS | REWRITE_TO_CONTROL_ASSERTION

**Question text**

Are access credential decisions made at controlled entry points based on presented credentials?

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
