# Hard Guards Database Constraints

**Date:** 2025-12-21  
**Purpose:** Database-level constraints to enforce hard guards  
**Location:** psa-backend migrations

---

## Overview

Database constraints provide the final layer of defense against violations. Even if application code has bugs, database constraints prevent violations.

---

## 1. DELETE Permission Revocation

```sql
-- Migration: Revoke DELETE permission on ofcs table
-- Date: 2025-12-21

BEGIN;

-- Revoke DELETE from all application roles
REVOKE DELETE ON TABLE ofcs FROM PUBLIC;
REVOKE DELETE ON TABLE ofcs FROM app_role;
REVOKE DELETE ON TABLE ofcs FROM admin_role;
REVOKE DELETE ON TABLE ofcs FROM psa_role;
REVOKE DELETE ON TABLE ofcs FROM governing_body_role;

-- Also revoke from ofc_state_transitions
REVOKE DELETE ON TABLE ofc_state_transitions FROM PUBLIC;
REVOKE DELETE ON TABLE ofc_state_transitions FROM app_role;
REVOKE DELETE ON TABLE ofc_state_transitions FROM admin_role;
REVOKE DELETE ON TABLE ofc_state_transitions FROM psa_role;
REVOKE DELETE ON TABLE ofc_state_transitions FROM governing_body_role;

-- Verify permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'ofcs'
    AND privilege_type = 'DELETE';

-- Should return no rows (except for superuser/system roles)

COMMIT;
```

---

## 2. Prevent Approved OFC Content Updates

```sql
-- Migration: Trigger to prevent approved OFC content updates
-- Date: 2025-12-21

BEGIN;

CREATE OR REPLACE FUNCTION prevent_approved_ofc_content_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is APPROVED, only allow status changes
    IF OLD.status = 'APPROVED' THEN
        -- Allow status transitions only
        IF NEW.status != OLD.status THEN
            -- Status change allowed (e.g., APPROVED → RETIRED, APPROVED → SUPERSEDED)
            RETURN NEW;
        END IF;
        
        -- Block content changes (text, rationale, context)
        IF NEW.ofc_text != OLD.ofc_text OR
           NEW.rationale != OLD.rationale OR
           NEW.context_conditions IS DISTINCT FROM OLD.context_conditions THEN
            RAISE EXCEPTION 'Cannot modify approved OFC content. Status: %. Create new version instead.', OLD.status;
        END IF;
        
        -- Allow metadata updates (updated_at, etc.)
        RETURN NEW;
    END IF;
    
    -- For non-approved OFCs, allow updates
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS ofc_approved_content_guard ON ofcs;

-- Create trigger
CREATE TRIGGER ofc_approved_content_guard
    BEFORE UPDATE ON ofcs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_approved_ofc_content_updates();

COMMIT;
```

---

## 3. State Transition Validation (Database Level)

```sql
-- Migration: Add check constraint for state transitions
-- Date: 2025-12-21

BEGIN;

-- Note: PostgreSQL CHECK constraints cannot reference other rows,
-- so we use a trigger for complex validation

CREATE OR REPLACE FUNCTION validate_ofc_state_transition()
RETURNS TRIGGER AS $$
DECLARE
    allowed_transitions TEXT[];
BEGIN
    -- Define allowed transitions
    CASE OLD.status
        WHEN 'DRAFT' THEN
            allowed_transitions := ARRAY['SUBMITTED'];
        WHEN 'SUBMITTED' THEN
            allowed_transitions := ARRAY['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'];
        WHEN 'UNDER_REVIEW' THEN
            allowed_transitions := ARRAY['APPROVED', 'REJECTED', 'DRAFT'];
        WHEN 'APPROVED' THEN
            allowed_transitions := ARRAY['SUPERSEDED', 'RETIRED'];
        WHEN 'REJECTED' THEN
            allowed_transitions := ARRAY[];  -- Terminal state
        WHEN 'RETIRED' THEN
            allowed_transitions := ARRAY[];  -- Terminal state
        WHEN 'SUPERSEDED' THEN
            allowed_transitions := ARRAY[];  -- Terminal state
        ELSE
            allowed_transitions := ARRAY[];
    END CASE;
    
    -- Check if transition is allowed
    IF NEW.status != OLD.status AND NOT (NEW.status = ANY(allowed_transitions)) THEN
        RAISE EXCEPTION 'Invalid state transition: % → %. Allowed transitions from %: %',
            OLD.status, NEW.status, OLD.status, array_to_string(allowed_transitions, ', ');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS ofc_state_transition_guard ON ofcs;

-- Create trigger
CREATE TRIGGER ofc_state_transition_guard
    BEFORE UPDATE ON ofcs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_ofc_state_transition();

COMMIT;
```

