/**
 * Run a migration against the CORPUS database (CORPUS_DATABASE_URL).
 * Usage: node scripts/run_corpus_migration.js <migration_file.sql>
 */
const path = require('path');
const { loadEnvLocal } = require('./lib/load_env_local');

loadEnvLocal(process.cwd());

// Point run_migration at CORPUS DB
process.env.DATABASE_URL = process.env.CORPUS_DATABASE_URL || process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  console.error('CORPUS_DATABASE_URL (or DATABASE_URL) is required');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run_corpus_migration.js <migration_file.sql>');
  process.exit(1);
}

const filePath = path.resolve(migrationFile);
require('./run_migration.js');
