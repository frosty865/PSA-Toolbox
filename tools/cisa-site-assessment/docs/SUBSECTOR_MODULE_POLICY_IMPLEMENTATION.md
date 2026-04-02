# Subsector-Driven Module Auto-Attachment Implementation

**Date:** 2026-01-21  
**Status:** ✅ **COMPLETE**

## Overview

Implemented subsector-driven module auto-attachment with DEFAULT_ON and REQUIRED modes, plus a locked removal guard. Modules are now automatically attached to assessments based on subsector policy, with REQUIRED modules locked from removal.

## Database Schema

### Migration Files

1. **`db/migrations/20260121_subsector_module_policy_and_instance_locking.sql`**
   - Creates `subsector_module_policy` table
   - Extends `assessment_module_instances` with `is_locked` and `attached_via` columns

2. **`db/migrations/20260121_seed_subsector_module_policy_examples.sql`**
   - Example seed data (lookup-based, no hardcoded UUIDs)

### Tables

#### `subsector_module_policy`
- `id` (UUID, PK)
- `subsector_id` (TEXT, FK to `subsectors.id`)
- `module_code` (TEXT, FK to `assessment_modules.module_code`)
- `attach_mode` (TEXT, CHECK: 'DEFAULT_ON' | 'REQUIRED')
- `created_at` (TIMESTAMPTZ)

#### `assessment_module_instances` (extended)
- `is_locked` (BOOLEAN, default: false)
- `attached_via` (TEXT, CHECK: 'USER' | 'SUBSECTOR_DEFAULT' | 'SUBSECTOR_REQUIRED')

## API Endpoints

### Module Reconciliation
- **`POST /api/runtime/assessments/[assessmentId]/modules/reconcile`**
  - Reconciles modules based on subsector policy
  - Auto-attaches DEFAULT_ON and REQUIRED modules

### Subsector Update
- **`PUT /api/runtime/assessments/[assessmentId]/subsector`**
  - Updates assessment subsector
  - Automatically triggers module reconciliation

### Module Management (Updated)
- **`GET /api/runtime/assessments/[assessmentId]/modules`**
  - Returns modules with `is_locked` and `attached_via` fields
  - Ordered by attachment type (REQUIRED first, then DEFAULT, then USER)

- **`DELETE /api/runtime/assessments/[assessmentId]/modules?module_code=XXX`**
  - Blocks removal of locked modules (409 error)
  - Allows removal of non-locked modules

## Runtime Library

### `app/lib/runtime/reconcile_modules.ts`
- `reconcileModulesForAssessment()` function
- Automatically attaches modules based on subsector policy
- Does NOT remove user-selected modules
- Returns counts of attached/updated modules

## Integration Points

### Assessment Creation
- **`app/api/runtime/assessments/route.ts`**
  - After assessment creation, calls `reconcileModulesForAssessment()`
  - User-selected modules are added after reconciliation (take precedence)

### Assessment Update
- Subsector changes trigger automatic reconciliation
- Modules are re-attached based on new subsector policy

## UI Components

### `app/components/AssessmentModuleList.tsx`
- Displays modules in 3 groups:
  1. **Required Modules** (SUBSECTOR_REQUIRED) - Locked, cannot remove
  2. **Included Modules** (SUBSECTOR_DEFAULT) - Can be removed
  3. **Optional Modules** (USER) - Can be added/removed
- Shows badges for attachment type
- Disables removal for locked modules

## Key Features

✅ **Subsector-driven auto-attachment**
- DEFAULT_ON: Auto-attached but removable
- REQUIRED: Auto-attached and locked

✅ **Locked removal guard**
- REQUIRED modules cannot be removed (409 error)
- User-selected modules can always be removed

✅ **Non-destructive**
- Removing a module does NOT delete assessment responses
- Only removes the module instance link

✅ **Baseline untouched**
- No changes to `baseline_spines_runtime`
- No changes to baseline question sources

✅ **PSA scope only**
- No SAFE references
- Physical security scope only

✅ **No convergence logic**
- Modules are independent
- No cross-module dependencies

## Usage

### 1. Run Migrations
```sql
-- Apply main migration
\i db/migrations/20260121_subsector_module_policy_and_instance_locking.sql

-- Apply seed (optional)
\i db/migrations/20260121_seed_subsector_module_policy_examples.sql
```

### 2. Create Policy Rules
```sql
-- Attach module as REQUIRED for a subsector
INSERT INTO public.subsector_module_policy (subsector_id, module_code, attach_mode)
VALUES ('subsector_code', 'MODULE_XXX', 'REQUIRED');

-- Attach module as DEFAULT_ON for a subsector
INSERT INTO public.subsector_module_policy (subsector_id, module_code, attach_mode)
VALUES ('subsector_code', 'MODULE_XXX', 'DEFAULT_ON');
```

### 3. Assessment Creation
- When creating an assessment with a subsector, modules are automatically attached
- REQUIRED modules are locked
- DEFAULT_ON modules can be removed if needed

### 4. Subsector Changes
- Updating assessment subsector triggers reconciliation
- New policy rules are applied automatically
- Existing user-selected modules are preserved

## QA Checklist

- ✅ Migration applies cleanly
- ✅ Creating assessment with subsector auto-attaches modules
- ✅ Updating subsector triggers reconciliation
- ✅ Locked modules cannot be removed (409 error)
- ✅ Optional modules can be removed
- ✅ No baseline tables/routes modified
- ✅ No SAFE references introduced
- ✅ Module removal does not delete responses

## Notes

- Module policy uses TEXT `subsector_id` (matches `subsectors.id`)
- Module policy uses TEXT `module_code` (matches `assessment_modules.module_code`)
- UUID/TEXT conversion handled automatically in reconcile function
- User-selected modules take precedence over DEFAULT_ON (but not REQUIRED)
