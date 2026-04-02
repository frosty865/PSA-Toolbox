# Standard Text Validation

## Overview

Module standards (doctrine) must describe **WHAT capability should exist** (PSA-scope), not **HOW to implement** or what codes require. Standards that include regulatory/compliance/implementation language violate this doctrine and produce brittle, off-topic outputs.

## Forbidden Terms

The following terms are forbidden in standard criteria questions and OFC templates:

### Regulatory / Code Audit Language
- `code`, `codes`, `compliance`
- `ahj`, `authority having jurisdiction`
- `nfpa`, `ul`, `nec`, `iecc`, `ibc`, `ifc`, `osha`

### Manufacturer / Vendor Dependency
- `manufacturer`, `vendor`, `model number`, `sku`

### Overly Prescriptive Tech Terms
- `sprinkler`, `specific system`, `dc fast charging`
- `de-energize`, `fire-rated construction`
- `per local requirements`, `per applicable`
- `in accordance with`, `as required by`

## Validation

### Guard Script

Before running standard seed SQL files, validate them:

```bash
npm run guard:standard-seed db/seeds/corpus/EV_PARKING_standard_seed.sql
```

This will check all `question_text` and `ofc_text_template` values for forbidden terms.

### Programmatic Validation

Use the validator in code:

```typescript
import { validateStandardText } from "@/app/lib/modules/standard_text_validation";

const errors = validateStandardText("criteria.EVP_001.question", questionText);
if (errors.length > 0) {
  // Handle validation errors
}
```

## EV_PARKING vv1.1 Refactor

The EV_PARKING standard was refactored from vv1 to vv1.1 to remove all regulatory/compliance language:

- **Before**: "Is fire suppression (e.g. sprinklers, specific system) provided for the EV area per local requirements?"
- **After**: "Is there an established capability to control or suppress an EV-related fire condition in EV parking/charging areas prior to responder arrival?"

All 12 criteria and 12 OFCs were rewritten to be capability-level, PSA-scope.

## Migration

Run the migration to update existing EV_PARKING standard in the database:

```bash
npx tsx tools/run_sql.ts db/migrations/corpus/20260126_1300_update_ev_parking_standard_v1_1.sql
```

## Future: UI Validation

If a UI for editing standards is added, validation should be enforced on the save endpoint to prevent forbidden terms from entering the database.
