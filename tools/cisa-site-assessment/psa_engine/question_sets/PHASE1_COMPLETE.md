# PHASE 1: Baseline CORE + Modules Structure - COMPLETE

**Date**: 2026-01-14  
**Status**: ✅ COMPLETE

## Deliverables

### Question Set Indexes
```
psa_engine/question_sets/
├── BASELINE_CORE.index.json    ✅ Created (30 questions, 8 groups)
├── MODULE.index.json            ✅ Created (5 modules)
├── SECTOR.index.json            ✅ Created (empty, reserved)
├── SUBSECTOR.index.json         ✅ Created (empty, reserved)
└── README.md                    ✅ Created
```

### Database Schema
- **File**: `migrations/2026_01_14_baseline_core_modules.sql`
- **Tables Created**:
  - `assessment_definitions` - Stores baseline_core_version + modules + sector/subsector
  - `assessment_question_universe` - Frozen question order per assessment
- **Status**: ✅ Migration created (ready to apply)

### Composition Tool
- **File**: `tools/runtime/compose_assessment_universe.py`
- **Purpose**: Composes question universe from indexes
- **Features**:
  - Always includes BASELINE_CORE
  - Optionally adds MODULES, SECTOR, SUBSECTOR
  - Freezes deterministic order in database
- **Status**: ✅ Created

### Validation Guardrail
- **File**: `tools/quality/validate_baseline_core_universality.py`
- **Purpose**: Prevents non-universal questions in CORE
- **Status**: ✅ Created and passing

## Baseline CORE Structure

30 questions organized into 8 groups:

1. **GOVERNANCE** (order: 10)
   - Governance, SecurityPersonnel

2. **RISK_AND_PLANNING** (order: 20)
   - RiskAssessment, SecurityPlan, PlanCoordination

3. **TRAINING_AND_EXERCISES** (order: 30)
   - Training, Exercises

4. **PHYSICAL_BOUNDARIES** (order: 40)
   - PerimeterSecurity, Lighting, StandoffDistance, ParkingDelivery

5. **ENTRY_AND_VISITORS** (order: 50)
   - EntryControl, VisitorManagement, AccessControl, KeyControl

6. **DETECTION_AND_MONITORING** (order: 60)
   - VideoMonitoring, CCTV, VideoSystemType, AlarmMonitoring

7. **COMMUNICATIONS_AND_REPORTING** (order: 70)
   - IncidentReporting, LawEnforcement, LawComm, Communications, MassNotification

8. **RESPONSE_AND_RECOVERY** (order: 80)
   - EmergencyProcedures, EvacuationShelter, Continuity, Recovery, Maintenance, AuditReview

## Modules Available

5 optional modules (additive):

- **MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT**: CrowdManagement
- **MODULE_PUBLIC_VENUE_CREDENTIALING**: Credentialing
- **MODULE_PUBLIC_INFORMATION**: PublicInformation
- **MODULE_MEDICAL_SUPPORT**: Medical
- **MODULE_INSIDER_THREAT**: InsiderThreat, SuspiciousActivity

## Key Principles (Non-Negotiable)

1. ✅ Baseline CORE is universal (telecom/small business included)
2. ✅ Non-universal items moved to MODULES (not sector/subsector)
3. ✅ No "exclude" logic; only "include modules" logic
4. ✅ Past assessments remain reproducible (versioned question set)

## Next Steps

1. **Apply Migration**: Run `migrations/2026_01_14_baseline_core_modules.sql` on RUNTIME database
2. **Curate CORE List**: Review and move any additional non-universal items to MODULES
3. **Update UI**: Assessment creation wizard needs module selector
4. **Update Runner**: Question display must use `order_index` from `assessment_question_universe`

## Validation Results

```
PASS: baseline core universality check
  Total questions in CORE: 30
  Disallowed list checked: 6 questions
```

All non-universal questions are properly excluded from CORE.