---

## 4. Decision Reason Required (Already in Schema)

The schema already enforces this via CHECK constraint:

```sql
-- From GOVERNANCE_OFC_APPROVAL_SCHEMA.md
CHECK (
    (status IN ('REJECTED', 'RETIRED') AND decision_reason IS NOT NULL) OR
    (status NOT IN ('REJECTED', 'RETIRED'))
)
```

**Verification:**
```sql
-- Test that constraint works
BEGIN;
    INSERT INTO ofcs (ofc_root_id, version, ofc_text, rationale, status)
    VALUES (gen_random_uuid(), 1, 'Test', 'Test', 'RETIRED');
    -- Should fail: decision_reason required for RETIRED
ROLLBACK;
```

---

## 5. Audit Trail Immutability

```sql
-- Migration: Prevent updates/deletes to audit trail
-- Date: 2025-12-21

BEGIN;

-- Revoke UPDATE and DELETE on ofc_state_transitions
REVOKE UPDATE ON TABLE ofc_state_transitions FROM PUBLIC;
REVOKE UPDATE ON TABLE ofc_state_transitions FROM app_role;
REVOKE UPDATE ON TABLE ofc_state_transitions FROM admin_role;
REVOKE UPDATE ON TABLE ofc_state_transitions FROM psa_role;
REVOKE UPDATE ON TABLE ofc_state_transitions FROM governing_body_role;

REVOKE DELETE ON TABLE ofc_state_transitions FROM PUBLIC;
REVOKE DELETE ON TABLE ofc_state_transitions FROM app_role;
REVOKE DELETE ON TABLE ofc_state_transitions FROM admin_role;
REVOKE DELETE ON TABLE ofc_state_transitions FROM psa_role;
REVOKE DELETE ON TABLE ofc_state_transitions FROM governing_body_role;

-- Only INSERT allowed (for recording transitions)
-- UPDATE and DELETE are forbidden

COMMIT;
```

---

## Verification Queries

### Verify DELETE Permission Revoked
```sql
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'ofcs'
    AND privilege_type = 'DELETE';
-- Should return no rows (except superuser)
```

### Verify Trigger Exists
```sql
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'ofcs'
    AND trigger_name IN (
        'ofc_approved_content_guard',
        'ofc_state_transition_guard'
    );
-- Should return 2 rows
```

### Test Approved Content Update Block
```sql
-- This should fail
BEGIN;
    UPDATE ofcs
    SET ofc_text = 'Modified'
    WHERE ofc_id = (SELECT ofc_id FROM ofcs WHERE status = 'APPROVED' LIMIT 1);
    -- Should raise exception
ROLLBACK;
```

### Test Invalid State Transition Block
```sql
-- This should fail
BEGIN;
    UPDATE ofcs
    SET status = 'APPROVED'
    WHERE ofc_id = (SELECT ofc_id FROM ofcs WHERE status = 'DRAFT' LIMIT 1);
    -- Should raise exception (DRAFT → APPROVED not allowed)
ROLLBACK;
```

---

## Migration Order

1. **First:** Revoke DELETE permissions
2. **Second:** Create approved content guard trigger
3. **Third:** Create state transition guard trigger
4. **Fourth:** Revoke UPDATE/DELETE on audit table
5. **Fifth:** Run verification queries

---

## Rollback

If migration needs to be rolled back:

```sql
BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS ofc_approved_content_guard ON ofcs;
DROP TRIGGER IF EXISTS ofc_state_transition_guard ON ofcs;

-- Drop functions
DROP FUNCTION IF EXISTS prevent_approved_ofc_content_updates();
DROP FUNCTION IF EXISTS validate_ofc_state_transition();

-- Restore permissions (if needed)
-- GRANT DELETE ON TABLE ofcs TO app_role;
-- GRANT UPDATE ON TABLE ofc_state_transitions TO app_role;

COMMIT;
```

---

**END OF DATABASE CONSTRAINTS**

