#!/usr/bin/env tsx
/**
 * Run SQL File
 * 
 * Executes a SQL file against the RUNTIME database.
 * Uses runtime_client for connection.
 */

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Clean up environment variables
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

async function runSQLFile(filePath: string): Promise<void> {
  const fullPath = join(process.cwd(), filePath);
  
  if (!require('fs').existsSync(fullPath)) {
    throw new Error(`SQL file not found: ${fullPath}`);
  }

  console.log(`Reading SQL file: ${fullPath}`);
  const sql = readFileSync(fullPath, 'utf-8');

  console.log('Connecting to runtime database...');
  const pool = await ensureRuntimePoolConnected();
  console.log('✓ Database connected');

  const client = await pool.connect();
  try {
    console.log('Executing SQL...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ Successfully executed ${filePath}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Error executing ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: npx tsx tools/run_sql.ts <sql_file>');
    process.exit(1);
  }

  try {
    await runSQLFile(sqlFile);
    process.exit(0);
  } catch (error) {
    console.error('SQL execution failed:', error);
    process.exit(1);
  }
}

main();
