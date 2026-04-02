#!/usr/bin/env tsx
/**
 * Execute cleanup SQL to remove duplicate tables.
 * 
 * Usage:
 *   npx tsx tools/db/execute_cleanup.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { ensureNodePgTls } from '../../app/lib/db/ensure_ssl';
import { loadEnvLocal } from '../../app/lib/db/load_env_local';
import { applyNodeTls } from '../../app/lib/db/pg_tls';
import { getRuntimePool } from '../../app/lib/db/runtime_client';

loadEnvLocal();

function getCorpusPoolDirect(): Pool {
  const corpusDatabaseUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusDatabaseUrl) {
    throw new Error('CORPUS_DATABASE_URL must be set');
  }
  const connectionString = ensureNodePgTls(corpusDatabaseUrl) ?? corpusDatabaseUrl;
  return new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );
}

async function executeSQL(pool: any, sql: string, dbName: string) {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await pool.query(statement);
        console.log(`   ✓ Executed: ${statement.substring(0, 60)}...`);
      } catch (error: any) {
        // Ignore "table does not exist" errors
        if (error.code === '42P01') {
          console.log(`   ⚠️  Table already missing: ${statement.substring(0, 60)}...`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function main() {
  try {
    console.log("🔧 Executing cleanup SQL to remove duplicate tables...\n");
    
    const corpusPool = getCorpusPoolDirect();
    const runtimePool = getRuntimePool();
    
    const corpusSQLPath = path.join(process.cwd(), 'analytics', 'reports', 'cleanup_duplicates_corpus.sql');
    const runtimeSQLPath = path.join(process.cwd(), 'analytics', 'reports', 'cleanup_duplicates_runtime.sql');
    
    if (!fs.existsSync(corpusSQLPath)) {
      throw new Error(`CORPUS SQL file not found: ${corpusSQLPath}`);
    }
    
    if (!fs.existsSync(runtimeSQLPath)) {
      throw new Error(`RUNTIME SQL file not found: ${runtimeSQLPath}`);
    }
    
    const corpusSQL = fs.readFileSync(corpusSQLPath, 'utf-8');
    const runtimeSQL = fs.readFileSync(runtimeSQLPath, 'utf-8');
    
    // Add any remaining tables that weren't in the original SQL
    const additionalCorpusDrops = [
      'DROP TABLE IF EXISTS public.assessment_module_instances CASCADE;'
    ];
    const additionalRuntimeDrops = [
      'DROP TABLE IF EXISTS public.module_chunk_links CASCADE;'
    ];
    
    console.log("📋 CORPUS Database Cleanup:");
    console.log("   Dropping RUNTIME-only tables from CORPUS...");
    await executeSQL(corpusPool, corpusSQL, 'CORPUS');
    for (const sql of additionalCorpusDrops) {
      await executeSQL(corpusPool, sql, 'CORPUS');
    }
    
    console.log("\n📋 RUNTIME Database Cleanup:");
    console.log("   Dropping CORPUS-only tables from RUNTIME...");
    await executeSQL(runtimePool, runtimeSQL, 'RUNTIME');
    for (const sql of additionalRuntimeDrops) {
      await executeSQL(runtimePool, sql, 'RUNTIME');
    }
    
    console.log("\n✅ Cleanup complete!");
    console.log("\n📊 Verifying cleanup...");
    
    // Verify by checking if duplicates still exist
    const { tableExists } = await import('../../app/lib/db/table_exists');
    
    const duplicates = [
      { name: 'assessment_modules', owner: 'RUNTIME' },
      { name: 'assessment_module_instances', owner: 'RUNTIME' },
      { name: 'assessment_module_questions', owner: 'RUNTIME' },
      { name: 'module_chunk_links', owner: 'CORPUS' },
      { name: 'module_source_documents', owner: 'CORPUS' },
      { name: 'ofc_question_links', owner: 'CORPUS' },
    ];
    
    let allClean = true;
    for (const dup of duplicates) {
      const inCorpus = await tableExists(corpusPool as any, 'public', dup.name);
      const inRuntime = await tableExists(runtimePool as any, 'public', dup.name);
      
      if (dup.owner === 'CORPUS') {
        if (inRuntime) {
          console.log(`   ❌ ${dup.name}: Still exists in RUNTIME (should be CORPUS only)`);
          allClean = false;
        } else if (!inCorpus) {
          console.log(`   ⚠️  ${dup.name}: Missing from CORPUS (expected)`);
        } else {
          console.log(`   ✓ ${dup.name}: CORPUS only (correct)`);
        }
      } else {
        if (inCorpus) {
          console.log(`   ❌ ${dup.name}: Still exists in CORPUS (should be RUNTIME only)`);
          allClean = false;
        } else if (!inRuntime) {
          console.log(`   ⚠️  ${dup.name}: Missing from RUNTIME (expected)`);
        } else {
          console.log(`   ✓ ${dup.name}: RUNTIME only (correct)`);
        }
      }
    }
    
    if (allClean) {
      console.log("\n✅ All duplicates removed successfully!");
      console.log("\n💡 Next step: Run 'npm run db:audit' to verify full cleanup");
    } else {
      console.log("\n⚠️  Some duplicates may still exist. Please review the output above.");
    }
    
  } catch (error) {
    console.error("\n❌ Fatal error during cleanup:", error);
    process.exit(1);
  }
}

main();
