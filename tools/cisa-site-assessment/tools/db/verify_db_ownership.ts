#!/usr/bin/env tsx
/**
 * Verify Database Ownership Matches Reality
 * 
 * Checks that:
 * 1. Tables exist in the databases specified by config/db_ownership.json
 * 2. Tables do NOT exist in the wrong database (unless explicitly allowed)
 * 3. Foreign key constraints require co-location (FKs cannot span databases)
 * 
 * Usage:
 *   npx tsx tools/db/verify_db_ownership.ts
 * 
 * Exit codes:
 *   0 - All checks passed
 *   1 - Mismatches found
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool, type PoolConfig } from 'pg';
import { applyNodeTls } from '../../app/lib/db/pg_tls';
import { ensureNodePgTls } from '../../app/lib/db/ensure_ssl';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface OwnershipConfig {
  meta: {
    version: string;
    authoritative: boolean;
    notes: string[];
  };
  owners: Record<string, 'CORPUS' | 'RUNTIME'>;
}

interface TableCheckResult {
  fqtn: string;
  expectedOwner: 'CORPUS' | 'RUNTIME';
  existsInCorpus: boolean;
  existsInRuntime: boolean;
  actualOwner: 'CORPUS' | 'RUNTIME' | 'BOTH' | 'NEITHER';
  status: 'OK' | 'WRONG_DB' | 'DUPLICATE' | 'MISSING';
}

interface FKCheckResult {
  table: string;
  fkConstraint: string;
  referencedTable: string;
  tableOwner: 'CORPUS' | 'RUNTIME' | 'UNKNOWN';
  referencedOwner: 'CORPUS' | 'RUNTIME' | 'UNKNOWN';
  status: 'OK' | 'CROSS_DB_FK' | 'MISSING_TABLE';
}

/**
 * Check if a table exists in a database
 */
function makePool(url: string, label: string): Pool {
  const normalized = ensureNodePgTls(url) ?? url;
  let parsedHost = 'unknown';
  let parsedPort = 'unknown';
  let parsedDb = 'unknown';
  try {
    const u = new URL(url);
    parsedHost = u.hostname;
    parsedPort = u.port || '5432';
    parsedDb = u.pathname.replace('/', '') || 'postgres';
  } catch {
    // keep unknown values for logs
  }

  console.log(`[${label}] Connecting to host=${parsedHost} port=${parsedPort} db=${parsedDb}`);

  const config: PoolConfig = {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
  };
  return new Pool(applyNodeTls(config));
}

async function tableExists(pool: Pool, fqtn: string): Promise<boolean> {
  try {
    const result = await pool.query(`SELECT to_regclass($1) as reg`, [fqtn]);
    return !!result.rows[0]?.reg;
  } catch (error) {
    console.error(`Error checking table ${fqtn}:`, error);
    return false;
  }
}

/**
 * Get foreign key constraints for a table
 */
