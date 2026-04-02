# Governance OFC Approval Database Schema

**Date:** 2025-12-21  
**Purpose:** Database schema for Governance OFC Approval API  
**Location:** psa-backend migrations

---

## Overview

This schema supports the Governance OFC Approval workflow where GOVERNING_BODY role can:
- Review submitted OFCs
- Approve/reject OFCs
- Request revisions (send back to draft)
- Retire approved OFCs
- View OFC history/audit trail

---

## Tables

### 1. `ofcs` (Governance OFC Table)

```sql
CREATE TABLE IF NOT EXISTS public.ofcs (
    ofc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ofc_root_id UUID NOT NULL,  -- Groups versions of the same OFC
    version INTEGER NOT NULL DEFAULT 1,
    
    -- OFC Content
    ofc_text TEXT NOT NULL,
    rationale TEXT NOT NULL,
    context_conditions TEXT,
    
    -- Status and Workflow
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED', 'SUPERSEDED')),
    
    -- Submission Metadata
    submitted_by UUID,  -- User ID who submitted
    submitted_at TIMESTAMPTZ,
    
    -- Approval Metadata
    approved_by UUID,  -- User ID who approved
    approved_at TIMESTAMPTZ,
    
    -- Decision Metadata
    decision_reason TEXT,  -- Required for REJECTED, RETIRED, and revision requests
    
    -- Supersession
    supersedes_ofc_id UUID REFERENCES public.ofcs(ofc_id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    UNIQUE (ofc_root_id, version),
    CHECK (
        (status IN ('SUBMITTED', 'UNDER_REVIEW') AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL) OR
        (status NOT IN ('SUBMITTED', 'UNDER_REVIEW'))
    ),
    CHECK (
        (status = 'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
        (status != 'APPROVED')
    ),
    CHECK (
        (status IN ('REJECTED', 'RETIRED') AND decision_reason IS NOT NULL) OR
        (status NOT IN ('REJECTED', 'RETIRED'))
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ofcs_ofc_root_id ON public.ofcs(ofc_root_id);
CREATE INDEX IF NOT EXISTS idx_ofcs_status ON public.ofcs(status);
CREATE INDEX IF NOT EXISTS idx_ofcs_submitted_at ON public.ofcs(submitted_at);
CREATE INDEX IF NOT EXISTS idx_ofcs_supersedes_ofc_id ON public.ofcs(supersedes_ofc_id);
```

### 2. `ofc_state_transitions` (Audit Trail)

```sql
CREATE TABLE IF NOT EXISTS public.ofc_state_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ofc_id UUID NOT NULL REFERENCES public.ofcs(ofc_id) ON DELETE CASCADE,
    
    -- Transition Details
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    transitioned_by UUID NOT NULL,  -- User ID
    transitioned_at TIMESTAMPTZ DEFAULT now(),
    
    -- Optional Notes
    notes TEXT,
    decision_reason TEXT,  -- For rejections, retirements, revision requests
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ofc_state_transitions_ofc_id ON public.ofc_state_transitions(ofc_id);
CREATE INDEX IF NOT EXISTS idx_ofc_state_transitions_transitioned_at ON public.ofc_state_transitions(transitioned_at);
```

### 3. `users` (Reference - Assumed to Exist)

```sql
-- Assumes users table exists with:
-- user_id UUID PRIMARY KEY
-- role TEXT (values: 'PSA', 'GOVERNING_BODY', 'ENGINEERING', etc.)
```

---

## Status Flow

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED
                              ↓
                          REJECTED
                              ↓
                          DRAFT (revision request)

