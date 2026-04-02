#!/usr/bin/env tsx
/**
 * Audit script to identify legacy V1 tables in CORPUS and RUNTIME databases.
 * 
 * Scans both databases for table metadata and codebase for references.
 * Flags tables as "likely legacy" if they're unused and have no dependencies.
 * 
 * Usage:
 *   npx tsx tools/db/audit_legacy_v1_tables.ts
 * 
 * Outputs:
 *   - analytics/reports/legacy_v1_audit_corpus.json
 *   - analytics/reports/legacy_v1_audit_runtime.json
 *   - analytics/reports/legacy_v1_candidates.md
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Load environment variables from .env.local (relative to project root)
dotenv.config({ path: '.env.local' });

import { getCorpusPool } from "../../app/lib/db/corpus_client";
import { getRuntimePool } from "../../app/lib/db/runtime_client";

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

async function inventoryTables(pool: any, dbName: string): Promise<TableInventory[]> {
  const query = `
    WITH tbl AS (
      SELECT
        n.nspname AS schema,
        c.relname AS table,
        c.reltuples::bigint AS est_rows,
        pg_total_relation_size(c.oid) AS bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
    ),
    fk AS (
      SELECT
        tc.table_schema AS schema,
        tc.table_name AS table,
        count(*) AS fk_out_count
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      GROUP BY 1,2
    ),
    ref AS (
      SELECT
        ccu.table_schema AS schema,
        ccu.table_name AS table,
        count(*) AS fk_in_count
      FROM information_schema.referential_constraints rc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = rc.unique_constraint_name
       AND ccu.constraint_schema = rc.unique_constraint_schema
      WHERE ccu.table_schema = 'public'
      GROUP BY 1,2
    ),
    cols AS (
      SELECT
        table_schema AS schema,
        table_name AS table,
        bool_or(column_name='created_at') AS has_created_at,
        bool_or(column_name='updated_at') AS has_updated_at
      FROM information_schema.columns
      WHERE table_schema='public'
      GROUP BY 1,2
    )
    SELECT
      t.schema,
      t.table,
      t.est_rows,
      t.bytes,
      coalesce(fk.fk_out_count,0) AS fk_out_count,
      coalesce(r.fk_in_count,0) AS fk_in_count,
      coalesce(cols.has_created_at,false) AS has_created_at,
      coalesce(cols.has_updated_at,false) AS has_updated_at
    FROM tbl t
    LEFT JOIN fk ON fk.schema=t.schema AND fk.table=t.table
    LEFT JOIN ref r ON r.schema=t.schema AND r.table=t.table
    LEFT JOIN cols ON cols.schema=t.schema AND cols.table=t.table
    ORDER BY t.bytes DESC, t.table
  `;
  
  const result = await pool.query(query);
  const tables: TableInventory[] = [];
  
  for (const row of result.rows) {
    // Get actual row count for small tables, estimate for large ones
    let actualRowCount: number | null = null;
    if (row.est_rows < 10000) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${row.schema}.${row.table}`);
        actualRowCount = parseInt(countResult.rows[0]?.count || '0', 10);
      } catch (error) {
        // If count fails, use estimate
        actualRowCount = row.est_rows;
      }
    }
    
    // Get newest timestamp if created_at/updated_at exist
    let newestTimestamp: string | null = null;
    if (row.has_created_at || row.has_updated_at) {
      try {
        const timestampCols: string[] = [];
        if (row.has_created_at) timestampCols.push('created_at');
        if (row.has_updated_at) timestampCols.push('updated_at');
        
        let maxQuery: string;
        if (timestampCols.length === 1) {
          maxQuery = `SELECT MAX(${timestampCols[0]}) as newest FROM ${row.schema}.${row.table}`;
        } else {
          maxQuery = `SELECT MAX(greatest(${timestampCols.join(', ')})) as newest FROM ${row.schema}.${row.table}`;
        }
        
        const timestampResult = await pool.query(maxQuery);
        newestTimestamp = timestampResult.rows[0]?.newest ? 
          new Date(timestampResult.rows[0].newest).toISOString() : null;
      } catch (error) {
        // Ignore timestamp errors
      }
    }
    
    tables.push({
      schema: row.schema,
      table: row.table,
      est_rows: row.est_rows,
      bytes: parseInt(row.bytes, 10),
      fk_out_count: parseInt(row.fk_out_count, 10),
      fk_in_count: parseInt(row.fk_in_count, 10),
      has_created_at: row.has_created_at,
      has_updated_at: row.has_updated_at,
      newest_timestamp: newestTimestamp,
      code_refs: 0, // Will be filled by code scan
      code_ref_locations: [], // Will be filled by code scan
      likely_legacy: false, // Will be determined after code scan
      legacy_reason: [], // Will be filled after analysis
    });
  }
  
  return tables;
}

function scanCodebaseForTableReferences(tableName: string, baseDir: string = process.cwd()): { count: number; locations: string[] } {
  const locations: string[] = [];
  const searchPatterns = [
    `"public.${tableName}"`,
    `'public.${tableName}'`,
    `\`public.${tableName}\``,
    `from public.${tableName}`,
    `FROM public.${tableName}`,
    `.from('${tableName}')`,
    `.from("${tableName}")`,
    `insert into ${tableName}`,
    `INSERT INTO ${tableName}`,
    `update ${tableName}`,
    `UPDATE ${tableName}`,
    `table_name = '${tableName}'`,
    `table_name = "${tableName}"`,
    `tableName: '${tableName}'`,
    `tableName: "${tableName}"`,
  ];
  
  const searchDirs = ['app', 'tools', 'scripts', 'migrations'];
  const allMatches = new Set<string>();
  
  for (const pattern of searchPatterns) {
    for (const dir of searchDirs) {
      const dirPath = path.join(baseDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      
      try {
        // Use ripgrep if available, fallback to grep
        let command: string;
        try {
          execSync('rg --version', { stdio: 'ignore' });
          command = `rg -n "${pattern.replace(/"/g, '\\"')}" "${dirPath}" --type-add 'sql:*.sql' --type sql --type ts --type tsx --type js --type jsx 2>/dev/null || true`;
        } catch {
          command = `grep -rn "${pattern}" "${dirPath}" 2>/dev/null || true`;
        }
        
        const output = execSync(command, { 
          encoding: 'utf-8',
          cwd: baseDir,
          stdio: ['ignore', 'pipe', 'ignore']
        });
        
        if (output.trim()) {
          const lines = output.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              allMatches.add(line.trim());
            }
          }
        }
      } catch (error) {
        // Ignore search errors (file not found, etc.)
      }
    }
  }
  
  return {
    count: allMatches.size,
    locations: Array.from(allMatches).slice(0, 50), // Limit to 50 locations
  };
}

function determineLegacyStatus(table: TableInventory): { likely_legacy: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let likelyLegacy = false;
  
  // Check if table has no code references
  if (table.code_refs === 0) {
    reasons.push('No code references found');
  }
  
  // Check if nothing depends on it (no incoming FKs)
  if (table.fk_in_count === 0) {
    reasons.push('No incoming foreign keys (nothing depends on it)');
  }
  
  // Check if table is empty
  const rowCount = table.est_rows;
  if (rowCount === 0) {
    reasons.push('Zero row count');
  }
  
  // Check if no recent activity (if timestamps exist)
  if (table.newest_timestamp) {
    const newestDate = new Date(table.newest_timestamp);
    const daysSinceUpdate = (Date.now() - newestDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 90) {
      reasons.push(`No updates in ${Math.floor(daysSinceUpdate)} days`);
    }
  }
  
  // Conservative: Only flag as legacy if:
  // 1. No code references AND
  // 2. No dependencies (fk_in_count = 0) AND
  // 3. Either zero rows OR no recent timestamps
  if (table.code_refs === 0 && table.fk_in_count === 0) {
    if (rowCount === 0 || (table.newest_timestamp && new Date(table.newest_timestamp).getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000)) {
      likelyLegacy = true;
    }
  }
  
  return { likely_legacy: likelyLegacy, reasons };
}

async function auditDatabase(pool: any, dbName: string): Promise<LegacyAuditReport> {
  console.log(`\n📊 Auditing ${dbName} database...`);
  
  const tables = await inventoryTables(pool, dbName);
  console.log(`   Found ${tables.length} tables`);
  
  // Scan codebase for each table
  console.log(`   Scanning codebase for table references...`);
  for (const table of tables) {
    const refs = scanCodebaseForTableReferences(table.table);
    table.code_refs = refs.count;
    table.code_ref_locations = refs.locations;
    
    if (refs.count > 0) {
      console.log(`     ${table.table}: ${refs.count} references`);
    }
  }
  
  // Determine legacy status
  console.log(`   Analyzing legacy candidates...`);
  for (const table of tables) {
    const { likely_legacy, reasons } = determineLegacyStatus(table);
    table.likely_legacy = likely_legacy;
    table.legacy_reason = reasons;
    
    if (likely_legacy) {
      console.log(`     ⚠️  ${table.table}: likely legacy (${reasons.join(', ')})`);
    }
  }
  
  // Calculate summary
  const summary = {
    total_tables: tables.length,
    likely_legacy_count: tables.filter(t => t.likely_legacy).length,
    zero_row_count: tables.filter(t => t.est_rows === 0).length,
    no_code_refs: tables.filter(t => t.code_refs === 0).length,
    no_dependencies: tables.filter(t => t.fk_in_count === 0).length,
  };
  
  return {
    generated_at: new Date().toISOString(),
    database: dbName,
    tables,
    summary,
  };
}

function generateMarkdownReport(corpusReport: LegacyAuditReport, runtimeReport: LegacyAuditReport): string {
  const lines: string[] = [];
  
  lines.push("# Legacy V1 Tables Audit Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  
  lines.push("## Summary");
  lines.push("");
  lines.push("### CORPUS Database");
  lines.push(`- Total tables: ${corpusReport.summary.total_tables}`);
  lines.push(`- Likely legacy: ${corpusReport.summary.likely_legacy_count}`);
  lines.push(`- Zero row count: ${corpusReport.summary.zero_row_count}`);
  lines.push(`- No code references: ${corpusReport.summary.no_code_refs}`);
  lines.push(`- No dependencies: ${corpusReport.summary.no_dependencies}`);
  lines.push("");
  
  lines.push("### RUNTIME Database");
  lines.push(`- Total tables: ${runtimeReport.summary.total_tables}`);
  lines.push(`- Likely legacy: ${runtimeReport.summary.likely_legacy_count}`);
  lines.push(`- Zero row count: ${runtimeReport.summary.zero_row_count}`);
  lines.push(`- No code references: ${runtimeReport.summary.no_code_refs}`);
  lines.push(`- No dependencies: ${runtimeReport.summary.no_dependencies}`);
  lines.push("");
  
  // CORPUS legacy candidates
  const corpusLegacy = corpusReport.tables.filter(t => t.likely_legacy);
  if (corpusLegacy.length > 0) {
    lines.push("## CORPUS Legacy Candidates");
    lines.push("");
    lines.push("| Table | Rows | Size | Code Refs | FK In | FK Out | Reasons |");
    lines.push("|-------|------|------|-----------|-------|--------|---------|");
    for (const table of corpusLegacy) {
      const sizeMB = (table.bytes / 1024 / 1024).toFixed(2);
      const reasons = table.legacy_reason.join('; ');
      lines.push(`| \`${table.table}\` | ${table.est_rows} | ${sizeMB} MB | ${table.code_refs} | ${table.fk_in_count} | ${table.fk_out_count} | ${reasons} |`);
    }
    lines.push("");
  }
  
  // RUNTIME legacy candidates
  const runtimeLegacy = runtimeReport.tables.filter(t => t.likely_legacy);
  if (runtimeLegacy.length > 0) {
    lines.push("## RUNTIME Legacy Candidates");
    lines.push("");
    lines.push("| Table | Rows | Size | Code Refs | FK In | FK Out | Reasons |");
    lines.push("|-------|------|------|-----------|-------|--------|---------|");
    for (const table of runtimeLegacy) {
      const sizeMB = (table.bytes / 1024 / 1024).toFixed(2);
      const reasons = table.legacy_reason.join('; ');
      lines.push(`| \`${table.table}\` | ${table.est_rows} | ${sizeMB} MB | ${table.code_refs} | ${table.fk_in_count} | ${table.fk_out_count} | ${reasons} |`);
    }
    lines.push("");
  }
  
  // All tables with zero code refs (for manual review)
  const allZeroRefs = [
    ...corpusReport.tables.filter(t => t.code_refs === 0 && !t.likely_legacy).map(t => ({ ...t, db: 'CORPUS' })),
    ...runtimeReport.tables.filter(t => t.code_refs === 0 && !t.likely_legacy).map(t => ({ ...t, db: 'RUNTIME' })),
  ];
  
  if (allZeroRefs.length > 0) {
    lines.push("## Tables with Zero Code References (Manual Review Recommended)");
    lines.push("");
    lines.push("These tables have no code references but may still be in use:");
    lines.push("");
    lines.push("| Database | Table | Rows | FK In | FK Out |");
    lines.push("|----------|-------|------|-------|--------|");
    for (const table of allZeroRefs) {
      lines.push(`| ${table.db} | \`${table.table}\` | ${table.est_rows} | ${table.fk_in_count} | ${table.fk_out_count} |`);
    }
    lines.push("");
  }
  
  lines.push("## Recommendations");
  lines.push("");
  lines.push("1. **Review legacy candidates** - Verify they are truly unused");
  lines.push("2. **Run quarantine script** - `npm run db:legacy-quarantine-sql`");
  lines.push("3. **Apply quarantine SQL** - Rename tables to `legacy_v1__*`");
  lines.push("4. **Test application** - Run for a day to ensure nothing breaks");
  lines.push("5. **Generate drop script** - After validation, create DROP statements");
  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  lines.push("```bash");
  lines.push("# Generate quarantine SQL");
  lines.push("npm run db:legacy-quarantine-sql");
  lines.push("");
  lines.push("# Review generated SQL files:");
  lines.push("# - analytics/reports/quarantine_corpus.sql");
  lines.push("# - analytics/reports/quarantine_runtime.sql");
  lines.push("```");
  
  return lines.join('\n');
}

async function main() {
  try {
    console.log("🔍 Starting legacy V1 tables audit...\n");
    
    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();
    
    const corpusReport = await auditDatabase(corpusPool, 'CORPUS');
    const runtimeReport = await auditDatabase(runtimePool, 'RUNTIME');
    
    // Write JSON reports
    const reportsDir = path.join(process.cwd(), 'analytics', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const corpusReportPath = path.join(reportsDir, 'legacy_v1_audit_corpus.json');
    const runtimeReportPath = path.join(reportsDir, 'legacy_v1_audit_runtime.json');
    const markdownPath = path.join(reportsDir, 'legacy_v1_candidates.md');
    
    fs.writeFileSync(corpusReportPath, JSON.stringify(corpusReport, null, 2));
    fs.writeFileSync(runtimeReportPath, JSON.stringify(runtimeReport, null, 2));
    
    const markdownReport = generateMarkdownReport(corpusReport, runtimeReport);
    fs.writeFileSync(markdownPath, markdownReport);
    
    console.log(`\n✅ Audit complete!`);
    console.log(`   - ${corpusReportPath}`);
    console.log(`   - ${runtimeReportPath}`);
    console.log(`   - ${markdownPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   CORPUS: ${corpusReport.summary.likely_legacy_count} likely legacy tables`);
    console.log(`   RUNTIME: ${runtimeReport.summary.likely_legacy_count} likely legacy tables`);
    
  } catch (error) {
    console.error("\n❌ Fatal error during audit:", error);
    process.exit(1);
  }
}

main();
