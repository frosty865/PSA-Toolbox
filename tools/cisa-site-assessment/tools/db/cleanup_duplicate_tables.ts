#!/usr/bin/env tsx
/**
 * Cleanup duplicate tables between CORPUS and RUNTIME databases.
 * 
 * Based on config/db_ownership.json, removes tables from the wrong database.
 * 
 * Usage:
 *   npx tsx tools/db/cleanup_duplicate_tables.ts [--dry-run]
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

import ownershipConfig from '../../config/db_ownership.json';
import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';
import { tableExists } from '../../app/lib/db/table_exists';

interface TableCheck {
  schema: string;
  table: string;
  owner: string;
  inCorpus: boolean;
  inRuntime: boolean;
  action: 'DROP_FROM_CORPUS' | 'DROP_FROM_RUNTIME' | 'CREATE_IN_CORPUS' | 'CREATE_IN_RUNTIME' | 'NONE';
  reason: string;
}

async function checkAllTables(): Promise<TableCheck[]> {
  const corpusPool = getCorpusPool();
  const runtimePool = getRuntimePool();
  const results: TableCheck[] = [];

  for (const [fullTableName, expectedOwner] of Object.entries(ownershipConfig.owners)) {
    const [schema, table] = fullTableName.split('.');
    
    const inCorpus = await tableExists(corpusPool as any, schema, table);
    const inRuntime = await tableExists(runtimePool as any, schema, table);
    
    let action: TableCheck['action'] = 'NONE';
    let reason = '';
    
    // Determine action needed
    if (expectedOwner === 'CORPUS') {
      if (inRuntime && !inCorpus) {
        action = 'DROP_FROM_RUNTIME';
        reason = 'Table should be in CORPUS only, but exists in RUNTIME';
      } else if (inCorpus && inRuntime) {
        action = 'DROP_FROM_RUNTIME';
        reason = 'DUPLICATE: Table exists in both, should be CORPUS only';
      } else if (!inCorpus && !inRuntime) {
        action = 'CREATE_IN_CORPUS';
        reason = 'Table missing, should be created in CORPUS';
      }
    } else if (expectedOwner === 'RUNTIME') {
      if (inCorpus && !inRuntime) {
        action = 'DROP_FROM_CORPUS';
        reason = 'Table should be in RUNTIME only, but exists in CORPUS';
      } else if (inCorpus && inRuntime) {
        action = 'DROP_FROM_CORPUS';
        reason = 'DUPLICATE: Table exists in both, should be RUNTIME only';
      } else if (!inCorpus && !inRuntime) {
        action = 'CREATE_IN_RUNTIME';
        reason = 'Table missing, should be created in RUNTIME';
      }
    }
    
    results.push({
      schema,
      table,
      owner: expectedOwner,
      inCorpus,
      inRuntime,
      action,
      reason
    });
  }
  
  return results;
}

async function generateCleanupSQL(checks: TableCheck[], dryRun: boolean): Promise<{ corpusSQL: string[]; runtimeSQL: string[] }> {
  const corpusSQL: string[] = [];
  const runtimeSQL: string[] = [];
  
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("-- CORPUS Database Cleanup SQL");
  corpusSQL.push(`-- Generated: ${new Date().toISOString()}`);
  corpusSQL.push(`-- Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will execute)'}`);
  corpusSQL.push("-- ⚠️  RUN ONLY ON CORPUS DATABASE ⚠️");
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("");
  
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("-- RUNTIME Database Cleanup SQL");
  runtimeSQL.push(`-- Generated: ${new Date().toISOString()}`);
  runtimeSQL.push(`-- Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will execute)'}`);
  runtimeSQL.push("-- ⚠️  RUN ONLY ON RUNTIME DATABASE ⚠️");
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("");
  
  const corpusDrops = checks.filter(c => c.action === 'DROP_FROM_CORPUS');
  const runtimeDrops = checks.filter(c => c.action === 'DROP_FROM_RUNTIME');
  const corpusCreates = checks.filter(c => c.action === 'CREATE_IN_CORPUS');
  const runtimeCreates = checks.filter(c => c.action === 'CREATE_IN_RUNTIME');
  
  if (corpusDrops.length > 0) {
    corpusSQL.push("-- DROP tables that should NOT be in CORPUS:");
    for (const check of corpusDrops) {
      corpusSQL.push(`-- ${check.schema}.${check.table}: ${check.reason}`);
      if (!dryRun) {
        corpusSQL.push(`DROP TABLE IF EXISTS ${check.schema}.${check.table} CASCADE;`);
      } else {
        corpusSQL.push(`-- DROP TABLE IF EXISTS ${check.schema}.${check.table} CASCADE; -- DRY RUN`);
      }
    }
    corpusSQL.push("");
  }
  
  if (runtimeDrops.length > 0) {
    runtimeSQL.push("-- DROP tables that should NOT be in RUNTIME:");
    for (const check of runtimeDrops) {
      runtimeSQL.push(`-- ${check.schema}.${check.table}: ${check.reason}`);
      if (!dryRun) {
        runtimeSQL.push(`DROP TABLE IF EXISTS ${check.schema}.${check.table} CASCADE;`);
      } else {
        runtimeSQL.push(`-- DROP TABLE IF EXISTS ${check.schema}.${check.table} CASCADE; -- DRY RUN`);
      }
    }
    runtimeSQL.push("");
  }
  
  if (corpusCreates.length > 0) {
    corpusSQL.push("-- CREATE tables that should be in CORPUS (if missing):");
    for (const check of corpusCreates) {
      corpusSQL.push(`-- ${check.schema}.${check.table}: ${check.reason}`);
      corpusSQL.push(`-- NOTE: Table creation SQL not generated - use migration files instead`);
    }
    corpusSQL.push("");
  }
  
  if (runtimeCreates.length > 0) {
    runtimeSQL.push("-- CREATE tables that should be in RUNTIME (if missing):");
    for (const check of runtimeCreates) {
      runtimeSQL.push(`-- ${check.schema}.${check.table}: ${check.reason}`);
      runtimeSQL.push(`-- NOTE: Table creation SQL not generated - use migration files instead`);
    }
    runtimeSQL.push("");
  }
  
  // Verification
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("-- VERIFICATION (CORPUS)");
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("");
  for (const check of checks) {
    if (check.owner === 'CORPUS') {
      corpusSQL.push(`SELECT '${check.table}' as table_name, to_regclass('${check.schema}.${check.table}') IS NOT NULL as exists, 'CORPUS' as expected_owner;`);
    } else {
      corpusSQL.push(`SELECT '${check.table}' as table_name, to_regclass('${check.schema}.${check.table}') IS NULL as should_not_exist, 'RUNTIME' as expected_owner;`);
    }
  }
  corpusSQL.push("");
  
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("-- VERIFICATION (RUNTIME)");
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("");
  for (const check of checks) {
    if (check.owner === 'RUNTIME') {
      runtimeSQL.push(`SELECT '${check.table}' as table_name, to_regclass('${check.schema}.${check.table}') IS NOT NULL as exists, 'RUNTIME' as expected_owner;`);
    } else {
      runtimeSQL.push(`SELECT '${check.table}' as table_name, to_regclass('${check.schema}.${check.table}') IS NULL as should_not_exist, 'CORPUS' as expected_owner;`);
    }
  }
  runtimeSQL.push("");
  
  return { corpusSQL, runtimeSQL };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log("🔍 Checking for duplicate tables...\n");
    
    const checks = await checkAllTables();
    
    const duplicates = checks.filter(c => c.inCorpus && c.inRuntime);
    const wrongLocation = checks.filter(c => 
      (c.owner === 'CORPUS' && c.inRuntime && !c.inCorpus) ||
      (c.owner === 'RUNTIME' && c.inCorpus && !c.inRuntime)
    );
    const needsAction = checks.filter(c => c.action !== 'NONE');
    
    console.log("📊 Summary:");
    console.log(`  Total tables checked: ${checks.length}`);
    console.log(`  Duplicates (in both): ${duplicates.length}`);
    console.log(`  Wrong location: ${wrongLocation.length}`);
    console.log(`  Needs action: ${needsAction.length}`);
    console.log("");
    
    if (duplicates.length > 0) {
      console.log("❌ DUPLICATE TABLES (exist in both databases):");
      duplicates.forEach(d => {
        console.log(`   - ${d.schema}.${d.table} (should be ${d.owner} only)`);
      });
      console.log("");
    }
    
    if (wrongLocation.length > 0) {
      console.log("⚠️  TABLES IN WRONG DATABASE:");
      wrongLocation.forEach(w => {
        console.log(`   - ${w.schema}.${w.table}: expected ${w.owner}, but found in ${w.inCorpus ? 'CORPUS' : 'RUNTIME'}`);
      });
      console.log("");
    }
    
    if (needsAction.length > 0) {
      console.log("🔧 ACTIONS NEEDED:");
      needsAction.forEach(a => {
        const icon = a.action.includes('DROP') ? '🗑️' : a.action.includes('CREATE') ? '➕' : '❓';
        console.log(`   ${icon} ${a.schema}.${a.table}: ${a.action} - ${a.reason}`);
      });
      console.log("");
      
      // Generate cleanup SQL
      const { corpusSQL, runtimeSQL } = await generateCleanupSQL(checks, dryRun);
      
      const reportsDir = path.join(process.cwd(), 'analytics', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const corpusPath = path.join(reportsDir, 'cleanup_duplicates_corpus.sql');
      const runtimePath = path.join(reportsDir, 'cleanup_duplicates_runtime.sql');
      
      fs.writeFileSync(corpusPath, corpusSQL.join('\n'));
      fs.writeFileSync(runtimePath, runtimeSQL.join('\n'));
      
      console.log(`✅ Generated cleanup SQL files:`);
      console.log(`   - ${corpusPath}`);
      console.log(`   - ${runtimePath}`);
      console.log("");
      console.log(`⚠️  IMPORTANT:`);
      console.log(`   1. Review the SQL files carefully`);
      console.log(`   2. Backup both databases before running`);
      console.log(`   3. Run CORPUS SQL against CORPUS database only`);
      console.log(`   4. Run RUNTIME SQL against RUNTIME database only`);
      console.log(`   5. Run verification queries after cleanup`);
      console.log(`   6. Re-run 'npm run db:audit' to confirm cleanup`);
    } else {
      console.log("✅ No cleanup needed - all tables are in correct locations!");
    }
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
