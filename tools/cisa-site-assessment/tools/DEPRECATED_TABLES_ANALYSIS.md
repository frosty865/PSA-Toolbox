# Comprehensive Deprecated Tables Analysis

This document identifies potentially deprecated and unused tables in the runtime database. The runtime database contains **82 tables** total. This analysis categorizes them by usage status.

## Table Categories

### Active Tables (Used in Codebase)
These tables are actively queried in the application code:
- `assessments`, `assessment_instances`, `assessment_question_responses`, `assessment_question_universe`
- `assessment_expansion_responses`, `assessment_expansion_profiles`, `assessment_required_elements`
- `assessment_status`, `assessment_technology_profiles`, `assessment_applied_ofcs`
- `assessment_applied_vulnerabilities`, `assessment_definitions`
- `baseline_spines_runtime` (current authoritative source)
- `expansion_questions`
- `sectors`, `subsectors`, `disciplines`, `facilities`
- `ofc_nominations`, `ofc_library`, `ofc_library_citations`
- `ofc_candidate_queue`, `ofc_candidate_targets`
- `canonical_ofcs`, `canonical_ofc_citations`
- `normalized_vulnerabilities`, `normalized_evidence_links`
- `sector_expansion_profiles`
- `tech_question_responses`, `tech_question_templates`
- `coverage_runs`
- `system_settings`
- Views: `v_eligible_ofc_library`, `v_question_coverage`

### Archive Tables
These are explicitly marked as archive and likely contain historical data:
- `archive_normalized_evidence_links`
- `archive_normalized_vulnerabilities`
- `archive_source_documents`
- `archive_source_statements`

### Views
Database views (some may be unused):
- `v_active_baseline_questions`
- `v_candidate_targets_with_details`
- `v_canonical_ofcs_publish_ready`
- `v_eligible_ofc_library` (USED)
- `v_normalized_summary`
- `v_question_coverage` (USED)

### Test/Debug Tables
- `test_assessment_purge_log`
- `rls_verification`
- `audit_log`

## Potentially Deprecated/Unused Tables

### 1. `baseline_questions_legacy`
- **Status**: Explicitly marked as legacy
- **Replacement**: `baseline_spines_runtime`
- **Evidence**: 
  - Table name includes "_legacy" suffix
  - Has `deprecated_at` and `deprecated_reason` columns
  - Codebase uses `baseline_spines_runtime` as authoritative source
- **Action**: Verify no active queries, then archive/remove

### 2. `baseline_questions`
- **Status**: Likely deprecated
- **Replacement**: `baseline_spines_runtime`
- **Evidence**:
  - Codebase consistently uses `baseline_spines_runtime` for baseline questions
  - `baselineLoader.ts` queries `baseline_spines_runtime` exclusively
  - API routes (`/api/runtime/questions`, `/api/baseline/spines`) use `baseline_spines_runtime`
- **Action**: Check for any remaining references, migrate data if needed, then remove

### 3. `canonical_question_templates`
- **Status**: Possibly deprecated
- **Replacement**: `baseline_spines_runtime` (canon_id-based model)
- **Evidence**:
  - Modern code uses `canon_id` from `baseline_spines_runtime`
  - No active queries found in codebase
- **Action**: Verify no dependencies, then remove

### 4. `canonical_question_no_map`
- **Status**: Possibly deprecated
- **Replacement**: Integrated into `baseline_spines_runtime` model
- **Evidence**:
  - No active queries found in codebase
  - Appears to be a mapping table that may no longer be needed
- **Action**: Verify no dependencies, then remove

### 5. `baseline_responses`
- **Status**: Possibly deprecated
- **Replacement**: `assessment_question_responses`
- **Evidence**:
  - No active queries found in codebase
  - Modern assessment model uses `assessment_question_responses`
- **Action**: Verify no dependencies, then remove

### 6. `assessment_responses`
- **Status**: Possibly deprecated
- **Replacement**: `assessment_question_responses`
- **Evidence**:
  - Modern code uses `assessment_question_responses` for storing responses
  - Migration `2026_01_14_assessment_question_responses.sql` created new table
  - Both tables may coexist during migration period
- **Action**: Check if migration is complete, migrate remaining data, then remove

### 7. `assessment_templates`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies, then remove

### 8. `assessment_vulnerability_sectors`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies, then remove

### 9. `canonical_disciplines`, `canonical_subtypes`, `canonical_manifest`
- **Status**: Possibly deprecated
- **Evidence**: May be replaced by `baseline_spines_runtime` discipline/subtype model
- **Action**: Verify no dependencies, check if data is migrated

### 10. `canonical_ofc_patterns`, `canonical_vulnerability_patterns`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 11. `canonical_sources`
- **Status**: Possibly unused (may be corpus DB table)
- **Evidence**: Only referenced in corpus_client health check
- **Action**: Verify if this belongs in runtime DB or corpus DB

### 12. `citation_bindings`, `citation_requests`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 13. `compliance_report`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 14. `discipline_subtypes`, `document_subtype_relevance`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 15. `drift_scan`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 16. `normalized_findings`, `normalized_ofcs`, `observed_vulnerabilities`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase (only `normalized_vulnerabilities` and `normalized_evidence_links` are used)
- **Action**: Verify no dependencies

