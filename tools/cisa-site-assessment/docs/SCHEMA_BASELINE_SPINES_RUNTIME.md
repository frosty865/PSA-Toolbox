# Baseline Spines Runtime Schema

**Table:** `public.baseline_spines_runtime`  
**Project:** RUNTIME (wivohgbuuwxoyfyzntsd)  
**Purpose:** Stores baseline assessment questions (baseline spines) for the PSA assessment system

## Schema Definition

```sql
CREATE TABLE IF NOT EXISTS public.baseline_spines_runtime (
  canon_id TEXT PRIMARY KEY,
  discipline_code TEXT NOT NULL,
  subtype_code TEXT,  -- NULL for discipline-level questions, NOT NULL for subtype-anchored questions
  question_text TEXT NOT NULL,
  response_enum JSONB NOT NULL DEFAULT '["YES","NO","N_A"]'::jsonb,
  canon_version TEXT NOT NULL,
  canon_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_baseline_spines_runtime_active 
  ON public.baseline_spines_runtime(active) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_baseline_spines_runtime_discipline 
  ON public.baseline_spines_runtime(discipline_code);

CREATE INDEX IF NOT EXISTS idx_baseline_spines_runtime_subtype 
  ON public.baseline_spines_runtime(subtype_code) 
  WHERE subtype_code IS NOT NULL;
```

## Column Descriptions

### `canon_id` (TEXT, PRIMARY KEY)
- **Purpose:** Unique identifier for the baseline question
- **Format:** 
  - Discipline-level: `BASE-<DISCIPLINE_CODE>` (e.g., `BASE-ACS`)
  - Subtype-level: `BASE-<DISCIPLINE_CODE>-<SUBTYPE_CODE>` (e.g., `BASE-ACS-ACS_BIOMETRIC_ACCESS`)
- **Uniqueness:** Must be unique across all rows
- **Constraints:** Used as primary key, required for UPSERT operations

### `discipline_code` (TEXT, NOT NULL)
- **Purpose:** Discipline code (e.g., `ACS`, `VSS`, `EMR`)
- **Source:** From `disciplines.code` or extracted from `subtype_code`
- **Required:** Always present

### `subtype_code` (TEXT, NULLABLE)
- **Purpose:** Subtype code for subtype-anchored questions (e.g., `ACS_BIOMETRIC_ACCESS`)
- **NULL:** Indicates discipline-level baseline question (legacy ~25 questions)
- **NOT NULL:** Indicates subtype-anchored baseline question (104 subtype questions)
- **Format:** `<DISCIPLINE_CODE>_<SUBTYPE_SLUG>` (e.g., `EMR_BUSINESS_CONTINUITY`)
- **Source:** From `discipline_subtypes.code`

### `question_text` (TEXT, NOT NULL)
- **Purpose:** The baseline question text
- **Rules:**
  - Must be existence-only (YES/NO/N_A)
  - No enumerations, sector language, or "which/how/what"
  - Format: "Is/Are ... implemented/in place?"
- **Examples:**
  - ✅ "Is a Biometric Access capability implemented?"
  - ✅ "Are backups, redundancies, and emergency resources tested regularly?" (if sanitized)
  - ❌ "What are the organization's essential functions?" (forbidden)

### `response_enum` (JSONB, NOT NULL, DEFAULT: `["YES","NO","N_A"]`)
- **Purpose:** Allowed response values
- **Fixed Value:** Always `["YES","NO","N_A"]`
- **Storage:** JSONB array

### `canon_version` (TEXT, NOT NULL)
- **Purpose:** Version identifier for the baseline canon
- **Values:** `"v1"` (current)
- **Purpose:** Enables versioning and migration

### `canon_hash` (TEXT, NOT NULL)
- **Purpose:** Hash of canon_id for integrity checking
- **Generation:** `MD5(canon_id)`
- **Purpose:** Enables change detection

### `active` (BOOLEAN, NOT NULL, DEFAULT: true)
- **Purpose:** Soft delete flag
- **Default:** `true`
- **Usage:** Set to `false` to disable without deleting

### `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT: now())
- **Purpose:** Record creation timestamp
- **Auto-set:** On INSERT

### `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT: now())
- **Purpose:** Record last update timestamp
- **Auto-set:** On INSERT and UPDATE

## Indexes

1. **`idx_baseline_spines_runtime_active`** (partial)
   - On `active` column
   - WHERE `active = true`
   - Optimizes queries for active questions only

2. **`idx_baseline_spines_runtime_discipline`**
   - On `discipline_code`
   - Optimizes discipline-based queries

3. **`idx_baseline_spines_runtime_subtype`** (partial)
   - On `subtype_code`
   - WHERE `subtype_code IS NOT NULL`
   - Optimizes subtype-anchored queries

## Data Model

### Question Types

1. **Discipline-Level Questions** (~25)
   - `subtype_code IS NULL`
   - One question per discipline
   - Legacy baseline questions
   - Example: `BASE-ACS` → "Is access control implemented?"

