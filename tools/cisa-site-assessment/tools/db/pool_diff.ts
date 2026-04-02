#!/usr/bin/env tsx
/**
 * Pool diff script: compares schema + row counts between CORPUS and RUNTIME databases.
 * 
 * Usage:
 *   npx tsx tools/db/pool_diff.ts
 * 
 * Outputs:
 *   analytics/reports/pool_diff_report.json
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local (relative to project root)
dotenv.config({ path: '.env.local' });

import { getCorpusPool } from "../../app/lib/db/corpus_client";
import { getRuntimePool } from "../../app/lib/db/runtime_client";
import poolOwnership from "./pool_ownership.json";

interface TableInfo {
  exists: boolean;
  row_count: number | null;
  primary_key_columns: string[];
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  check_constraints: Array<{
    name: string;
    definition: string;
  }>;
  foreign_keys: Array<{
    name: string;
    constraint_name: string;
    referenced_table: string;
    referenced_columns: string[];
    columns: string[];
  }>;
  indexes: Array<{
    name: string;
    definition: string;
    unique: boolean;
  }>;
  created_at_range: {
    min: string | null;
    max: string | null;
  } | null;
  sample_ids: string[] | null;
}

interface PoolDiffReport {
  generated_at: string;
  tables: Record<string, {
    corpus: TableInfo;
    runtime: TableInfo;
  }>;
}

async function getTableInfo(pool: any, schema: string, table: string): Promise<TableInfo> {
  const fullTableName = `${schema}.${table}`;
  
  // Check if table exists
  const existsResult = await pool.query(`
    SELECT to_regclass($1) as reg
  `, [fullTableName]);
  const exists = !!existsResult.rows[0]?.reg;
  
  if (!exists) {
    return {
      exists: false,
      row_count: null,
      primary_key_columns: [],
      columns: [],
      check_constraints: [],
      foreign_keys: [],
      indexes: [],
      created_at_range: null,
      sample_ids: null,
    };
  }
  
  // Get row count
  let rowCount: number | null = null;
  try {
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${fullTableName}`);
    rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
  } catch (error) {
    console.warn(`  Warning: Could not get row count for ${fullTableName}: ${error}`);
  }
  
  // Get columns
  const columnsResult = await pool.query(`
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);
  
  const columns = columnsResult.rows.map((row: any) => ({
    name: row.column_name,
    type: row.data_type,
    nullable: row.is_nullable === 'YES',
  }));
  
  // Get primary key columns
  const pkResult = await pool.query(`
    SELECT 
      a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    ORDER BY a.attnum
  `, [fullTableName]);
  
  const primaryKeyColumns = pkResult.rows.map((row: any) => row.column_name);
  
  // Get check constraints
  const checkResult = await pool.query(`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass
      AND contype = 'c'
  `, [fullTableName]);
  
  const checkConstraints = checkResult.rows.map((row: any) => ({
    name: row.constraint_name,
    definition: row.definition,
  }));
  
  // Get foreign keys
  const fkResult = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
  `, [schema, table]);
  
  // Group foreign keys by constraint name
  const fkMap = new Map<string, any>();
  for (const row of fkResult.rows) {
    if (!fkMap.has(row.constraint_name)) {
      fkMap.set(row.constraint_name, {
        name: row.constraint_name,
        constraint_name: row.constraint_name,
        referenced_table: `${row.foreign_table_schema}.${row.foreign_table_name}`,
        referenced_columns: [],
        columns: [],
      });
    }
    const fk = fkMap.get(row.constraint_name)!;
    fk.columns.push(row.column_name);
    fk.referenced_columns.push(row.foreign_column_name);
  }
  
  const foreignKeys = Array.from(fkMap.values());
  
  // Get indexes
  const indexResult = await pool.query(`
    SELECT
      indexname as name,
      indexdef as definition,
      indexdef LIKE '%UNIQUE%' as is_unique
    FROM pg_indexes
    WHERE schemaname = $1 AND tablename = $2
    ORDER BY indexname
  `, [schema, table]);
  
  const indexes = indexResult.rows.map((row: any) => ({
    name: row.name,
    definition: row.definition,
    unique: row.is_unique || false,
  }));
  
  // Check if created_at column exists and get range
  let createdAtRange: { min: string | null; max: string | null } | null = null;
  const hasCreatedAt = columns.some((col) => col.name === 'created_at');
  if (hasCreatedAt) {
    try {
      const createdAtResult = await pool.query(`
        SELECT 
          MIN(created_at) as min_created_at,
          MAX(created_at) as max_created_at
        FROM ${fullTableName}
      `);
      const row = createdAtResult.rows[0];
      createdAtRange = {
        min: row?.min_created_at ? new Date(row.min_created_at).toISOString() : null,
        max: row?.max_created_at ? new Date(row.max_created_at).toISOString() : null,
      };
    } catch (error) {
      console.warn(`  Warning: Could not get created_at range for ${fullTableName}: ${error}`);
    }
  }
  
  // Get sample IDs if id column exists
  let sampleIds: string[] | null = null;
  const hasId = columns.some((col) => col.name === 'id');
  if (hasId && rowCount !== null && rowCount > 0) {
    try {
      const idResult = await pool.query(`
        SELECT id FROM ${fullTableName} ORDER BY id LIMIT 3
      `);
      sampleIds = idResult.rows.map((row: any) => String(row.id));
    } catch (error) {
      console.warn(`  Warning: Could not get sample IDs for ${fullTableName}: ${error}`);
    }
  }
  
  return {
    exists: true,
    row_count: rowCount,
    primary_key_columns: primaryKeyColumns,
    columns,
    check_constraints: checkConstraints,
    foreign_keys: foreignKeys,
    indexes,
    created_at_range: createdAtRange,
    sample_ids: sampleIds,
  };
}

async function main() {
  try {
    console.log("🔍 Comparing CORPUS vs RUNTIME database schemas...\n");
    
    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();
    
    // Tables to check: all tables from ownership mapping
    const tablesToCheck = [
      "public.ofc_candidate_queue",
      "public.ofc_candidate_targets",
      "public.ofc_library_citations",
      "public.corpus_expansion_questions",
      "public.corpus_documents",
      "public.document_chunks",
      "public.source_registry",
      "public.disciplines",
      "public.discipline_subtypes",
      "public.expansion_questions",
      "public.assessments",
      "public.assessment_responses",
      "public.baseline_spines_runtime",
    ];
    
    const report: PoolDiffReport = {
      generated_at: new Date().toISOString(),
      tables: {},
    };
    
    for (const fullTableName of tablesToCheck) {
      const [schema, table] = fullTableName.split('.');
      console.log(`📊 Analyzing ${fullTableName}...`);
      
      const corpusInfo = await getTableInfo(corpusPool, schema, table);
      const runtimeInfo = await getTableInfo(runtimePool, schema, table);
      
      report.tables[fullTableName] = {
        corpus: corpusInfo,
        runtime: runtimeInfo,
      };
      
      console.log(`  CORPUS: ${corpusInfo.exists ? `exists (${corpusInfo.row_count} rows)` : 'missing'}`);
      console.log(`  RUNTIME: ${runtimeInfo.exists ? `exists (${runtimeInfo.row_count} rows)` : 'missing'}`);
    }
    
    // Write report
    const reportPath = path.join(process.cwd(), 'analytics', 'reports', 'pool_diff_report.json');
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report written to: ${reportPath}`);
    
  } catch (error) {
    console.error("\n❌ Fatal error during pool diff:", error);
    process.exit(1);
  }
}

main();
