# Overlay Wiring Report

**Generated:** 1/18/2026, 10:44:09 AM

---

## 1. Runtime DB: Table Existence + Counts

**Connection Info:**
- Host: ::1
- Database: postgres
- Port: 5432

### Reference Tables (sectors/subsectors)

| Schema | Table Name | Row Count | Sample Columns |
|---|---|---|---|
| public | sectors | 18 | id, sector_name, description, source, is_active... |
| public | subsectors | 123 | id, sector_id, description, source, is_cross_sector... |

### Overlay Spine Tables

*No tables found.*

### Assessment Tables (with sector/subsector columns)

| Schema | Table Name | Row Count | Sector-Related Columns |
|--------|------------|-----------|----------------------|
| public | assessment_definitions | 1 | sector_code, subsector_code |
| public | assessment_required_elements | 0 | sector_id, subsector_id |
| public | assessments | 1 | sector_id, sector_name, subsector_id, subsector_name, sector_version, subsector_version |

### All Candidate Tables (by pattern match)

| Schema | Table Name | Row Count | Columns |
|--------|------------|-----------|---------|
| public | assessment_applied_ofcs | 0 | 6 columns |
| public | assessment_applied_vulnerabilities | 0 | 4 columns |
| public | assessment_definitions | 1 | 9 columns |
| public | assessment_expansion_profiles | 0 | 4 columns |
| public | assessment_expansion_responses | 0 | 4 columns |
| public | assessment_instances | 12 | 9 columns |
| public | assessment_question_responses | 0 | 6 columns |
| public | assessment_question_universe | 0 | 6 columns |
| public | assessment_required_elements | 0 | 15 columns |
| public | assessment_status | 1 | 3 columns |
| public | assessment_technology_profiles | 0 | 7 columns |
| public | assessment_templates | 1 | 6 columns |
| public | assessments | 1 | 21 columns |
| public | baseline_spines_runtime | 130 | 9 columns |
| public | baseline_spines_runtime_loads | 0 | 5 columns |
| public | sector_expansion_profiles | 0 | 9 columns |
| public | sectors | 18 | 9 columns |
| public | subsectors | 123 | 10 columns |

## 2. Code Wiring: API Usage

### API Routes (app/api)

Found 687 occurrences:

- **app/api/reference/sectors/route.ts:13** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:19** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:20** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:25** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:26** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:27** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:31** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:36** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:38** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:40** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:45** (pattern: `sector`)
- **app/api/reference/sectors/route.ts:46** (pattern: `sector`)
- **app/api/reference/subsectors/route.ts:9** (pattern: `sector`)
- **app/api/reference/subsectors/route.ts:13** (pattern: `sector`)
- **app/api/reference/subsectors/route.ts:13** (pattern: `subsector`)
- **app/api/reference/subsectors/route.ts:14** (pattern: `sector`)
- **app/api/reference/subsectors/route.ts:19** (pattern: `sector`)
- **app/api/reference/subsectors/route.ts:19** (pattern: `sector_id`)
- **app/api/reference/subsectors/route.ts:22** (pattern: `sector`)
- **app/api/reference/subsectors/route.ts:22** (pattern: `subsector`)
  `sector_name,`
  `FROM sectors`
  `ORDER BY sector_name, name`
  `// Normalize sectors`
  `const normalizedSectors = (result.rows || []).map(s => {`
  `const sectorName = s.sector_name || s.name || `Sector ${s.id}``
  `sector_name: sectorName,`
  `console.log(`[API /api/reference/sectors] Fetched ${normalizedSectors.length} sectors`);`
  `return NextResponse.json({ sectors: normalizedSectors });`
  `console.error('[API /api/reference/sectors] Error:', error);`
  `stanceof Error ? error.message : 'Failed to fetch sectors',`
  `sectors: []`
  `const sectorId = searchParams.get('sectorId');`
  `// If no sectorId provided, return all active subsectors`
  `// If no sectorId provided, return all active subsectors`
  `if (!sectorId) {`
  `sector_id,`
  `sector_id,`
  `FROM subsectors`
  `FROM subsectors`