2. **Subtype-Anchored Questions** (104)
   - `subtype_code IS NOT NULL`
   - One question per subtype_code
   - New baseline coverage (v1)
   - Example: `BASE-ACS-ACS_BIOMETRIC_ACCESS` → "Is a Biometric Access capability implemented?"

### Coverage Model

- **Total Coverage:** 104 subtypes (from taxonomy)
- **Discipline-Level:** ~25 questions (legacy, subtype_code NULL)
- **Subtype-Anchored:** 104 questions (new, subtype_code NOT NULL)
- **Overlap:** Some subtypes may have both discipline-level and subtype-anchored questions

## Canon ID Format

### Discipline-Level
```
BASE-<DISCIPLINE_CODE>
```
Example: `BASE-ACS`, `BASE-VSS`

### Subtype-Level
```
BASE-<DISCIPLINE_CODE>-<SUBTYPE_CODE>
```
Example: `BASE-ACS-ACS_BIOMETRIC_ACCESS`, `BASE-EMR-EMR_BUSINESS_CONTINUITY`

**Rules:**
- Must be unique
- Max length: 255 characters (PostgreSQL TEXT limit)
- Format is deterministic based on discipline_code and subtype_code

## Seeding Process

### Initial Seed (Discipline-Level)
- Source: `psa_engine/doctrine/baseline_canon/baseline_canon_runtime.v1.json`
- Script: `tools/seed_baseline_spines.ts`
- Result: ~25 discipline-level questions

### Subtype Expansion (v1)
- Source: `tools/outputs/baseline_subtype_v1.json`
- Script: `tools/outputs/baseline_subtype_v1_seed.sql`
- Result: 99 new subtype-anchored questions
- Coverage: 104/104 subtypes (5 already covered by discipline-level)

### UPSERT Strategy
- Uses `INSERT ... ON CONFLICT (canon_id) DO UPDATE`
- Idempotent: Safe to run multiple times
- Preserves existing discipline-level questions unless canon_id collision

## API Usage

### Endpoints
- `GET /api/runtime/questions?universe=ALL` - Returns all baseline questions
- `GET /api/runtime/questions?universe=BASELINE` - Returns baseline questions only
- `GET /api/runtime/health` - Health check including baseline spine count

### Query Patterns

**Get all active baseline spines:**
```sql
SELECT * FROM public.baseline_spines_runtime WHERE active = true;
```

**Get subtype-anchored questions:**
```sql
SELECT * FROM public.baseline_spines_runtime 
WHERE active = true AND subtype_code IS NOT NULL;
```

**Get discipline-level questions:**
```sql
SELECT * FROM public.baseline_spines_runtime 
WHERE active = true AND subtype_code IS NULL;
```

**Get questions for a specific subtype:**
```sql
SELECT * FROM public.baseline_spines_runtime 
WHERE active = true AND subtype_code = 'ACS_BIOMETRIC_ACCESS';
```

**Get questions for a discipline:**
```sql
SELECT * FROM public.baseline_spines_runtime 
WHERE active = true AND discipline_code = 'ACS';
```

## Validation Rules

1. **Uniqueness:**
   - `canon_id` must be unique
   - One question per `subtype_code` (when subtype_code IS NOT NULL)

2. **Coverage:**
   - All 104 subtypes from taxonomy must be covered
   - Either by discipline-level question (subtype_code NULL) or subtype-anchored question (subtype_code NOT NULL)

3. **Question Format:**
   - Must be existence-only (YES/NO/N_A)
   - No forbidden words: "tested", "regularly", "adequate", "effective", "which", "how", "what"
   - No enumerations or sector language

4. **Response Enum:**
   - Must be exactly `["YES","NO","N_A"]`

## Related Tables

- **`disciplines`** - Discipline definitions (discipline_code references)
- **`discipline_subtypes`** - Subtype definitions (subtype_code references)
- **`assessment_responses`** - User responses to baseline questions

## Migration Notes

### Baseline Subtype v1 Expansion (2026-01-16)
- Added 99 new subtype-anchored questions
- Expanded coverage from ~25 to 104/104 subtypes
- Preserved existing discipline-level questions
- All new questions use `canon_version = 'v1'`

### Tools
- **Generator:** `tools/generate_baseline_subtype_v1.ts`
- **Seed Script:** `tools/outputs/baseline_subtype_v1_seed.sql`
- **Dry-Run:** `tools/dry_run_seed_baseline_subtype_v1.sql`
- **Audit:** `tools/outputs/baseline_subtype_v1_audit.json`

## References

- **Taxonomy:** `taxonomy/discipline_subtypes.json` (104 subtypes)
- **Candidates:** `tools/outputs/baseline_candidates.json`
- **Seed Script:** `tools/outputs/baseline_subtype_v1_seed.sql`
- **Runbook:** `tools/RUNTIME_DB_RUNBOOK.md`
