#!/usr/bin/env python3
"""
Audit script to identify deprecated and unused database tables in CORPUS and RUNTIME databases.
Scans codebase for table references and compares with known deprecated tables.
"""
import os
import re
from pathlib import Path
from collections import defaultdict
import json

# Base directories
PSA_REBUILD = Path(__file__).parent.parent
APP_DIR = PSA_REBUILD / "app"
DB_DIR = PSA_REBUILD / "db"
MIGRATIONS_DIR = DB_DIR / "migrations"

# Known deprecated tables from analysis
DEPRECATED_TABLES = {
    "RUNTIME": [
        "baseline_questions_legacy",
        "baseline_questions",
        "canonical_question_templates",
        "canonical_question_no_map",
        "baseline_responses",
        "assessment_responses",  # Replaced by assessment_question_responses
        "assessment_templates",
        "assessment_vulnerability_sectors",
        "canonical_disciplines",
        "canonical_subtypes",
        "canonical_manifest",
        "canonical_ofc_patterns",
        "canonical_vulnerability_patterns",
        "citation_bindings",
        "citation_requests",
        "compliance_report",
        "document_subtype_relevance",
        "drift_scan",
        "normalized_findings",
        "normalized_ofcs",
        "observed_vulnerabilities",
        "ofc_nomination_decisions",
        "ofc_wipe_log",
        "phase6_reviews",
        "report_snapshots",
        "sector_metrics",
        "subsector_metrics",
        "subdiscipline_sector_filter",
        "subsector_discipline_map",
        "subsector_discipline_weight_history",
        "technology_maturity_definitions",
        "technology_maturity_lookup",
        "user_profiles",
    ],
    "CORPUS": [
        "canonical_sources_deprecated",  # Already renamed
        "ofc_library_citations_deprecated",  # Already renamed
        "documents",  # May be replaced by corpus_documents
    ]
}

# Archive tables (explicitly marked as archive)
ARCHIVE_TABLES = {
    "RUNTIME": [
        "archive_normalized_evidence_links",
        "archive_normalized_vulnerabilities",
        "archive_source_documents",
        "archive_source_statements",
    ]
}

# Active tables (from ownership config)
def load_active_tables():
    """Load active tables from ownership config."""
    ownership_file = PSA_REBUILD / "config" / "db_ownership.json"
    if not ownership_file.exists():
        return {"RUNTIME": [], "CORPUS": []}
    
    with open(ownership_file, 'r') as f:
        config = json.load(f)
    
    active = {"RUNTIME": [], "CORPUS": []}
    for table, pool in config.get("owners", {}).items():
        table_name = table.split(".")[-1]  # Remove schema prefix
        if pool in active:
            active[pool].append(table_name)
    
    return active

def find_table_references(table_name):
    """Find references to a table in the codebase."""
    references = []
    
    # Patterns to search for
    patterns = [
        f"FROM {table_name}",
        f"JOIN {table_name}",
        f"INTO {table_name}",
        f"UPDATE {table_name}",
        f"DELETE FROM {table_name}",
        f"INSERT INTO {table_name}",
        f'"{table_name}"',
        f"'{table_name}'",
        f"`{table_name}`",
        f"table_name = '{table_name}'",
        f"table_name = \"{table_name}\"",
    ]
    
    for file_path in APP_DIR.rglob("*.{ts,tsx,js,jsx,sql}"):
        if "node_modules" in str(file_path) or ".next" in str(file_path):
            continue
        
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            for pattern in patterns:
                if pattern.lower() in content.lower():
                    # Find line numbers
                    for i, line in enumerate(content.split("\n"), 1):
                        if pattern.lower() in line.lower():
                            references.append({
                                "file": str(file_path.relative_to(PSA_REBUILD)),
                                "line": i,
                                "context": line.strip()[:100]
                            })
                            break  # Only count once per file
        except Exception:
            pass  # Skip unreadable files
    
    return references

