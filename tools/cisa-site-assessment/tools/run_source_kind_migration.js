#!/usr/bin/env node
/**
 * Run canonical_sources source_kind migration
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function runMigration() {
  const migrationFile = path.join(__dirname, '../db/migrations/20260124_0010_canonical_sources_source_kind.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  if (!connectionString) {
    console.error('❌ CORPUS_DATABASE_URL not found');
    process.exit(1);
  }
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    console.log('🔌 Connected to CORPUS database');
    
    // Check current state
    console.log('\n📊 Current canonical_sources count:');
    const beforeResult = await client.query(`
      SELECT COUNT(*) as total
      FROM public.canonical_sources
    `);
    console.log(`   Total sources: ${beforeResult.rows[0].total}`);
    
    const moduleResearchBefore = await client.query(`
      SELECT COUNT(*) as count
      FROM public.canonical_sources
      WHERE title ILIKE '%MODULE RESEARCH%'
         OR citation_text ILIKE '%MODULE RESEARCH%'
    `);
    console.log(`   MODULE RESEARCH (by string match): ${moduleResearchBefore.rows[0].count}`);
    
    console.log('\n📝 Running migration...');
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!');
    
    // Verify after
    console.log('\n📊 Updated source_kind distribution:');
    const afterResult = await client.query(`
      SELECT source_kind, COUNT(*) as count
      FROM public.canonical_sources
      GROUP BY source_kind
      ORDER BY source_kind
    `);
    afterResult.rows.forEach(row => {
      console.log(`   ${row.source_kind}: ${row.count}`);
    });
    
    // Verify constraint exists
    const constraintResult = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'canonical_sources'
        AND constraint_name = 'chk_canonical_sources_source_kind'
    `);
    if (constraintResult.rows.length > 0) {
      console.log('\n✅ CHECK constraint verified');
    } else {
      console.log('\n⚠️  CHECK constraint not found');
    }
    
    // Verify index exists
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'canonical_sources'
        AND indexname = 'idx_canonical_sources_source_kind'
    `);
    if (indexResult.rows.length > 0) {
      console.log('✅ Index verified');
    } else {
      console.log('⚠️  Index not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
