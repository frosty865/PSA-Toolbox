#!/usr/bin/env tsx
/**
 * Generate quarantine SQL scripts for legacy V1 tables.
 * 
 * Creates reversible RENAME statements to quarantine unused tables.
 * Only includes tables with zero code references and zero dependencies.
 * 
 * Usage:
 *   npx tsx tools/db/generate_quarantine_sql.ts
 * 
 * Inputs:
 *   - analytics/reports/legacy_v1_audit_corpus.json
 *   - analytics/reports/legacy_v1_audit_runtime.json
 * 
 * Outputs:
 *   - analytics/reports/quarantine_corpus.sql
 *   - analytics/reports/quarantine_runtime.sql
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Load environment variables from .env.local (relative to project root)
dotenv.config({ path: '.env.local' });

interface TableInventory {
  schema: string;
  table: string;
  est_rows: number;
  bytes: number;
  fk_out_count: number;
  fk_in_count: number;
  has_created_at: boolean;
  has_updated_at: boolean;
  newest_timestamp: string | null;
  code_refs: number;
  code_ref_locations: string[];
  likely_legacy: boolean;
  legacy_reason: string[];
}

interface LegacyAuditReport {
  generated_at: string;
  database: string;
  tables: TableInventory[];
  summary: {
    total_tables: number;
    likely_legacy_count: number;
    zero_row_count: number;
    no_code_refs: number;
    no_dependencies: number;
  };
}

/**
 * Generate a safe legacy table name.
 * PostgreSQL identifier limit is 63 characters.
 * If name would exceed limit, truncate and append hash.
 */
function generateLegacyName(originalName: string): string {
  const prefix = 'legacy_v1__';
  const maxLength = 63;
  const targetName = `${prefix}${originalName}`;
  
  if (targetName.length <= maxLength) {
    return targetName;
  }
  
  // Truncate and append hash
  const hash = crypto.createHash('md5').update(originalName).digest('hex').substring(0, 8);
  const availableLength = maxLength - prefix.length - hash.length - 1; // -1 for underscore
  const truncated = originalName.substring(0, availableLength);
  return `${prefix}${truncated}_${hash}`;
}

function generateQuarantineSQL(report: LegacyAuditReport): string[] {
  const sql: string[] = [];
  
  sql.push("-- ================================================================================");
  sql.push(`-- Quarantine SQL for ${report.database} Database`);
  sql.push("-- Generated: " + new Date().toISOString());
  sql.push("-- ⚠️  REVERSIBLE OPERATIONS ONLY (RENAME, NO DROP) ⚠️");
  sql.push("-- ================================================================================");
  sql.push("");
  sql.push("-- This script quarantines legacy V1 tables by renaming them.");
  sql.push("-- To reverse: ALTER TABLE legacy_v1__<table> RENAME TO <table>;");
  sql.push("");
  
  // Filter tables that meet quarantine criteria:
  // 1. code_refs = 0 (no code references)
  // 2. fk_in_count = 0 (nothing depends on it)
  const quarantineCandidates = report.tables.filter(t => 
    t.code_refs === 0 && t.fk_in_count === 0
  );
  
  if (quarantineCandidates.length === 0) {
    sql.push("-- No tables meet quarantine criteria (zero code refs AND zero dependencies).");
    sql.push("-- All tables either have code references or are referenced by other tables.");
    return sql;
  }
  
  sql.push(`-- Quarantining ${quarantineCandidates.length} table(s):`);
  for (const table of quarantineCandidates) {
    sql.push(`--   - ${table.table} (${table.est_rows} rows, ${table.code_refs} code refs, ${table.fk_in_count} FK in)`);
  }
  sql.push("");
  sql.push("-- BEGIN QUARANTINE OPERATIONS");
  sql.push("");
  
  for (const table of quarantineCandidates) {
    const legacyName = generateLegacyName(table.table);
    const fullTableName = `${table.schema}.${table.table}`;
    const fullLegacyName = `${table.schema}.${legacyName}`;
    
    sql.push(`-- Quarantine: ${table.table}`);
    sql.push(`--   Rows: ${table.est_rows}`);
    sql.push(`--   Size: ${(table.bytes / 1024 / 1024).toFixed(2)} MB`);
    sql.push(`--   Code refs: ${table.code_refs}`);
    sql.push(`--   FK in: ${table.fk_in_count}, FK out: ${table.fk_out_count}`);
    sql.push(`--   Reasons: ${table.legacy_reason.join('; ')}`);
    sql.push(`--   To reverse: ALTER TABLE ${fullLegacyName} RENAME TO ${table.table};`);
    sql.push(`ALTER TABLE ${fullTableName} RENAME TO ${legacyName};`);
    sql.push("");
  }
  
  sql.push("-- END QUARANTINE OPERATIONS");
  sql.push("");
  sql.push("-- Verification queries:");
  sql.push("-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'legacy_v1__%';");
  
  return sql;
}

