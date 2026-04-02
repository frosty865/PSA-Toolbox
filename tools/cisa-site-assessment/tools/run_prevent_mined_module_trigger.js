#!/usr/bin/env node
/**
 * Run prevent_mined_as_module trigger migration
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function runMigration() {
  const migrationFile = path.join(__dirname, '../db/migrations/20260124_0008_prevent_mined_as_module.sql');
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
    
    console.log('📝 Running migration...');
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!');
    
    // Verify trigger exists
    const triggerResult = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name = 'trg_no_mined_module'
    `);
    
    if (triggerResult.rows.length > 0) {
      console.log('✅ Trigger verified: trg_no_mined_module');
    } else {
      console.log('⚠️  Trigger not found (may be because submitted_by column does not exist)');
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
