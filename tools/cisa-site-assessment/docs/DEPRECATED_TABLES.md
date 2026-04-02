# Archive Tables

**Date:** 2026-02-04  
**Purpose:** Document archive candidates and archive schema. Source of truth: `config/db_schema_status.json`.

## Overview

- **Archive candidates:** Tables to be moved to `archive` schema (RUNTIME). Run migration or `tools/archive_unused_tables.ts`.
- **Archive tables:** Tables in schema `archive`. Data preserved; not dropped.

## Source of truth

| Config | Purpose |
|--------|--------|
| `config/db_schema_status.json` | Lists `archive_candidates` and `archive_tables` by pool (CORPUS / RUNTIME). |
| `config/db_ownership.json` | Table ownership (CORPUS vs RUNTIME). |

## Archive candidates (RUNTIME → archive schema)

These tables are moved to `archive` schema by migration or tool. Data is preserved.

Run **one** of:

- **Migration:** `psql "$RUNTIME_DB_URL" -f db/migrations/runtime/20260203_archive_deprecated_tables.sql`
- **Tool:** `npx tsx tools/archive_unused_tables.ts`

Tables (from `config/db_schema_status.json` → `archive_candidates.RUNTIME`):

- assessment_questions, assessment_templates, assessment_vulnerability_sectors  
- baseline_questions, baseline_questions_legacy, baseline_responses  
- canonical_disciplines, canonical_manifest, canonical_ofc_patterns, canonical_question_no_map, canonical_question_templates  
- canonical_subtypes, canonical_vulnerability_patterns, citation_bindings, citation_requests  
- compliance_report, discipline_subtypes, document_subtype_relevance, drift_scan  
- normalized_findings, normalized_ofcs, observed_vulnerabilities, ofc_nomination_decisions, ofc_wipe_log  
- phase6_reviews, report_snapshots, sector_metrics  
- subdiscipline_sector_filter, subsector_discipline_map, subsector_discipline_weight_history, subsector_metrics  
- technology_maturity_definitions, technology_maturity_lookup, user_profiles  

After the migration/tool runs, they live as `archive.<table_name>`. Tables **not** in this list (e.g. assessment_responses, assessments, baseline_spines_runtime) are in active use and must not be archived.

## Archive schema tables

### CORPUS

| Table | Purpose |
|-------|--------|
| `archive.archive_corpus_documents` | Orphaned corpus_documents archived from module data cleanup. |
| `archive.archive_document_chunks` | Orphaned document_chunks archived from module data cleanup. |
| `archive.canonical_sources_deprecated` | Former public table; moved to archive 2026-02-04. |
| `archive.ofc_library_citations_deprecated` | Former public table; moved to archive 2026-02-04. |
| `archive.documents` | Legacy documents table; moved to archive 2026-02-04. `public.documents` is a read-only view over this for backward compatibility. |

Migrations: `20260127_create_archive_tables_for_orphaned_module_data.sql`, `20260204_move_deprecated_tables_to_archive.sql`.

### RUNTIME

- **Tables with names starting with `archive_`** (moved to `archive` schema by `20260203_move_archive_prefix_tables_to_archive_schema.sql`):  
  `archive.archive_normalized_evidence_links`, `archive.archive_normalized_vulnerabilities`, `archive.archive_source_documents`, `archive.archive_source_statements`.  
  Historical data only.

- **Other tables moved to `archive` schema:**  
  After running `20260203_archive_deprecated_tables.sql` or `archive_unused_tables.ts`, the archive candidates above live in `archive.*` (e.g. `archive.assessment_templates`).

## Migration summary

| Action | CORPUS | RUNTIME |
|--------|--------|--------|
| Move to archive schema | `20260204_move_deprecated_tables_to_archive.sql` (canonical_sources_deprecated, ofc_library_citations_deprecated, documents; view public.documents for compatibility) | `20260203_archive_deprecated_tables.sql` or `tools/archive_unused_tables.ts` |
| Create archive tables | `20260127_create_archive_tables_for_orphaned_module_data.sql` | Schema created in same migration as move |

## Recommendations

1. Use `config/db_schema_status.json` when adding or removing deprecated/archive tables.
2. After archiving RUNTIME tables, add `archive.<table_name>` to `db_ownership.json` → `owners` with pool `RUNTIME` if pool guards need to allow access.
3. Do not use deprecated or archive tables for new development.
4. Set a retention period (e.g. 6–12 months) before considering dropping archive tables.
