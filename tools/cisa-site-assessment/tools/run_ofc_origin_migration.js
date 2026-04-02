#!/usr/bin/env node
/**
 * Run ofc_origin migration against CORPUS database
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function runMigration() {
  const migrationFile = path.join(__dirname, '../db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  if (!connectionString) {
    console.error('❌ CORPUS_DATABASE_URL not found in environment variables');
    console.error('   Please set CORPUS_DATABASE_URL in .env.local');
    process.exit(1);
  }
  console.log('🔌 Connecting to CORPUS database...');
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    console.log('✅ Connected to CORPUS database');
    
    console.log('📝 Running migration...');
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!');
    
    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const result = await client.query(`
      SELECT 
        column_name,
        is_nullable,
        (SELECT conname FROM pg_constraint 
         WHERE conrelid = 'public.ofc_candidate_queue'::regclass 
         AND conname = 'chk_ofc_candidate_queue_ofc_origin') as check_constraint,
        (SELECT COUNT(*) FROM public.ofc_candidate_queue WHERE ofc_origin IS NULL) as null_count,
        (SELECT COUNT(*) FROM public.ofc_candidate_queue WHERE ofc_origin NOT IN ('CORPUS', 'MODULE')) as invalid_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ofc_candidate_queue'
        AND column_name = 'ofc_origin'
    `);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`   Column exists: ${row.column_name}`);
      console.log(`   NOT NULL: ${row.is_nullable === 'NO' ? '✅' : '❌'}`);
      console.log(`   CHECK constraint: ${row.check_constraint ? '✅' : '❌'}`);
      console.log(`   NULL values: ${row.null_count} ${row.null_count === '0' ? '✅' : '❌'}`);
      console.log(`   Invalid values: ${row.invalid_count} ${row.invalid_count === '0' ? '✅' : '❌'}`);
    }
    
    // Show data distribution
    const distResult = await client.query(`
      SELECT ofc_origin, COUNT(*) as count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    
    console.log('\n📊 Data distribution:');
    distResult.rows.forEach(row => {
      console.log(`   ${row.ofc_origin}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
