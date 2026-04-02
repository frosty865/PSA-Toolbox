# PSA Module Import Guide

This guide explains how to create module import JSON files for the PSA system.

## Overview

Modules are **additive content bundles** that extend the baseline PSA assessment with technology-specific or situation-specific questions and recommendations. Modules are completely independent of baseline content.

## Key Principles

1. **Modules are additive**: Module questions and OFCs are NOT baseline. They are stored in module-owned tables and displayed only when the module is attached to an assessment.

2. **No baseline references**: Module content must NOT link to baseline question IDs (`BASE-*`) or baseline OFCs.

3. **Technology/situation dependent**: Module questions must be specific to a technology or situation, not generic "supports physical security" phrasing.

4. **PSA scope only**: Module content must focus on physical security. Cyber controls (encryption, 2FA, authentication) do NOT become module questions or OFCs—they are stored as risk drivers (context only).

## File Structure

See `docs/MODULE_IMPORT_TEMPLATE.json` for a complete template with inline documentation.

### Required Fields

```json
{
  "module_code": "MODULE_EXAMPLE",
  "title": "Example Module Title",
  "module_questions": [],
  "module_ofcs": []
}
```

### Optional Fields

- `description`: Human-readable description of the module
- `import_source`: Source file or system identifier
- `mode`: `"REPLACE"` (default) or `"APPEND"`
- `risk_drivers`: Array of cyber/fraud risk context

## Module Questions

### Requirements

1. **Question ID**: Must follow pattern `MODULEQ_<MODULE_CODE>_###` (e.g., `MODULEQ_EV_CHARGING_001`)
2. **Question Text**: Must be non-generic, technology/situation specific
3. **Discipline/Subtype**: Must match semantic content (validated automatically)
4. **Event Trigger**: Must match semantic content (validated automatically)
5. **Asset/Location**: Required, non-empty string

### Getting Discipline/Subtype UUIDs

Run the helper script to get valid UUIDs:

```bash
node scripts/get_discipline_uuids_for_modules.js
```

This will output discipline and subtype UUIDs that you can use in your import JSON.

### Discipline Assignment Rules

The system validates that questions are assigned to appropriate disciplines based on semantic keywords:

- **Lighting questions** → Cannot be VSS (Video Surveillance). Should use CPTED/Exterior Lighting subtypes.
- **Camera/video questions** → Must be VSS (Video Surveillance Systems)
- **Panic/assistance questions** → Must be EMR (Emergency Management & Resilience)
- **Procedure/coordination questions** → Must be SMG (Security Management & Governance)
- **Access questions** → Must be ACS (Access Control Systems)

### Event Trigger Rules

- **TAMPERING**: Required for access, inspection, hardware, lighting/visibility questions
- **OTHER**: Required for panic, duress, assistance, emergency questions
- **OUTAGE**: Required for recovery, restoration, continuity questions
- **FIRE**: For fire-related questions
- **IMPACT**: For impact-related questions

### Example Question

```json
{
  "id": "MODULEQ_EV_CHARGING_001",
  "text": "Is physical access to EV charging equipment components (e.g., enclosures, service panels, cabinets) restricted to authorized personnel?",
  "order": 1,
  "discipline_id": "18d45ffa-6a44-4817-becb-828231b9e1e7",
  "discipline_subtype_id": "3227ab36-7f31-4be4-a0c2-0f838518fa96",
  "asset_or_location": "EV charging equipment components",
  "event_trigger": "TAMPERING"
}
```

## Module OFCs

### Requirements

1. **OFC ID**: Must follow pattern `MOD_OFC_<MODULE_CODE>_###` (e.g., `MOD_OFC_EV_CHARGING_001`)
2. **OFC Text**: Must be physical security focused (no cyber controls)
3. **Sources**: Optional but recommended for traceability

### OFC Text Rules

- Must describe physical security measures
- Cyber controls (encryption, 2FA, authentication, network monitoring) are NOT allowed
- Should be specific and actionable

### Example OFC

```json
{
  "ofc_id": "MOD_OFC_EV_CHARGING_001",
  "ofc_text": "Consider implementing adequate lighting at EV charging station locations to reduce opportunities for vandalism and theft and to support visibility during hours of darkness.",
  "order_index": 1,
  "sources": [
    {
      "url": "",
      "label": "Improving Public EV Charger Locations — GreenTech (March 12, 2025)"
    }
  ]
}
```

## Risk Drivers

Risk drivers provide context about cyber/fraud vulnerabilities that may impact physical security. They are **read-only context** and never become questions or OFCs.

### Requirements

1. **Driver Type**: Either `"CYBER_DRIVER"` or `"FRAUD_DRIVER"`
2. **Driver Text**: Must describe a single initiating cause with physical-security impact
3. **One per vulnerability**: Only one driver per vulnerability per type is allowed

### Validation Rules

- No duplication (same driver text for same type)
- No garbage concatenation (lists of options, repeated phrases)
- Must be a complete sentence describing a single cause

### Example Risk Drivers

```json
{
  "risk_drivers": [
    {
      "driver_type": "CYBER_DRIVER",
      "driver_text": "Unauthorized access to EV charging systems may enable physical tampering or unsafe conditions at charging stations."
    },
    {
      "driver_type": "FRAUD_DRIVER",
      "driver_text": "Payment skimming or data theft at EV charging stations may increase criminal targeting of charging locations and associated users."
    }
  ]
}
```

## Import Process

1. **Create module metadata** (optional): Use Admin UI or API to create module with `DRAFT` status
2. **Prepare JSON file**: Use the template and fill in all required fields
3. **Validate locally** (optional): Check JSON syntax and structure
4. **Import via Admin UI**: Navigate to `/admin/modules/import` and upload your JSON file
5. **Review errors**: If validation fails, fix errors and re-import

## Validation Errors

The import system performs multiple validation checks:

1. **Structural validation**: Required fields, correct types, valid IDs
2. **Discipline ownership validation**: Questions assigned to correct disciplines/subtypes
3. **Event trigger validation**: Event triggers match question semantics
4. **Risk driver validation**: No duplicates, no garbage concatenation

All validation errors are displayed in the import UI with specific error messages indicating what needs to be fixed.

## Common Mistakes

1. **Using baseline question IDs**: Module questions must use `MODULEQ_*` IDs, not `BASE-*`
2. **Generic question text**: Questions must be specific and technology/situation dependent
3. **Wrong discipline assignment**: Lighting questions assigned to VSS, panic questions assigned to wrong discipline
4. **Cyber controls in OFCs**: OFCs must be physical security only
5. **Duplicate risk drivers**: Only one driver per vulnerability per type
6. **Missing required fields**: All question fields (discipline_id, subtype_id, asset_or_location, event_trigger) are required

## Example: Complete Module Import

See `analytics/extracted/module_ev_charging_import.json` for a complete, working example of a module import file.

## Getting Help

- Review validation errors carefully—they indicate exactly what needs to be fixed
- Use `scripts/get_discipline_uuids_for_modules.js` to get valid discipline/subtype UUIDs
- Check existing modules for examples of correct structure
- Refer to `docs/MODULE_IMPORT_TEMPLATE.json` for field-by-field documentation
