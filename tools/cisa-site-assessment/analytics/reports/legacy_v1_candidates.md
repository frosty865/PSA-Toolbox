# Legacy V1 Tables Audit Report

Generated: 2026-01-24T16:00:13.447Z

## Summary

### CORPUS Database
- Total tables: 22
- Likely legacy: 0
- Zero row count: 0
- No code references: 22
- No dependencies: 13

### RUNTIME Database
- Total tables: 55
- Likely legacy: 0
- Zero row count: 0
- No code references: 55
- No dependencies: 37

## Tables with Zero Code References (Manual Review Recommended)

These tables have no code references but may still be in use:

| Database | Table | Rows | FK In | FK Out |
|----------|-------|------|-------|--------|
| CORPUS | `document_chunks` | 1949 | 3 | 1 |
| CORPUS | `ofc_candidate_queue` | 0 | 2 | 3 |
| CORPUS | `ofc_question_links` | 0 | 0 | 2 |
| CORPUS | `module_chunk_links` | 614 | 0 | 1 |
| CORPUS | `corpus_documents` | 66 | 2 | 1 |
| CORPUS | `question_candidate_queue` | 0 | 0 | 2 |
| CORPUS | `canonical_sources` | 133 | 2 | 1 |
| CORPUS | `ofc_candidate_targets` | 0 | 0 | 1 |
| CORPUS | `source_registry` | 81 | 2 | 0 |
| CORPUS | `corpus_candidate_question_links` | 16 | 0 | 1 |
| CORPUS | `documents` | 69 | 4 | 1 |
| CORPUS | `ingestion_runs` | 242 | 1 | 0 |
| CORPUS | `module_source_documents` | -1 | 0 | 1 |
| CORPUS | `corpus_expansion_questions` | 0 | 0 | 0 |
| CORPUS | `ingestion_run_documents` | 174 | 0 | 2 |
| CORPUS | `corpus_match_runs` | -1 | 1 | 0 |
| CORPUS | `assessment_module_instances` | -1 | 0 | 1 |
| CORPUS | `assessment_module_questions` | -1 | 0 | 1 |
| CORPUS | `corpus_overlay_control` | -1 | 0 | 0 |
| CORPUS | `corpus_source_set_control` | -1 | 0 | 0 |
| CORPUS | `assessment_modules` | -1 | 2 | 0 |
| CORPUS | `ofc_library_citations` | -1 | 0 | 0 |
| RUNTIME | `archive_source_statements` | 13288 | 0 | 0 |
| RUNTIME | `discipline_subtypes` | 105 | 2 | 1 |
| RUNTIME | `ofc_question_links` | 89 | 0 | 0 |
| RUNTIME | `ofc_nominations` | 0 | 0 | 1 |
| RUNTIME | `assessments` | 11 | 8 | 0 |
| RUNTIME | `canonical_ofcs` | 111 | 3 | 1 |
| RUNTIME | `baseline_spines_runtime` | 130 | 1 | 1 |
| RUNTIME | `archive_source_documents` | 213 | 0 | 0 |
| RUNTIME | `module_questions` | -1 | 0 | 3 |
| RUNTIME | `subsectors` | 123 | 13 | 1 |
| RUNTIME | `module_ofcs` | 6 | 1 | 2 |
| RUNTIME | `module_sources` | -1 | 1 | 1 |
| RUNTIME | `assessment_definitions` | -1 | 0 | 1 |
| RUNTIME | `canonical_ofc_citations` | 111 | 0 | 1 |
| RUNTIME | `disciplines` | -1 | 14 | 0 |
| RUNTIME | `module_import_batches` | -1 | 1 | 1 |
| RUNTIME | `sectors` | -1 | 12 | 0 |
| RUNTIME | `archive_normalized_vulnerabilities` | 56 | 0 | 0 |
| RUNTIME | `assessment_module_questions` | -1 | 0 | 2 |
| RUNTIME | `coverage_runs` | -1 | 0 | 0 |
| RUNTIME | `module_risk_drivers` | -1 | 0 | 1 |
| RUNTIME | `assessment_required_elements` | -1 | 0 | 1 |
| RUNTIME | `ofc_library` | -1 | 1 | 0 |
| RUNTIME | `overlay_spines_runtime` | -1 | 1 | 2 |
| RUNTIME | `assessment_instances` | 6 | 4 | 1 |
| RUNTIME | `assessment_module_instances` | -1 | 0 | 2 |
| RUNTIME | `assessment_module_question_responses` | -1 | 0 | 2 |
| RUNTIME | `assessment_modules` | 1 | 10 | 0 |
| RUNTIME | `assessment_technology_profiles` | -1 | 0 | 2 |
| RUNTIME | `facilities` | -1 | 0 | 0 |
| RUNTIME | `module_ofc_sources` | -1 | 0 | 1 |
| RUNTIME | `system_settings` | -1 | 0 | 0 |
| RUNTIME | `module_chunk_links` | -1 | 0 | 1 |
| RUNTIME | `subsector_module_policy` | -1 | 0 | 2 |
| RUNTIME | `tech_question_responses` | -1 | 0 | 2 |
| RUNTIME | `tech_question_templates` | -1 | 1 | 0 |
| RUNTIME | `assessment_applied_ofcs` | -1 | 0 | 4 |
| RUNTIME | `assessment_question_responses` | -1 | 0 | 0 |
| RUNTIME | `assessment_status` | -1 | 0 | 0 |
| RUNTIME | `assessment_templates` | -1 | 0 | 0 |
| RUNTIME | `audit_log` | -1 | 0 | 0 |
| RUNTIME | `expansion_questions` | -1 | 1 | 1 |
| RUNTIME | `module_source_documents` | -1 | 0 | 1 |
| RUNTIME | `sector_expansion_profiles` | -1 | 2 | 0 |
| RUNTIME | `assessment_applied_vulnerabilities` | -1 | 0 | 2 |
| RUNTIME | `assessment_expansion_profiles` | -1 | 0 | 2 |
| RUNTIME | `assessment_expansion_responses` | -1 | 0 | 2 |
| RUNTIME | `assessment_question_universe` | -1 | 0 | 1 |
| RUNTIME | `baseline_spines_runtime_loads` | -1 | 0 | 0 |
| RUNTIME | `normalized_evidence_links` | -1 | 0 | 1 |
| RUNTIME | `normalized_vulnerabilities` | -1 | 1 | 0 |
| RUNTIME | `overlay_spine_order_registry` | -1 | 0 | 1 |
| RUNTIME | `test_assessment_purge_log` | -1 | 0 | 0 |
| RUNTIME | `assessment_responses` | -1 | 0 | 0 |
| RUNTIME | `archive_normalized_evidence_links` | 60 | 0 | 0 |

## Recommendations

1. **Review legacy candidates** - Verify they are truly unused
2. **Run quarantine script** - `npm run db:legacy-quarantine-sql`
3. **Apply quarantine SQL** - Rename tables to `legacy_v1__*`
4. **Test application** - Run for a day to ensure nothing breaks
5. **Generate drop script** - After validation, create DROP statements

## Next Steps

```bash
# Generate quarantine SQL
npm run db:legacy-quarantine-sql

# Review generated SQL files:
# - analytics/reports/quarantine_corpus.sql
# - analytics/reports/quarantine_runtime.sql
```