async function main() {
  try {
    console.log("🔧 Generating quarantine SQL...\n");
    
    const reportsDir = path.join(process.cwd(), 'analytics', 'reports');
    
    // Read audit reports
    const corpusReportPath = path.join(reportsDir, 'legacy_v1_audit_corpus.json');
    const runtimeReportPath = path.join(reportsDir, 'legacy_v1_audit_runtime.json');
    
    if (!fs.existsSync(corpusReportPath)) {
      console.error(`❌ Error: Corpus audit report not found at ${corpusReportPath}`);
      console.error(`   Run 'npm run db:legacy-audit' first.`);
      process.exit(1);
    }
    
    if (!fs.existsSync(runtimeReportPath)) {
      console.error(`❌ Error: Runtime audit report not found at ${runtimeReportPath}`);
      console.error(`   Run 'npm run db:legacy-audit' first.`);
      process.exit(1);
    }
    
    const corpusReport: LegacyAuditReport = JSON.parse(fs.readFileSync(corpusReportPath, 'utf-8'));
    const runtimeReport: LegacyAuditReport = JSON.parse(fs.readFileSync(runtimeReportPath, 'utf-8'));
    
    // Generate quarantine SQL
    const corpusSQL = generateQuarantineSQL(corpusReport);
    const runtimeSQL = generateQuarantineSQL(runtimeReport);
    
    // Write SQL files
    const corpusSQLPath = path.join(reportsDir, 'quarantine_corpus.sql');
    const runtimeSQLPath = path.join(reportsDir, 'quarantine_runtime.sql');
    
    fs.writeFileSync(corpusSQLPath, corpusSQL.join('\n'));
    fs.writeFileSync(runtimeSQLPath, runtimeSQL.join('\n'));
    
    // Count quarantine candidates
    const corpusCandidates = corpusReport.tables.filter(t => t.code_refs === 0 && t.fk_in_count === 0);
    const runtimeCandidates = runtimeReport.tables.filter(t => t.code_refs === 0 && t.fk_in_count === 0);
    
    console.log(`✅ Generated quarantine SQL files:`);
    console.log(`   - ${corpusSQLPath}`);
    console.log(`   - ${runtimeSQLPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   CORPUS: ${corpusCandidates.length} table(s) ready for quarantine`);
    console.log(`   RUNTIME: ${runtimeCandidates.length} table(s) ready for quarantine`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   1. Review SQL files before running`);
    console.log(`   2. These are REVERSIBLE renames (no data loss)`);
    console.log(`   3. Run CORPUS SQL against CORPUS database only`);
    console.log(`   4. Run RUNTIME SQL against RUNTIME database only`);
    console.log(`   5. Test application after quarantine`);
    console.log(`   6. If nothing breaks, generate DROP script later`);
    
  } catch (error) {
    console.error("\n❌ Fatal error during SQL generation:", error);
    process.exit(1);
  }
}

main();
