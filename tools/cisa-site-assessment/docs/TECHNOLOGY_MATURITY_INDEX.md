# Technology Maturity Index (TMI) v1

## Overview

The Technology Maturity Index (TMI) provides a comparative scoring mechanism that evaluates technology sophistication beyond baseline compliance. **TMI does not affect baseline scoring** and is designed for comparative analysis and reporting.

## Core Principles

1. **Baseline Compliance is Primary**: Baseline score always takes precedence. Maturity scoring only applies when baseline is fully compliant.
2. **Deterministic Model**: Maturity levels and weights are explicitly defined per discipline and tech type.
3. **Optional and Toggleable**: Maturity scoring can be enabled/disabled without affecting baseline calculations.
4. **Explainable**: All maturity calculations are transparent and reportable.

## Data Model

### `technology_maturity_definitions`

Canonical table storing maturity definitions per discipline and technology type.

**Schema:**
- `id`: UUID (primary key)
- `discipline_code`: TEXT NOT NULL (e.g., "VIDEO_SURVEILLANCE")
- `tech_type`: TEXT NOT NULL (e.g., "CCTV_ANALOG", "IP_CAMERA_VMS")
- `maturity_level`: INTEGER NOT NULL (1-5)
- `maturity_weight`: NUMERIC(3,2) NOT NULL (0.00-1.00)
- `description`: TEXT NOT NULL (capability-focused, 1-2 sentences)
- `is_active`: BOOLEAN NOT NULL DEFAULT true
- `created_at`, `updated_at`: TIMESTAMPTZ

**Constraints:**
- Unique on `(discipline_code, tech_type)`
- `maturity_level` between 1 and 5
- `maturity_weight` between 0.00 and 1.00 (exclusive of 0)

## Maturity Levels (VSS Example)

### Level 1: Basic (Weight: 0.60)
- **CCTV_ANALOG**: Basic analog CCTV system with standard recording capabilities

### Level 2: Intermediate (Weight: 0.70-0.75)
- **CCTV_DIGITAL_DVR**: Digital DVR-based system with improved storage and basic network connectivity
- **MOBILE_TRAILER_SYSTEM**: Mobile/trailer-mounted surveillance system
- **BODY_WORN_VIDEO**: Body-worn video system for personnel

### Level 3: Advanced (Weight: 0.85-0.90)
- **IP_CAMERA_VMS**: IP-based camera system with Video Management Software
- **HYBRID_ANALOG_IP**: Hybrid system combining analog and IP cameras
- **CLOUD_MANAGED_VIDEO**: Cloud-managed video surveillance system

### Level 4: Highly Mature (Weight: 1.00)
- **IP_CAMERA_VMS_REDUNDANT**: IP camera VMS with redundant systems and high availability

## Calculation Rules (Defined, Not Yet Applied)

### Rule 1: Baseline Gate
```
IF Baseline Score < 100%:
  → Maturity score is informational only
  → Effective Strength = Baseline Score (maturity not applied)
  
IF Baseline Score = 100%:
  → Maturity weight becomes eligible
  → Effective Strength = Baseline Score × Technology Maturity Weight × Sector Weight
```

### Rule 2: Multiple Technology Types
When an assessment has multiple tech types for a subtype (hybrid systems):

**Option A: Highest Verified Maturity** (Recommended)
- Use the highest maturity level among VERIFIED tech types
- If no VERIFIED, use highest among OBSERVED
- If no OBSERVED, use highest among REPORTED

**Option B: Conservative Average**
- Calculate weighted average of all tech types
- Apply conservative rounding (round down)

**Documentation Requirement**: The chosen method must be documented and consistent.

### Rule 3: Confidence Weighting (Future)
The `confidence` field in `assessment_technology_profiles` may later down-weight maturity:
- VERIFIED: Full weight
- OBSERVED: 0.95× weight
- REPORTED: 0.85× weight

This is **not implemented** in v1 but is defined for future enhancement.

### Rule 4: Sector Weighting (Future)
Sector/subsector context will later weight importance:
```
Effective Discipline Strength = Baseline Score × Technology Maturity Weight × Sector Weight
```

Sector weights are **not defined** in v1.

## Reporting Model (Read-Only Structure)

### Fields for Future Reports

**Per Discipline:**
- `baseline_score`: Percentage (0-100)
- `baseline_status`: "COMPLIANT" | "NON_COMPLIANT"
- `tech_profile_summary`: Array of selected tech types with confidence
- `maturity_level`: Highest maturity level (1-5)
- `maturity_weight`: Corresponding weight (0.00-1.00)
- `effective_strength`: Computed only when enabled (Baseline × Maturity × Sector)
- `maturity_enabled`: Boolean flag indicating if maturity scoring is active