*... and 667 more occurrences*

### Library Files (app/lib)

Found 58 occurrences:

- **app/lib/config/subsector_field_schemas.ts:12** (pattern: `sector`)
- **app/lib/config/subsector_field_schemas.ts:12** (pattern: `subsector`)
- **app/lib/config/subsector_field_schemas.ts:13** (pattern: `sector`)
- **app/lib/config/subsector_field_schemas.ts:13** (pattern: `subsector`)
- **app/lib/config/subsector_field_schemas.ts:16** (pattern: `sector`)
- **app/lib/config/subsector_field_schemas.ts:16** (pattern: `subsector`)
- **app/lib/config/subsector_field_schemas.ts:19** (pattern: `sector`)
- **app/lib/config/subsector_field_schemas.ts:19** (pattern: `subsector`)
- **app/lib/config/subsector_field_schemas.ts:21** (pattern: `sector`)
- **app/lib/config/subsector_field_schemas.ts:21** (pattern: `subsector`)
  `export type SubsectorSchema = {`
  `export type SubsectorSchema = {`
  `subsector_code: string;`
  `subsector_code: string;`
  `s?: string[]; // module codes allowed for this subsector`
  `ules?: string[]; // module codes allowed for this subsector`
  `export const SUBSECTOR_SCHEMAS: Record<string, SubsectorSchema> = {`
  `export const SUBSECTOR_SCHEMAS: Record<string, SubsectorSchema> = {`
  `"SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES": {`
  `"SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES": {`

*... and 48 more occurrences*

### Admin Files (app/admin)

Found 24 occurrences:

- **app/admin/assessments/page.tsx:12** (pattern: `sector`)
- **app/admin/assessments/page.tsx:12** (pattern: `sector_id`)
- **app/admin/assessments/page.tsx:13** (pattern: `sector`)
- **app/admin/assessments/page.tsx:14** (pattern: `sector`)
- **app/admin/assessments/page.tsx:14** (pattern: `subsector`)
- **app/admin/assessments/page.tsx:14** (pattern: `sector_id`)
- **app/admin/assessments/page.tsx:14** (pattern: `subsector_id`)
- **app/admin/assessments/page.tsx:15** (pattern: `sector`)
- **app/admin/assessments/page.tsx:15** (pattern: `subsector`)
- **app/admin/assessments/page.tsx:52** (pattern: `sector`)
  `sector_id?: string;`
  `sector_id?: string;`
  `sector_name?: string;`
  `subsector_id?: string;`
  `subsector_id?: string;`
  `subsector_id?: string;`
  `subsector_id?: string;`
  `subsector_name?: string;`
  `subsector_name?: string;`
  `sector?: string;`

*... and 14 more occurrences*

## 3. API Endpoint Analysis

### Question Endpoints

| Endpoint | Accepts Sector/Subsector | Reads Overlay Tables | Evidence |
|----------|-------------------------|---------------------|----------|
| app/api/runtime/questions/route.ts | ❌ No | ❌ No | None |
| app/api/runtime/assessments/[assessmentId]/questions/route.ts | ✅ Yes | ❌ No | Line 47: * 1. Loads assessment to get sector_code/subsector_code from assessment... |
| app/api/runtime/assessments/[assessmentId]/question-universe/route.ts | ✅ Yes | ❌ No | Line 45: sector_code,... |

## 4. Conclusion

**Result: ⚠️ Overlays exist but NOT wired**

Overlay/reference tables exist but API endpoints do not query them. Overlays exist but are NOT wired.

### Evidence Summary

- Reference tables found: 2
- Overlay spine tables found: 0
- Code occurrences found: 769
- Endpoints querying overlays: 0