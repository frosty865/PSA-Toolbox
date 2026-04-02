#!/usr/bin/env tsx
/**
 * Comprehensive database schema review.
 * 
 * Checks for:
 * - Inconsistencies between ownership configs
 * - Missing tables
 * - Orphaned tables
 * - Foreign key issues
 * - Schema documentation gaps
 * 
 * Usage:
 *   npx tsx tools/db/review_schema.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

import ownershipConfig from '../../config/db_ownership.json';
import tableMapConfig from '../../config/db_table_map.json';
import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';

// Bypass read-only guard for schema inspection
function getCorpusPoolDirect() {
  const pool = getCorpusPool();
  // Create a wrapper that bypasses read-only checks for SELECT queries
  return {
    query: async (text: string, params?: any[]) => {
      // Only allow SELECT queries for inspection
      if (!text.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries allowed for schema review');
      }
      return (pool as any).query(text, params);
    },
    end: () => pool.end()
  };
}

interface TableInfo {
  table_name: string;
  exists: boolean;
  row_count?: number;
  columns?: string[];
}

async function getTableInfo(pool: any, schema: string, table: string): Promise<TableInfo> {
  try {
    const existsResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      ) as exists
    `, [schema, table]);
    
    const exists = existsResult.rows[0]?.exists || false;
    
    if (!exists) {
      return { table_name: table, exists: false };
    }
    
    // Get row count
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${schema}.${table}`);
    const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
    
    // Get columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, table]);
    
    const columns = columnsResult.rows.map((r: any) => 
      `${r.column_name} (${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''})`
    );
    
    return {
      table_name: table,
      exists: true,
      row_count: rowCount,
      columns
    };
  } catch (error: any) {
    return {
      table_name: table,
      exists: false,
    };
  }
}

async function getAllTables(pool: any, schema: string = 'public'): Promise<string[]> {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schema]);
  
  return result.rows.map((r: any) => r.table_name);
}

async function main() {
  try {
    console.log("🔍 Comprehensive Schema Review\n");
    console.log("=" .repeat(80));
    
    const corpusPool = getCorpusPoolDirect();
    const runtimePool = getRuntimePool();
    
    // Get all tables from both databases (public schema)
    const corpusTables = await getAllTables(corpusPool);
    const runtimeTablesPublic = await getAllTables(runtimePool);
    // RUNTIME also has archive schema; include those table names for existence checks
    const runtimeTablesArchive = await getAllTables(runtimePool, 'archive');
    const runtimeTables = [...new Set([...runtimeTablesPublic, ...runtimeTablesArchive])];
    const allTables = new Set([...corpusTables, ...runtimeTables]);
    
    console.log("\n📊 Database Inventory:");
    console.log(`  CORPUS tables: ${corpusTables.length}`);
    console.log(`  RUNTIME tables: ${runtimeTablesPublic.length} (public) + ${runtimeTablesArchive.length} (archive) = ${runtimeTables.length} unique names`);
    console.log(`  Total unique tables: ${allTables.size}`);
    
    // Check ownership config consistency
    console.log("\n📋 Ownership Config Review:");
    const ownershipIssues: string[] = [];
    const ownershipTables = new Set(Object.keys(ownershipConfig.owners));
    
    for (const [fullTableName, expectedOwner] of Object.entries(ownershipConfig.owners)) {
      const [schema, table] = fullTableName.split('.');
      const inCorpus = schema === 'public' && corpusTables.includes(table);
      const inRuntime = (schema === 'public' && runtimeTablesPublic.includes(table)) ||
        (schema === 'archive' && runtimeTablesArchive.includes(table));
      
      if (expectedOwner === 'CORPUS' && !inCorpus) {
        ownershipIssues.push(`  ❌ ${table}: Expected in CORPUS but missing`);
      } else if (expectedOwner === 'CORPUS' && inRuntime) {
        ownershipIssues.push(`  ❌ ${table}: Expected CORPUS only but also in RUNTIME`);
      } else if (expectedOwner === 'RUNTIME' && !inRuntime) {
        ownershipIssues.push(`  ❌ ${table}: Expected in RUNTIME but missing`);
      } else if (expectedOwner === 'RUNTIME' && inCorpus) {
        ownershipIssues.push(`  ❌ ${table}: Expected RUNTIME only but also in CORPUS`);
      }
    }
    
    if (ownershipIssues.length === 0) {
      console.log("  ✅ All tables in ownership config are correctly placed");
    } else {
      console.log("  Issues found:");
      ownershipIssues.forEach(issue => console.log(issue));
    }
    
    // Check for tables not in ownership config (by schema.table)
    console.log("\n🔎 Unmapped Tables:");
    const unmapped: string[] = [];
    const existingByPool: Array<{ schema: string; table: string; location: string }> = [
      ...corpusTables.map((table) => ({ schema: 'public', table, location: 'CORPUS' })),
      ...runtimeTablesPublic.map((table) => ({ schema: 'public', table, location: 'RUNTIME' })),
      ...runtimeTablesArchive.map((table) => ({ schema: 'archive', table, location: 'RUNTIME' })),
    ];
    for (const { schema, table, location } of existingByPool) {
      const fullName = `${schema}.${table}`;
      if (!ownershipConfig.owners[fullName]) {
        unmapped.push(`  ⚠️  ${table} (${location}) - Not in ownership config`);
      }
    }
    
    if (unmapped.length === 0) {
      console.log("  ✅ All tables are mapped in ownership config");
    } else {
      console.log(`  Found ${unmapped.length} unmapped tables:`);
      unmapped.slice(0, 20).forEach(table => console.log(table));
      if (unmapped.length > 20) {
        console.log(`  ... and ${unmapped.length - 20} more`);
      }
    }
    
    // Check db_table_map.json vs db_ownership.json consistency
    console.log("\n🔄 Config Consistency Check:");
    const tableMapTables = new Set(
      tableMapConfig.tables.map((t: any) => `${t.schema}.${t.table}`)
    );
    const ownershipOnly = [...ownershipTables].filter(t => !tableMapTables.has(t));
    const tableMapOnly = [...tableMapTables].filter(t => !ownershipTables.has(t));
    
    if (ownershipOnly.length > 0) {
      console.log(`  ⚠️  ${ownershipOnly.length} tables in ownership.json but not in table_map.json:`);
      ownershipOnly.slice(0, 10).forEach(t => console.log(`     - ${t}`));
    }
    
    if (tableMapOnly.length > 0) {
      console.log(`  ⚠️  ${tableMapOnly.length} tables in table_map.json but not in ownership.json:`);
      tableMapOnly.slice(0, 10).forEach(t => console.log(`     - ${t}`));
    }
    
    if (ownershipOnly.length === 0 && tableMapOnly.length === 0) {
      console.log("  ✅ Configs are consistent");
    }
    
    // Check for legacy-named tables (names suggesting deprecated/legacy; archive schema is in db_schema_status.json)
    console.log("\n🗄️  Legacy / deprecated-named tables:");
    const deprecated = [...allTables].filter(t => 
      t.includes('deprecated') || 
      t.includes('legacy') ||
      t.startsWith('old_')
    );
    
    if (deprecated.length > 0) {
      deprecated.forEach(t => {
        const inCorpus = corpusTables.includes(t);
        const inRuntime = runtimeTables.includes(t);
        const location = inCorpus && inRuntime ? 'BOTH' : inCorpus ? 'CORPUS' : 'RUNTIME';
        console.log(`  📦 ${t} (${location})`);
      });
    } else {
      console.log("  ✅ No deprecated tables found");
    }
    
    // Check for duplicate table names (shouldn't exist after cleanup)
    console.log("\n🔍 Duplicate Check:");
    const duplicates = corpusTables.filter(t => runtimeTables.includes(t));
    if (duplicates.length === 0) {
      console.log("  ✅ No duplicate tables found");
    } else {
      console.log(`  ❌ Found ${duplicates.length} duplicate tables:`);
      duplicates.forEach(t => {
        const owner = ownershipConfig.owners[`public.${t}`];
        console.log(`     - ${t} (should be ${owner || 'UNKNOWN'} only)`);
      });
    }
    
    // Summary statistics
    console.log("\n📈 Summary:");
    console.log(`  Total tables: ${allTables.size}`);
    console.log(`  Tables in ownership config: ${ownershipTables.size}`);
    console.log(`  Unmapped tables: ${unmapped.length}`);
    console.log(`  Duplicate tables: ${duplicates.length}`);
    console.log(`  Deprecated tables: ${deprecated.length}`);
    console.log(`  Config inconsistencies: ${ownershipOnly.length + tableMapOnly.length}`);
    
    // Recommendations
    console.log("\n💡 Recommendations:");
    if (unmapped.length > 0) {
      console.log("  1. Add unmapped tables to db_ownership.json");
    }
    if (duplicates.length > 0) {
      console.log("  2. Remove duplicate tables from wrong database");
    }
    if (ownershipOnly.length > 0 || tableMapOnly.length > 0) {
      console.log("  3. Sync db_ownership.json and db_table_map.json");
    }
    if (deprecated.length > 0) {
      console.log("  4. Consider archiving or documenting legacy-named tables");
    }
    if (unmapped.length === 0 && duplicates.length === 0 && 
        ownershipOnly.length === 0 && tableMapOnly.length === 0) {
      console.log("  ✅ Schema is clean and well-organized!");
    }
    
    await corpusPool.end();
    await runtimePool.end();
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