async function getForeignKeys(pool: Pool, schema: string, table: string): Promise<Array<{
  constraint_name: string;
  referenced_table: string;
}>> {
  try {
    const result = await pool.query(`
      SELECT
        tc.constraint_name,
        ccu.table_schema || '.' || ccu.table_name AS referenced_table
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
    
    return result.rows.map((row: any) => ({
      constraint_name: row.constraint_name,
      referenced_table: row.referenced_table,
    }));
  } catch (error) {
    // Table might not exist, return empty array
    return [];
  }
}

/**
 * Check table ownership matches config
 */
async function checkTableOwnership(
  corpusPool: Pool,
  runtimePool: Pool,
  ownershipConfig: OwnershipConfig
): Promise<{ results: TableCheckResult[]; errors: string[] }> {
  const results: TableCheckResult[] = [];
  const errors: string[] = [];
  
  // Tables explicitly allowed to exist in both databases (if any)
  const ALLOWED_DUPLICATES = new Set<string>([
    // Add any tables that legitimately exist in both, e.g.:
    // 'public.disciplines', // if needed
  ]);
  
  async function deprecatedCopyExistsInCorpus(activeTable: string): Promise<boolean> {
    if (activeTable === 'canonical_sources') {
      return (await tableExists(corpusPool, 'public.canonical_sources_deprecated')) ||
        (await tableExists(corpusPool, 'archive.canonical_sources_deprecated'));
    }
    if (activeTable === 'ofc_library_citations') {
      return (await tableExists(corpusPool, 'public.ofc_library_citations_deprecated')) ||
        (await tableExists(corpusPool, 'archive.ofc_library_citations_deprecated'));
    }
    return false;
  }
  
  for (const [fqtn, expectedOwner] of Object.entries(ownershipConfig.owners)) {
    const [schema, table] = fqtn.split('.');
    if (!schema || !table) {
      errors.push(`Invalid FQTN format: ${fqtn}`);
      continue;
    }
    
    const existsInCorpus = await tableExists(corpusPool, fqtn);
    const existsInRuntime = await tableExists(runtimePool, fqtn);
    
    // Check if deprecated copy exists in CORPUS (public or archive schema) - allowed when live table is in RUNTIME
    const deprecatedExistsInCorpus = (table === 'canonical_sources' || table === 'ofc_library_citations')
      ? await deprecatedCopyExistsInCorpus(table)
      : false;
    
    let actualOwner: 'CORPUS' | 'RUNTIME' | 'BOTH' | 'NEITHER';
    if (existsInCorpus && existsInRuntime) {
      actualOwner = 'BOTH';
    } else if (existsInCorpus) {
      actualOwner = 'CORPUS';
    } else if (existsInRuntime) {
      actualOwner = 'RUNTIME';
    } else {
      actualOwner = 'NEITHER';
    }
    
    let status: 'OK' | 'WRONG_DB' | 'DUPLICATE' | 'MISSING';
    if (actualOwner === 'NEITHER') {
      status = 'MISSING';
      errors.push(`Table ${fqtn} does not exist in either database (expected ${expectedOwner})`);
    } else if (actualOwner === 'BOTH' && !ALLOWED_DUPLICATES.has(fqtn)) {
      // If deprecated version exists in CORPUS, that's OK - the live table should only be in RUNTIME
      if (deprecatedExistsInCorpus && expectedOwner === 'RUNTIME') {
        // This is the expected state after migration: deprecated in CORPUS, live in RUNTIME
        status = 'OK';
      } else {
        status = 'DUPLICATE';
        errors.push(`Table ${fqtn} exists in BOTH databases (expected only in ${expectedOwner}). If migration completed, deprecated copy should exist in CORPUS.`);
      }
    } else if (actualOwner !== expectedOwner && actualOwner !== 'BOTH') {
      status = 'WRONG_DB';
      errors.push(`Table ${fqtn} is in ${actualOwner} but config expects ${expectedOwner}`);
    } else {
      status = 'OK';
    }
    
    results.push({
      fqtn,
      expectedOwner,
      existsInCorpus,
      existsInRuntime,
      actualOwner,
      status,
    });
  }
  
  return { results, errors };
}

/**
 * Check foreign key co-location constraints
 */
async function checkFKCoLocation(
  corpusPool: Pool,
  runtimePool: Pool,
  ownershipConfig: OwnershipConfig
): Promise<{ results: FKCheckResult[]; errors: string[] }> {
  const results: FKCheckResult[] = [];
  const errors: string[] = [];
  
  // Check FKs for tables that have them
  const tablesToCheck = [
    'public.ofc_library_citations', // Has FK to ofc_library and canonical_sources
  ];
  
  for (const fqtn of tablesToCheck) {
    const [schema, table] = fqtn.split('.');
    if (!schema || !table) continue;
    
    const expectedOwner = ownershipConfig.owners[fqtn];
    if (!expectedOwner) continue; // Skip if not in config
    
    // Check FKs in the expected database
    const pool = expectedOwner === 'CORPUS' ? corpusPool : runtimePool;
    const fks = await getForeignKeys(pool, schema, table);
    
    for (const fk of fks) {
      const referencedOwner = ownershipConfig.owners[fk.referenced_table];
      
      let status: 'OK' | 'CROSS_DB_FK' | 'MISSING_TABLE';
      if (!referencedOwner) {
        status = 'MISSING_TABLE';
        errors.push(
          `FK ${fk.constraint_name} on ${fqtn} references ${fk.referenced_table} ` +
          `which is not in ownership config`
        );
      } else if (referencedOwner !== expectedOwner) {
        status = 'CROSS_DB_FK';
        errors.push(
          `FK ${fk.constraint_name} on ${fqtn} (${expectedOwner}) references ` +
          `${fk.referenced_table} (${referencedOwner}) - FK cannot span databases!`
        );
      } else {
        status = 'OK';
      }
      
      results.push({
        table: fqtn,
        fkConstraint: fk.constraint_name,
        referencedTable: fk.referenced_table,
        tableOwner: expectedOwner,
        referencedOwner: referencedOwner || 'UNKNOWN',
        status,
      });
    }
  }
  
  return { results, errors };
}

async function main() {
  console.log('🔍 Verifying database ownership matches reality...\n');
  
  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
  if (!corpusUrl) {
    console.error('❌ CORPUS_DATABASE_URL must be set.');
    process.exit(1);
  }
  if (!runtimeUrl) {
    console.error('❌ RUNTIME_DATABASE_URL must be set.');
    process.exit(1);
  }

  const corpusPool = makePool(corpusUrl, 'Corpus DB');
  const runtimePool = makePool(runtimeUrl, 'Runtime DB');

  try {
    // Load ownership config
    const configPath = path.join(process.cwd(), 'config', 'db_ownership.json');
    if (!fs.existsSync(configPath)) {
      console.error(`❌ Ownership config not found: ${configPath}`);
      process.exit(1);
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    const ownershipConfig: OwnershipConfig = JSON.parse(configContent);
    
    console.log(`📋 Loaded ownership config (${Object.keys(ownershipConfig.owners).length} tables)\n`);
    
    // Connect to both pools
    console.log('🔌 Connecting to databases...');
    await Promise.all([corpusPool.query('SELECT 1'), runtimePool.query('SELECT 1')]);
    console.log('✓ Connected\n');
    
    // Check table ownership
    console.log('📊 Checking table ownership...');
    const { results: tableResults, errors: tableErrors } = await checkTableOwnership(
      corpusPool,
      runtimePool,
      ownershipConfig
    );
    
    // Print table check results
    const okTables = tableResults.filter(r => r.status === 'OK');
    const badTables = tableResults.filter(r => r.status !== 'OK');
    
    console.log(`  ✓ ${okTables.length} tables correctly placed`);
    if (badTables.length > 0) {
      console.log(`  ✗ ${badTables.length} tables with issues:\n`);
      badTables.forEach(r => {
        console.log(`    ${r.fqtn}:`);
        console.log(`      Expected: ${r.expectedOwner}`);
        console.log(`      Actual: ${r.actualOwner}`);
        console.log(`      Status: ${r.status}`);
      });
    }
    console.log('');
    
    // Check FK co-location
    console.log('🔗 Checking foreign key co-location...');
    const { results: fkResults, errors: fkErrors } = await checkFKCoLocation(
      corpusPool,
      runtimePool,
      ownershipConfig
    );
    
    const okFKs = fkResults.filter(r => r.status === 'OK');
    const badFKs = fkResults.filter(r => r.status !== 'OK');
    
    console.log(`  ✓ ${okFKs.length} foreign keys correctly co-located`);
    if (badFKs.length > 0) {
      console.log(`  ✗ ${badFKs.length} foreign keys with issues:\n`);
      badFKs.forEach(r => {
        console.log(`    ${r.fkConstraint} on ${r.table}:`);
        console.log(`      References: ${r.referencedTable}`);
        console.log(`      Table owner: ${r.tableOwner}`);
        console.log(`      Referenced owner: ${r.referencedOwner}`);
        console.log(`      Status: ${r.status}`);
      });
    }
    console.log('');
    
    // Summary
    const allErrors = [...tableErrors, ...fkErrors];
    
    if (allErrors.length === 0) {
      console.log('✅ All checks passed! Database ownership matches config.\n');
    } else {
      console.error('❌ ERRORS FOUND:\n');
      allErrors.forEach(err => console.error(`  • ${err}`));
      console.error('');
      process.exitCode = 1;
    }
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([corpusPool.end(), runtimePool.end()]);
  }
}

main();
