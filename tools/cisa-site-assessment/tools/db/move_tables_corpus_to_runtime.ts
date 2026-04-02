#!/usr/bin/env tsx
/**
 * Copy tables from CORPUS to RUNTIME database
 * 
 * Copies:
 * - canonical_sources
 * - ofc_library_citations
 * 
 * Usage:
 *   npx tsx tools/db/move_tables_corpus_to_runtime.ts [--dry-run]
 * 
 * Exit codes:
 *   0 - Success
 *   1 - Error or data mismatch
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';

const BATCH_SIZE = 1000;
const DRY_RUN = process.argv.includes('--dry-run');

interface CopyResult {
  table: string;
  corpusCount: number;
  insertedCount: number;
  runtimeCountBefore: number;
  runtimeCountAfter: number;
  errors: string[];
}

async function copyTable(
  corpusPool: any,
  runtimePool: any,
  tableName: string,
  columns: string[],
  primaryKey: string[]
): Promise<CopyResult> {
  const result: CopyResult = {
    table: tableName,
    corpusCount: 0,
    insertedCount: 0,
    runtimeCountBefore: 0,
    runtimeCountAfter: 0,
    errors: [],
  };
  
  console.log(`\n📋 Processing ${tableName}...`);
  
  try {
    // Get count from CORPUS
    const corpusCountResult = await corpusPool.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
    result.corpusCount = parseInt(corpusCountResult.rows[0]?.count || '0', 10);
    console.log(`  CORPUS count: ${result.corpusCount}`);
    
    // Get count from RUNTIME before
    const runtimeBeforeResult = await runtimePool.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
    result.runtimeCountBefore = parseInt(runtimeBeforeResult.rows[0]?.count || '0', 10);
    console.log(`  RUNTIME count (before): ${result.runtimeCountBefore}`);
    
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would copy ${result.corpusCount} rows`);
      result.insertedCount = result.corpusCount;
      result.runtimeCountAfter = result.runtimeCountBefore + result.corpusCount;
      return result;
    }
    
    if (result.corpusCount === 0) {
      console.log(`  ✓ No rows to copy`);
      result.runtimeCountAfter = result.runtimeCountBefore;
      return result;
    }
    
    // Build column list and placeholders
    const columnList = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    // Copy in batches
    let offset = 0;
    let totalInserted = 0;
    
    while (offset < result.corpusCount) {
      const batchResult = await corpusPool.query(
        `SELECT ${columnList} FROM public.${tableName} ORDER BY ${primaryKey.join(', ')} LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );
      
      if (batchResult.rows.length === 0) {
        break;
      }
      
      // Insert batch into RUNTIME
      for (const row of batchResult.rows) {
        const values = columns.map(col => row[col]);
        
        try {
          // Use ON CONFLICT DO NOTHING for primary key conflicts
          const conflictClause = primaryKey.length > 0 
            ? ` ON CONFLICT (${primaryKey.join(', ')}) DO NOTHING`
            : '';
          
          const insertQuery = `
            INSERT INTO public.${tableName} (${columnList})
            VALUES (${placeholders})${conflictClause}
          `;
          
          const insertResult = await runtimePool.query(insertQuery, values);
          if (insertResult.rowCount && insertResult.rowCount > 0) {
            totalInserted++;
          }
        } catch (error: any) {
          const errorMsg = `Error inserting row: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`  ⚠ ${errorMsg}`);
          
          // Continue with next row
        }
      }
      
      offset += BATCH_SIZE;
      console.log(`  Progress: ${Math.min(offset, result.corpusCount)}/${result.corpusCount} rows processed, ${totalInserted} inserted`);
    }
    
    result.insertedCount = totalInserted;
    
    // Get count from RUNTIME after
    const runtimeAfterResult = await runtimePool.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
    result.runtimeCountAfter = parseInt(runtimeAfterResult.rows[0]?.count || '0', 10);
    console.log(`  RUNTIME count (after): ${result.runtimeCountAfter}`);
    console.log(`  ✓ Inserted ${totalInserted} rows`);
    
    // Verify counts
    const expectedAfter = result.runtimeCountBefore + result.insertedCount;
    if (result.runtimeCountAfter !== expectedAfter) {
      const warning = `Count mismatch: expected ${expectedAfter}, got ${result.runtimeCountAfter}`;
      result.errors.push(warning);
      console.warn(`  ⚠ ${warning}`);
    }
    
  } catch (error: any) {
    const errorMsg = `Fatal error copying ${tableName}: ${error.message}`;
    result.errors.push(errorMsg);
    console.error(`  ✗ ${errorMsg}`);
  }
  
  return result;
}

async function getTableColumns(pool: any, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  return result.rows.map((row: any) => row.column_name);
}

async function getCommonColumns(
  corpusPool: any,
  runtimePool: any,
  tableName: string
): Promise<string[]> {
  const corpusColumns = await getTableColumns(corpusPool, tableName);
  const runtimeColumns = await getTableColumns(runtimePool, tableName);
  
  // Only return columns that exist in both tables
  const commonColumns = corpusColumns.filter(col => runtimeColumns.includes(col));
  
  if (commonColumns.length === 0) {
    throw new Error(`No common columns found between CORPUS and RUNTIME for ${tableName}`);
  }
  
  // Log any columns that are being skipped
  const skippedCorpus = corpusColumns.filter(col => !runtimeColumns.includes(col));
  const skippedRuntime = runtimeColumns.filter(col => !corpusColumns.includes(col));
  
  if (skippedCorpus.length > 0) {
    console.log(`  ⚠️  Skipping CORPUS-only columns: ${skippedCorpus.join(', ')}`);
  }
  if (skippedRuntime.length > 0) {
    console.log(`  ⚠️  RUNTIME has extra columns (will use defaults): ${skippedRuntime.join(', ')}`);
  }
  
  return commonColumns;
}

async function getPrimaryKey(pool: any, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT 
      a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    ORDER BY a.attnum
  `, [`public.${tableName}`]);
  
  return result.rows.map((row: any) => row.column_name);
}

async function main() {
  console.log('🔄 Copying tables from CORPUS to RUNTIME...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be modified\n');
  }
  
  try {
    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();
    
    console.log('✓ Connected to both databases\n');
    
    const results: CopyResult[] = [];
    
    // Copy canonical_sources first (referenced by ofc_library_citations)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Table 1: canonical_sources');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const canonicalSourcesColumns = await getCommonColumns(corpusPool, runtimePool, 'canonical_sources');
    const canonicalSourcesPK = await getPrimaryKey(corpusPool, 'canonical_sources');
    
    // Check if table exists in CORPUS (might be deprecated)
    const corpusTableExists = await corpusPool.query(`
      SELECT to_regclass('public.canonical_sources') as reg
    `);
    
    if (corpusTableExists.rows[0]?.reg) {
      const result1 = await copyTable(
        corpusPool,
        runtimePool,
        'canonical_sources',
        canonicalSourcesColumns,
        canonicalSourcesPK
      );
      results.push(result1);
    } else {
      // Check deprecated table (public or archive schema)
      const deprecatedExists = await corpusPool.query(`
        SELECT to_regclass('public.canonical_sources_deprecated') as reg
        UNION ALL SELECT to_regclass('archive.canonical_sources_deprecated')
      `);
      const found = deprecatedExists.rows.some((r: any) => r?.reg);
      if (found) {
        console.log('  ℹ️  canonical_sources already deprecated in CORPUS (public or archive), skipping copy');
        const result1: CopyResult = {
          table: 'canonical_sources',
          corpusCount: 0,
          insertedCount: 0,
          runtimeCountBefore: 0,
          runtimeCountAfter: 0,
          errors: [],
        };
        results.push(result1);
      } else {
        console.log('  ⚠️  canonical_sources not found in CORPUS (may already be moved)');
      }
    }
    
    // Copy ofc_library_citations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Table 2: ofc_library_citations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const citationsColumns = await getCommonColumns(corpusPool, runtimePool, 'ofc_library_citations');
    const citationsPK = await getPrimaryKey(corpusPool, 'ofc_library_citations');
    
    // Check if table exists in CORPUS (might be deprecated)
    const citationsTableExists = await corpusPool.query(`
      SELECT to_regclass('public.ofc_library_citations') as reg
    `);
    
    if (citationsTableExists.rows[0]?.reg) {
      const result2 = await copyTable(
        corpusPool,
        runtimePool,
        'ofc_library_citations',
        citationsColumns,
        citationsPK
      );
      results.push(result2);
    } else {
      // Check deprecated table (public or archive schema)
      const deprecatedExists = await corpusPool.query(`
        SELECT to_regclass('public.ofc_library_citations_deprecated') as reg
        UNION ALL SELECT to_regclass('archive.ofc_library_citations_deprecated')
      `);
      const found = deprecatedExists.rows.some((r: any) => r?.reg);
      if (found) {
        console.log('  ℹ️  ofc_library_citations already deprecated in CORPUS (public or archive), skipping copy');
        const result2: CopyResult = {
          table: 'ofc_library_citations',
          corpusCount: 0,
          insertedCount: 0,
          runtimeCountBefore: 0,
          runtimeCountAfter: 0,
          errors: [],
        };
        results.push(result2);
      } else {
        console.log('  ⚠️  ofc_library_citations not found in CORPUS (may already be moved)');
      }
    }
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let totalErrors = 0;
    for (const result of results) {
      console.log(`${result.table}:`);
      console.log(`  CORPUS: ${result.corpusCount} rows`);
      console.log(`  Inserted: ${result.insertedCount} rows`);
      console.log(`  RUNTIME (before): ${result.runtimeCountBefore} rows`);
      console.log(`  RUNTIME (after): ${result.runtimeCountAfter} rows`);
      
      if (result.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.log(`    - ${err}`));
        totalErrors += result.errors.length;
      } else {
        console.log(`  ✓ Success`);
      }
      console.log('');
    }
    
    if (totalErrors > 0) {
      console.error(`\n✗ Completed with ${totalErrors} error(s)`);
      process.exit(1);
    } else {
      console.log('✓ All tables copied successfully\n');
      process.exit(0);
    }
    
  } catch (error: any) {
    console.error('\n✗ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