def check_migration_files(table_name):
    """Check if table is mentioned in migration files."""
    migrations = []
    for migration_file in MIGRATIONS_DIR.rglob("*.sql"):
        try:
            content = migration_file.read_text(encoding='utf-8', errors='ignore')
            if table_name.lower() in content.lower():
                migrations.append(str(migration_file.relative_to(PSA_REBUILD)))
        except Exception:
            pass
    return migrations

def main():
    print("=" * 80)
    print("Database Table Audit - CORPUS and RUNTIME")
    print("=" * 80)
    print()
    
    active_tables = load_active_tables()
    
    all_deprecated = []
    all_unused = []
    all_archive = []
    
    # Check deprecated tables
    for pool in ["RUNTIME", "CORPUS"]:
        print(f"\n{'=' * 80}")
        print(f"Checking {pool} Database")
        print(f"{'=' * 80}\n")
        
        deprecated_list = DEPRECATED_TABLES.get(pool, [])
        archive_list = ARCHIVE_TABLES.get(pool, [])
        active_list = active_tables.get(pool, [])
        
        for table in deprecated_list:
            refs = find_table_references(table)
            migrations = check_migration_files(table)
            
            status = "DEPRECATED"
            if len(refs) > 0:
                status += " (still referenced)"
            
            all_deprecated.append({
                "pool": pool,
                "table": table,
                "status": status,
                "references": len(refs),
                "migrations": migrations,
                "ref_details": refs[:5]  # First 5 references
            })
            
            print(f"{table}")
            print(f"  Status: {status}")
            print(f"  References: {len(refs)}")
            if refs:
                for ref in refs[:3]:
                    print(f"    - {ref['file']}:{ref['line']}")
            if migrations:
                print(f"  Migrations: {len(migrations)}")
            print()
        
        # Check archive tables
        for table in archive_list:
            all_archive.append({
                "pool": pool,
                "table": table,
                "status": "ARCHIVE"
            })
            print(f"{table} [ARCHIVE TABLE]")
            print()
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Deprecated Tables: {len(all_deprecated)}")
    print(f"  RUNTIME: {len([t for t in all_deprecated if t['pool'] == 'RUNTIME'])}")
    print(f"  CORPUS: {len([t for t in all_deprecated if t['pool'] == 'CORPUS'])}")
    print(f"Archive Tables: {len(all_archive)}")
    
    # Write report
    report_file = PSA_REBUILD / "docs" / "TABLE_AUDIT_REPORT.md"
    with open(report_file, "w") as f:
        f.write("# Database Table Audit Report\n\n")
        f.write(f"**Generated:** {Path(__file__).stat().st_mtime}\n\n")
        f.write(f"**Total Deprecated Tables:** {len(all_deprecated)}\n")
        f.write(f"- RUNTIME: {len([t for t in all_deprecated if t['pool'] == 'RUNTIME'])}\n")
        f.write(f"- CORPUS: {len([t for t in all_deprecated if t['pool'] == 'CORPUS'])}\n\n")
        
        f.write("## Deprecated Tables\n\n")
        for item in all_deprecated:
            f.write(f"### {item['pool']}.{item['table']}\n")
            f.write(f"- **Status:** {item['status']}\n")
            f.write(f"- **References:** {item['references']}\n")
            if item['ref_details']:
                f.write("- **Still Referenced In:**\n")
                for ref in item['ref_details']:
                    f.write(f"  - `{ref['file']}:{ref['line']}`\n")
            if item['migrations']:
                f.write("- **Migrations:**\n")
                for mig in item['migrations']:
                    f.write(f"  - `{mig}`\n")
            f.write("\n")
        
        f.write("## Archive Tables\n\n")
        for item in all_archive:
            f.write(f"- **{item['pool']}.{item['table']}** - {item['status']}\n")
    
    print(f"\nReport written to: {report_file}")

if __name__ == "__main__":
    main()