**Report Display Rules:**
1. Baseline score is **always shown separately** and prominently
2. Maturity metrics are clearly labeled as "Comparative" or "Technology Maturity"
3. Effective strength is shown only when:
   - Baseline score = 100%
   - Maturity scoring is enabled
   - Tech profile is VERIFIED or OBSERVED
4. Never mix baseline and maturity in a single score without clear explanation

## UI Placement (Future)

### Display Options

1. **Badge/Secondary Bar**:
   - Show maturity level as a badge next to baseline score
   - Display maturity weight as a secondary metric
   - Use visual distinction (different color, smaller font)

2. **Toggle Control**:
   - "Show Comparative Strength" toggle in assessment view
   - When enabled, shows effective strength calculation
   - When disabled, shows baseline score only

3. **Separate Section**:
   - Dedicated "Technology Maturity" section in reports
   - Clearly separated from baseline compliance section
   - Includes explanation of maturity model

### Visual Guidelines
- Baseline score: Primary, prominent
- Maturity metrics: Secondary, clearly labeled
- Effective strength: Only when enabled, with explanation

## Constraints

1. **No Baseline Changes**: Baseline scoring, gate ordering, and question content remain unchanged
2. **No OFC Logic Changes**: OFC generation and nomination logic unaffected
3. **No Sector Logic Activation**: Sector weighting not implemented in v1
4. **No Automatic Inference**: Tech maturity must be explicitly defined; no inference from tech profiles
5. **Production Query Exclusion**: All queries exclude QA assessments as before

## Database Schema

### Migration
Run: `migrations/20260113_add_technology_maturity_index.sql`

This creates:
- `technology_maturity_definitions` table
- Initial VSS maturity definitions (levels 1-4)
- Indexes and constraints
- Convenience view: `technology_maturity_lookup`

### Seed Data (VSS Only, v1)

| Tech Type | Level | Weight | Description |
|-----------|-------|--------|-------------|
| CCTV_ANALOG | 1 | 0.60 | Basic analog CCTV system |
| CCTV_DIGITAL_DVR | 2 | 0.75 | Digital DVR-based system |
| MOBILE_TRAILER_SYSTEM | 2 | 0.70 | Mobile/trailer-mounted system |
| BODY_WORN_VIDEO | 2 | 0.72 | Body-worn video system |
| HYBRID_ANALOG_IP | 3 | 0.85 | Hybrid analog/IP system |
| CLOUD_MANAGED_VIDEO | 3 | 0.88 | Cloud-managed video system |
| IP_CAMERA_VMS | 3 | 0.90 | IP camera with VMS |
| IP_CAMERA_VMS_REDUNDANT | 4 | 1.00 | Redundant IP VMS |

## Future Enhancements

1. **Additional Disciplines**: Extend maturity definitions to other disciplines (Access Control, Intrusion Detection, etc.)
2. **Confidence Weighting**: Implement confidence-based maturity adjustment
3. **Sector Weighting**: Define and implement sector/subsector importance weights
4. **Maturity Scoring Activation**: Implement calculation logic (currently defined but not applied)
5. **Comparative Reports**: Generate comparative analysis reports using maturity scores
6. **Maturity Trends**: Track maturity improvements over time

## Separation from Baseline

### Key Distinctions

| Aspect | Baseline Scoring | Technology Maturity |
|--------|----------------|-------------------|
| **Purpose** | Compliance assessment | Comparative capability analysis |
| **Scope** | All assessments | Only when baseline = 100% |
| **Impact** | Primary scoring | Secondary/comparative only |
| **Questions** | Baseline v2 questions | Technology overlay questions (optional) |
| **Gates** | Gate-ordered evaluation | Not applicable |
| **OFCs** | Triggers OFC nominations | Does not affect OFC logic |
| **Mandatory** | Yes | Optional/toggleable |

### Design Rationale

1. **Baseline is Authoritative**: Baseline v2 remains the single source of truth for compliance
2. **Maturity is Informational**: Technology maturity provides context but never overrides baseline failure
3. **Clear Separation**: Users can always see baseline score separately from maturity metrics
4. **Optional Enhancement**: Maturity scoring can be disabled without affecting core functionality

## Acceptance Criteria (v1 - Design Phase)

✅ Technology maturity definitions table created  
✅ Initial VSS maturity levels defined (1-4)  
✅ Calculation rules documented (not yet implemented)  
✅ Reporting model structure defined  
✅ UI placement guidelines documented  
✅ Separation from baseline clearly explained  
✅ No changes to baseline scoring logic  
✅ No changes to OFC generation logic  
✅ Production queries exclude QA assessments  

## Next Steps (Future Phases)

1. **Phase 2**: Implement maturity lookup in assessment detail API
2. **Phase 3**: Add maturity display to UI (badge/secondary metric)
3. **Phase 4**: Implement effective strength calculation (when baseline = 100%)
4. **Phase 5**: Add sector weighting
5. **Phase 6**: Implement confidence-based adjustment
6. **Phase 7**: Generate comparative reports

