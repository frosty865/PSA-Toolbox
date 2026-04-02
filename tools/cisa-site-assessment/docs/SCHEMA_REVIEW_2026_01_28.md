# Database Schema Review
**Date:** 2026-01-28  
**Status:** ✅ Duplicates Cleaned, ⚠️ Config Sync Needed

## Executive Summary

- **Total Tables:** 91 unique tables
- **CORPUS Tables:** 24
- **RUNTIME Tables:** 67
- **Duplicates:** ✅ 0 (successfully cleaned)
- **Unmapped Tables:** ⚠️ 51 tables not in ownership config
- **Config Inconsistencies:** ⚠️ 23 tables in ownership.json but not in table_map.json

## Key Findings

### ✅ Strengths

1. **No Duplicate Tables** - All duplicate tables have been successfully removed
2. **Clear Separation** - CORPUS and RUNTIME databases are properly segregated
3. **Core Tables Mapped** - All critical tables are in ownership config

### ⚠️ Issues Requiring Attention

#### 1. Missing Table
- `documents` - Expected in CORPUS but missing
  - **Action:** Verify if this is a legacy table that should be removed from config, or if it needs to be created

#### 2. Unmapped Tables (51 total)

**CORPUS Unmapped Tables:**
- `canonical_sources_deprecated` (deprecated)
- `corpus_candidate_question_links`
- `corpus_match_runs`
- `corpus_overlay_control`
- `corpus_source_set_control`
- `ingestion_run_documents`
- `ofc_library_citations_deprecated` (deprecated)
- `question_candidate_queue`

**RUNTIME Unmapped Tables (sample):**
- `archive_*` tables (4 tables - archive data)
- `assessment_applied_ofcs`
- `assessment_applied_vulnerabilities`
- `assessment_definitions`
- `assessment_expansion_profiles`
- `assessment_module_question_responses`
- `assessment_question_responses`
- `assessment_question_universe`
- `assessment_required_elements`
- `assessment_status`
- `assessment_technology_profiles`
- `assessment_templates`
- `audit_log`
- `baseline_spines_runtime_loads`
- `canonical_ofc_citations`
- `canonical_ofcs`
- `coverage_runs`
- `discipline_subtype_reference_impl`
- `facilities`
- `module_chunks`
- `module_corpus_links`
- `module_documents`
- `module_import_batches`
- `module_ofc_sources`
- `module_ofcs`
- `module_questions`
- `module_risk_drivers`
- `module_sources`
- `normalized_evidence_links`
- `normalized_vulnerabilities`
- `overlay_spine_order_registry`
- `overlay_spines_runtime`
- `sector_expansion_profiles`
- `sectors`
- `subsector_module_policy`
- `subsectors`
- `system_settings`
- `tech_question_responses`
- `tech_question_templates`
- `test_assessment_purge_log`

**Action:** Add these tables to `config/db_ownership.json` with appropriate ownership (CORPUS or RUNTIME)

#### 3. Config Inconsistencies

**Tables in ownership.json but NOT in table_map.json (23 tables):**
- `public.ofc_candidate_queue`
- `public.corpus_expansion_questions`
- `public.corpus_reprocess_queue`
- `public.module_drafts`
- `public.module_draft_sources`
- `public.module_draft_questions`
- `public.module_standards`
- `public.module_standard_attributes`
- `public.module_standard_criteria`
- `public.module_standard_criterion_ofc_templates`
- `public.module_standard_references`
- `public.module_instances`
- `public.module_instance_criteria`
- `public.module_instance_criterion_responses`
- `public.module_instance_ofcs`
- `public.module_ofc_library`
- `public.module_ofc_citations`
- `public.assessment_modules`
- `public.assessment_module_instances`
- `public.assessment_module_questions`
- `public.module_chunk_links`
- `public.module_source_documents`
- `public.ofc_question_links`

**Action:** Sync `config/db_table_map.json` with `config/db_ownership.json` OR update table_map.json to be the authoritative source

#### 4. Deprecated/Archive Tables

**Deprecated Tables (6):**
- `canonical_sources_deprecated` (CORPUS)
- `ofc_library_citations_deprecated` (CORPUS)
- `archive_normalized_evidence_links` (RUNTIME)
- `archive_normalized_vulnerabilities` (RUNTIME)
- `archive_source_documents` (RUNTIME)
- `archive_source_statements` (RUNTIME)

**Action:** 
- Document purpose and retention policy
- Consider removing if no longer needed
- Add to ownership config if keeping

## Recommendations

### Priority 1: Sync Configuration Files
1. **Decide on authoritative source:**
   - Option A: `db_ownership.json` is authoritative → Update `db_table_map.json`
   - Option B: `db_table_map.json` is authoritative → Update `db_ownership.json`
   - **Recommendation:** Use `db_ownership.json` as authoritative (it's more complete)

2. **Sync the files:**
   - Add all 23 missing tables from ownership.json to table_map.json
   - OR remove them from ownership.json if table_map.json is authoritative

### Priority 2: Map Unmapped Tables
1. **Review each unmapped table** to determine:
   - Which database it belongs to (CORPUS or RUNTIME)
   - Whether it's still in use
   - Whether it should be deprecated/removed

2. **Add to ownership config:**
   - Add all active tables to `config/db_ownership.json`
   - Mark deprecated tables clearly
   - Document archive tables

### Priority 3: Handle Deprecated Tables
1. **Document purpose** of each deprecated/archive table
2. **Set retention policy** (e.g., keep for X months, then remove)
3. **Add to ownership config** if keeping, or remove if no longer needed

### Priority 4: Resolve Missing Table
1. **Investigate `documents` table:**
   - Check if it's a legacy table that should be removed from config
   - Check if it needs to be created (migration may be missing)
   - Update ownership config accordingly

## Table Ownership Summary

### CORPUS-Owned Tables (24 total)
Core corpus tables:
- `source_registry`
- `corpus_documents`
- `document_chunks`
- `ingestion_runs`
- `ofc_candidate_queue`
- `ofc_candidate_targets`
- `corpus_expansion_questions`
- `corpus_reprocess_queue`
- `module_standards` (and related)
- `module_chunk_links`
- `module_source_documents`
- `ofc_question_links`

### RUNTIME-Owned Tables (67 total)
Core runtime tables:
- `assessments` (and related)
- `assessment_modules` (and related)
- `module_drafts` (and related)
- `module_instances` (and related)
- `module_ofc_library` (and related)
- `ofc_library` (and related)
- `disciplines` (and related)
- `baseline_spines_runtime`
- `expansion_questions`
- `canonical_sources`
- `ofc_library_citations`

## Next Steps

1. ✅ **Completed:** Removed all duplicate tables
2. ⏳ **In Progress:** Review and map unmapped tables
3. ⏳ **Pending:** Sync configuration files
4. ⏳ **Pending:** Document deprecated tables
5. ⏳ **Pending:** Resolve missing `documents` table

## Tools Created

- `tools/db/review_schema.ts` - Comprehensive schema review tool
- `tools/db/list_all_tables.ts` - List all tables and identify duplicates
- `tools/db/cleanup_duplicate_tables.ts` - Cleanup duplicate tables
- `tools/db/execute_cleanup.ts` - Execute cleanup SQL

## Related Documentation

- `docs/CORPUS_RUNTIME_SEPARATION.md` - Database separation rules
- `docs/CORPUS_RUNTIME_SEGREGATION.md` - Hard segregation rules
- `config/db_ownership.json` - Table ownership configuration
- `config/db_table_map.json` - Table mapping configuration