### 17. `ofc_nomination_decisions`, `ofc_wipe_log`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 18. `phase6_reviews`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 19. `report_snapshots`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 20. `sector_metrics`, `subsector_metrics`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 21. `subdiscipline_sector_filter`, `subsector_discipline_map`, `subsector_discipline_weight_history`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 22. `technology_maturity_definitions`, `technology_maturity_lookup`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 23. `user_profiles`
- **Status**: Possibly unused
- **Evidence**: No queries found in codebase
- **Action**: Verify no dependencies

### 24. Unused Views
- `v_active_baseline_questions` - Possibly replaced by direct `baseline_spines_runtime` queries
- `v_candidate_targets_with_details` - Possibly unused
- `v_canonical_ofcs_publish_ready` - Possibly unused
- `v_normalized_summary` - Possibly unused

## Current/Active Tables

### Baseline Questions
- **`baseline_spines_runtime`** - Current authoritative source for baseline questions
  - Uses `canon_id` as primary key
  - Has `active` flag for filtering
  - Includes `canon_version` and `canon_hash` for versioning

### Assessment Responses
- **`assessment_question_responses`** - Current table for storing question responses
  - Links to `assessments` via `assessment_id`
  - Uses `question_code` (canon_id) to reference baseline questions
  - Stores `response_enum` (YES/NO/N_A)

## Migration Status

### Baseline Questions Migration
- ✅ **Complete**: Codebase fully migrated to `baseline_spines_runtime`
- ⚠️ **Legacy tables may still exist**: `baseline_questions` and `baseline_questions_legacy` may have historical data

### Assessment Responses Migration
- ⚠️ **In Progress**: Both `assessment_responses` and `assessment_question_responses` may exist
- Need to verify if migration is complete

## Recommended Actions

1. **Run `check_deprecated_tables.ts`** when connectivity is available to get actual row counts:
   ```bash
   npx tsx tools/check_deprecated_tables.ts
   ```

2. **Check for dependencies** before dropping tables:
   ```sql
   -- Check for foreign key constraints referencing a table
   SELECT
     tc.table_name AS referencing_table,
     kcu.column_name AS referencing_column,
     ccu.table_name AS referenced_table,
     ccu.column_name AS referenced_column
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND ccu.table_name = 'TABLE_NAME_HERE';

   -- Check for views referencing a table
   SELECT DISTINCT 
     table_name AS view_name,
     table_schema
   FROM information_schema.view_table_usage
   WHERE table_schema = 'public'
     AND table_name = 'TABLE_NAME_HERE';

   -- Check for functions/procedures referencing a table
   SELECT 
     routine_name,
     routine_type
   FROM information_schema.routines
   WHERE routine_definition LIKE '%TABLE_NAME_HERE%'
     AND routine_schema = 'public';
   ```

3. **Check row counts** for tables before deciding to drop:
   ```sql
   -- Get row counts for all potentially unused tables
   SELECT 
     schemaname,
     tablename,
     n_tup_ins - n_tup_del AS estimated_rows
   FROM pg_stat_user_tables
   WHERE schemaname = 'public'
     AND tablename IN (
       'baseline_questions',
       'baseline_questions_legacy',
       'canonical_question_templates',
       'canonical_question_no_map',
       'baseline_responses',
       'assessment_responses',
       'assessment_templates',
       'assessment_vulnerability_sectors',
       -- Add other potentially unused tables
     )
   ORDER BY estimated_rows DESC;
   ```

4. **Archive deprecated tables** (don't delete yet):
   ```sql
   -- Create archive schema if it doesn't exist
   CREATE SCHEMA IF NOT EXISTS archive;

   -- Move tables to archive schema
   ALTER TABLE public.baseline_questions_legacy SET SCHEMA archive;
   ALTER TABLE public.baseline_questions SET SCHEMA archive;
   -- etc.
   ```

5. **After verification period** (e.g., 30-90 days), drop archived tables:
   ```sql
   DROP TABLE archive.baseline_questions_legacy;
   DROP TABLE archive.baseline_questions;
   -- etc.
   ```

## Quick Cleanup Script

For empty tables that are confirmed unused, you can create a cleanup script:

```sql
-- WARNING: Review carefully before running!
-- This will drop empty tables that are confirmed unused

BEGIN;

-- Drop empty unused tables (example - customize based on check_deprecated_tables.ts output)
DROP TABLE IF EXISTS public.citation_bindings;
DROP TABLE IF EXISTS public.citation_requests;
DROP TABLE IF EXISTS public.compliance_report;
DROP TABLE IF EXISTS public.drift_scan;
-- Add more as confirmed safe to drop

COMMIT;
```

## Running the Check Script

When database connectivity is available:

```bash
npx tsx tools/check_deprecated_tables.ts
```

This will:
- Check which deprecated tables exist
- Report row counts for each
- Identify tables with deprecated flags
- Compare migration status between old and new tables