APPROVED → RETIRED
APPROVED → SUPERSEDED (when new version approved)
```

### Valid Transitions

| From Status | To Status | Trigger | Notes |
|-------------|-----------|---------|-------|
| DRAFT | SUBMITTED | User submission | Sets submitted_by, submitted_at |
| SUBMITTED | UNDER_REVIEW | begin-review | Idempotent if already UNDER_REVIEW |
| UNDER_REVIEW | APPROVED | approve | Sets approved_by, approved_at |
| UNDER_REVIEW | REJECTED | reject | Requires decision_reason |
| UNDER_REVIEW | DRAFT | request-revision | Requires decision_reason |
| SUBMITTED | APPROVED | approve | Direct approval (skips review) |
| SUBMITTED | REJECTED | reject | Requires decision_reason |
| SUBMITTED | DRAFT | request-revision | Requires decision_reason |
| APPROVED | RETIRED | retire | Requires decision_reason |
| APPROVED | SUPERSEDED | approve (new version) | Automatic when supersedes_ofc_id set |

---

## Constraints and Rules

### 1. No Deletes
- No DELETE operations on `ofcs` table
- Status transitions only (including RETIRED)

### 2. No Edit-in-Place
- Approved OFCs cannot be edited
- Changes require new version (new row with same ofc_root_id, incremented version)

### 3. Supersession
- When approving an OFC with `supersedes_ofc_id`:
  - Validate superseded OFC exists and is APPROVED
  - Transition superseded OFC: APPROVED → SUPERSEDED
  - Record audit transition

### 4. Decision Reasons
- Required for: REJECTED, RETIRED, revision requests (DRAFT from UNDER_REVIEW/SUBMITTED)
- Optional for: APPROVED (can include notes)

### 5. Audit Trail
- Every status transition must insert into `ofc_state_transitions`
- Includes: from_status, to_status, transitioned_by, transitioned_at, notes/decision_reason

---

## Migration Script

```sql
-- Migration: Add Governance OFC Approval Tables
-- Date: 2025-12-21

BEGIN;

-- Create ofcs table
CREATE TABLE IF NOT EXISTS public.ofcs (
    ofc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ofc_root_id UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    ofc_text TEXT NOT NULL,
    rationale TEXT NOT NULL,
    context_conditions TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED', 'SUPERSEDED')),
    submitted_by UUID,
    submitted_at TIMESTAMPTZ,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    decision_reason TEXT,
    supersedes_ofc_id UUID REFERENCES public.ofcs(ofc_id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (ofc_root_id, version),
    CHECK (
        (status IN ('SUBMITTED', 'UNDER_REVIEW') AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL) OR
        (status NOT IN ('SUBMITTED', 'UNDER_REVIEW'))
    ),
    CHECK (
        (status = 'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
        (status != 'APPROVED')
    ),
    CHECK (
        (status IN ('REJECTED', 'RETIRED') AND decision_reason IS NOT NULL) OR
        (status NOT IN ('REJECTED', 'RETIRED'))
    )
);

CREATE INDEX IF NOT EXISTS idx_ofcs_ofc_root_id ON public.ofcs(ofc_root_id);
CREATE INDEX IF NOT EXISTS idx_ofcs_status ON public.ofcs(status);
CREATE INDEX IF NOT EXISTS idx_ofcs_submitted_at ON public.ofcs(submitted_at);
CREATE INDEX IF NOT EXISTS idx_ofcs_supersedes_ofc_id ON public.ofcs(supersedes_ofc_id);

-- Create ofc_state_transitions table
CREATE TABLE IF NOT EXISTS public.ofc_state_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ofc_id UUID NOT NULL REFERENCES public.ofcs(ofc_id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    transitioned_by UUID NOT NULL,
    transitioned_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    decision_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ofc_state_transitions_ofc_id ON public.ofc_state_transitions(ofc_id);
CREATE INDEX IF NOT EXISTS idx_ofc_state_transitions_transitioned_at ON public.ofc_state_transitions(transitioned_at);

COMMIT;
```

---

## Example Data

### Creating an OFC

```sql
-- Initial OFC (DRAFT)
INSERT INTO public.ofcs (ofc_root_id, version, ofc_text, rationale, status)
VALUES (
    gen_random_uuid(),  -- ofc_root_id
    1,                  -- version
    'Implement multi-factor authentication for all remote access systems.',
    'This addresses the baseline requirement for secure remote access.',
    'DRAFT'
);
```

### Submitting for Review

```sql
-- Transition to SUBMITTED
UPDATE public.ofcs
SET status = 'SUBMITTED',
    submitted_by = 'user-uuid-here',
    submitted_at = now(),
    updated_at = now()
WHERE ofc_id = 'ofc-uuid-here';

-- Record audit
INSERT INTO public.ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by)
VALUES ('ofc-uuid-here', 'DRAFT', 'SUBMITTED', 'user-uuid-here');
```

### Approving an OFC

```sql
-- Transition to APPROVED
UPDATE public.ofcs
SET status = 'APPROVED',
    approved_by = 'governing-body-user-uuid',
    approved_at = now(),
    updated_at = now()
WHERE ofc_id = 'ofc-uuid-here';

-- Record audit
INSERT INTO public.ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by, notes)
VALUES ('ofc-uuid-here', 'UNDER_REVIEW', 'APPROVED', 'governing-body-user-uuid', 'Approved for use');
```

---

**END OF SCHEMA SPECIFICATION**

