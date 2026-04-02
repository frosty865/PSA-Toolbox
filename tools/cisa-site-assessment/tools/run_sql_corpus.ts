#!/usr/bin/env tsx
/**
 * Run SQL File (CORPUS)
 *
 * Executes a SQL file against the CORPUS database.
 * Uses CORPUS_DATABASE_URL. For migrations/archive only (not used by app runtime).
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { ensureNodePgTls } from '../app/lib/db/ensure_ssl';
import { loadEnvLocal } from '../app/lib/db/load_env_local';
import { applyNodeTls } from '../app/lib/db/pg_tls';

loadEnvLocal();

async function runSQLFile(filePath: string): Promise<void> {
  const fullPath = join(process.cwd(), filePath);

  if (!existsSync(fullPath)) {
    throw new Error(`SQL file not found: ${fullPath}`);
  }

  const url = process.env.CORPUS_DATABASE_URL;
  if (!url) {
    throw new Error('CORPUS_DATABASE_URL must be set to run SQL against CORPUS.');
  }

  console.log(`Reading SQL file: ${fullPath}`);
  const sql = readFileSync(fullPath, 'utf-8');

  console.log('Connecting to CORPUS database...');
  // Same TLS handling as corpus_client: allow self-signed/Supabase certs (rejectUnauthorized: false)
  const connectionString = ensureNodePgTls(url) ?? url;
  const pool = new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  );
  let client;
  try {
    client = await pool.connect();
  } catch (connError: unknown) {
    const msg = connError instanceof Error ? connError.message : String(connError);
    const stack = connError instanceof Error ? connError.stack : undefined;
    console.error('✗ Failed to connect to CORPUS database:', msg);
    if (stack) console.error(stack);
    await pool.end().catch(() => {});
    throw connError;
  }
  try {
    console.log('Executing SQL...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ Successfully executed ${filePath}`);
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('✗ Error executing SQL:', msg);
    if (stack) console.error(stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: npx tsx tools/run_sql_corpus.ts <sql_file>');
    console.error('Example: npx tsx tools/run_sql_corpus.ts archive/tables/deprecated/corpus/archive_deprecated_corpus_tables.sql');
    process.exit(1);
  }

  try {
    await runSQLFile(sqlFile);
    process.exit(0);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Error:', msg);
    if (stack && process.env.DEBUG) console.error(stack);
    process.exit(1);
  }
}

main();
