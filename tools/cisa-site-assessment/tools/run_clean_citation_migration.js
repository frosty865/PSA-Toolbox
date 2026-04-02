#!/usr/bin/env node
/**
 * Run clean canonical source citation text migration
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function runMigration() {
  const migrationFile = path.join(__dirname, '../db/migrations/20260124_0009_clean_canonical_source_citation_text.sql');
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
    console.log('\n📊 Current citation texts:');
    const beforeResult = await client.query(`
      SELECT citation_text 
      FROM public.canonical_sources
      WHERE citation_text ILIKE '%MODULE RESEARCH%'
      ORDER BY citation_text
    `);
    beforeResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. "${row.citation_text}"`);
    });
    
    console.log('\n📝 Running migration...');
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!');
    
    // Verify after
    console.log('\n📊 Updated citation texts:');
    const afterResult = await client.query(`
      SELECT citation_text 
      FROM public.canonical_sources
      WHERE citation_text ILIKE '%MODULE RESEARCH%'
      ORDER BY citation_text
    `);
    afterResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. "${row.citation_text}"`);
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
