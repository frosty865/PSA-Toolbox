# Module Attributes Removal

## Overview

Module attributes have been completely removed from the doctrine system. Criteria applicability is now determined **solely by the Standard definition**, not by user-selected attributes.

## What Was Removed

### 1. UI Components
- **Attributes Panel**: Removed the entire "Attributes" section from the Standard tab
- **Attribute Form State**: Removed `attributesForm` state and all related form controls
- **Attribute Prompts**: Removed all attribute-related UI text and prompts

### 2. State Management
- Removed `attributesForm` state variable
- Removed `standardDetail.attributes` from state type
- Removed attribute initialization logic when loading standards

### 3. API Changes

#### `/api/admin/modules/[moduleCode]/standard/generate`
- **Before**: Required `attributes` in request body, validated against `module_standard_attributes`
- **After**: No `attributes` parameter; all criteria default to `APPLIES`
- Removed attribute validation logic
- Removed attribute-based applicability computation
- `attributes_json` column now stores empty JSON `{}`

#### `/api/admin/module-standards/[standardKey]`
- **Before**: Returned `attributes` array for building attribute forms
- **After**: Returns only `standard` object (no attributes)

### 4. Applicability Logic
- **Before**: `applyApplicabilityRule(attributes, rule)` computed applicability based on attributes
- **After**: All criteria default to `APPLIES` regardless of `applicability_rule`
- `applyApplicabilityRule` function still exists but is no longer called

### 5. Database
- `module_instances.attributes_json` column still exists but is always set to `{}`
- `module_standard_attributes` table still exists in CORPUS (for historical data)
- No migration needed - attributes are simply ignored

## Guard Script

**File**: `scripts/guards/verifyNoModuleAttributes.js`

Prevents reintroduction of attribute-related code by checking for forbidden terms:
- `HAS_CHARGING`, `DC_FAST`, `INDOOR_GARAGE`, `UNDERGROUND`, `CAPACITY_LEVEL`
- Attribute prompt text patterns

**Usage**:
```bash
npm run guard:no-module-attributes
```

## Rationale

Attributes were removed because they:
1. **Leaked engineering/scenario context** into doctrine
2. **Created conditional logic** that made standards brittle
3. **Produced off-topic outputs** when attributes didn't match facility reality
4. **Violated doctrine-first principle** - standards should define truth, not be conditional

## Result

EV_PARKING (and all modules) are now **clean doctrine instances**:
- ✅ Standard defines truth (all criteria apply)
- ✅ Facility answers existence questions
- ✅ PSAs discuss nuance off-system
- ✅ Automation stops hallucinating based on hidden flags
- ✅ OFCs remain 1:1 with criteria (no conditional generation)

## Files Modified

1. `app/admin/modules/[moduleCode]/page.tsx` - Removed Attributes UI
2. `app/api/admin/modules/[moduleCode]/standard/generate/route.ts` - Removed attribute handling
3. `app/api/admin/module-standards/[standardKey]/route.ts` - Removed attributes from response
4. `scripts/guards/verifyNoModuleAttributes.js` - Created guard script
5. `package.json` - Added guard script to npm scripts

## Verification

Run the guard to verify no attributes remain:
```bash
npm run guard:no-module-attributes
```

Expected output:
```
[OK][NO_MODULE_ATTRIBUTES] No module attributes detected in app/ directory.
```
