# Database Table Audit Report

**Generated:** 1769465264.8083358

**Total Deprecated Tables:** 36
- RUNTIME: 33
- CORPUS: 3

## Deprecated Tables

### RUNTIME.baseline_questions_legacy
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.baseline_questions
- **Status:** DEPRECATED
- **References:** 0
- **Migrations:**
  - `db\migrations\corpus\2026_01_14_ofc_to_question_links.sql`

### RUNTIME.canonical_question_templates
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.canonical_question_no_map
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.baseline_responses
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.assessment_responses
- **Status:** DEPRECATED
- **References:** 0
- **Migrations:**
  - `db\migrations\20260119_copy_schema_from_postgres.sql`
  - `db\migrations\20260124_add_assessment_followup_responses.sql`

### RUNTIME.assessment_templates
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.assessment_vulnerability_sectors
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.canonical_disciplines
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.canonical_subtypes
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.canonical_manifest
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.canonical_ofc_patterns
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.canonical_vulnerability_patterns
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.citation_bindings
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.citation_requests
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.compliance_report
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.document_subtype_relevance
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.drift_scan
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.normalized_findings
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.normalized_ofcs
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.observed_vulnerabilities
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.ofc_nomination_decisions
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.ofc_wipe_log
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.phase6_reviews
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.report_snapshots
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.sector_metrics
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.subsector_metrics
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.subdiscipline_sector_filter
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.subsector_discipline_map
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.subsector_discipline_weight_history
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.technology_maturity_definitions
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.technology_maturity_lookup
- **Status:** DEPRECATED
- **References:** 0

### RUNTIME.user_profiles
- **Status:** DEPRECATED
- **References:** 0

### CORPUS.canonical_sources_deprecated
- **Status:** DEPRECATED
- **References:** 0
- **Migrations:**
  - `db\migrations\corpus\20260124_0011_deprecate_runtime_owned_tables_in_corpus.sql`

### CORPUS.ofc_library_citations_deprecated
- **Status:** DEPRECATED
- **References:** 0
- **Migrations:**
  - `db\migrations\corpus\20260124_0011_deprecate_runtime_owned_tables_in_corpus.sql`

### CORPUS.documents
- **Status:** DEPRECATED
- **References:** 0
- **Migrations:**
  - `db\migrations\20260116_add_document_citation_metadata.sql`
  - `db\migrations\20260118_create_corpus_documents.sql`
  - `db\migrations\20260124_0007_lock_ofc_origin_on_candidates.sql`
  - `db\migrations\20260124_0010_canonical_sources_source_kind.sql`
  - `db\migrations\corpus\20260125_add_corpus_processing_status.sql`
  - `db\migrations\corpus\20260125_add_corpus_reprocess_queue.sql`
  - `db\migrations\corpus\2026_01_13_add_chunk_locators.sql`
  - `db\migrations\corpus\2026_01_13_fix_xlsx_candidate_dedup.sql`
  - `db\migrations\corpus\2026_01_14_ofc_to_question_links.sql`
  - `db\migrations\runtime\20260126_cleanup_archive_source_documents_paths.sql`

## Archive Tables

- **RUNTIME.archive_normalized_evidence_links** - ARCHIVE
- **RUNTIME.archive_normalized_vulnerabilities** - ARCHIVE
- **RUNTIME.archive_source_documents** - ARCHIVE
- **RUNTIME.archive_source_statements** - ARCHIVE
