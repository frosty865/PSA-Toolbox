#!/usr/bin/env node
/**
 * Remove all expansion questions from CORPUS database.
 * Standalone script that doesn't require TypeScript compilation.
 * 
 * Usage:
 *   node scripts/remove_expansion_questions_standalone.js [--dry-run]
 * 
 * Requires environment variables:
 *   - SUPABASE_CORPUS_URL
 *   - SUPABASE_CORPUS_DB_PASSWORD
 */

const { loadEnvLocal } = require('./lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('./lib/pg_tls');
const { Pool } = require('pg');

loadEnvLocal(process.cwd());

function getCorpusConnection() {
  const corpusUrl = process.env.SUPABASE_CORPUS_URL;
  const corpusPassword = process.env.SUPABASE_CORPUS_DB_PASSWORD;
  if (!corpusUrl) {
    throw new Error('SUPABASE_CORPUS_URL environment variable not set');
  }
  if (!corpusPassword) {
    throw new Error('SUPABASE_CORPUS_DB_PASSWORD environment variable not set');
  }
  const url = new URL(corpusUrl);
  const hostname = url.hostname;
  const projectRef = hostname.split('.')[0];
  if (!projectRef) {
    throw new Error(`Could not extract project ref from URL: ${corpusUrl}`);
  }
  const rawUrl = `postgresql://postgres:${encodeURIComponent(corpusPassword)}@db.${projectRef}.supabase.co:6543/postgres`;
  const connectionString = ensureNodePgTls(rawUrl) ?? rawUrl;
  return new Pool(
    applyNodeTls({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    })
  );
}

async function removeExpansionQuestions(dryRun = false) {
  const pool = getCorpusConnection();
  const client = await pool.connect();
  
  try {
    // Check current count
    const countResult = await client.query('SELECT COUNT(*) as count FROM public.expansion_questions');
    const beforeCount = parseInt(countResult.rows[0].count);
    
    console.log(`Found ${beforeCount} expansion questions in database`);
    
    if (beforeCount === 0) {
      console.log('No expansion questions to remove.');
      return;
    }
    
    // Check related records
    const linkCountResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM public.corpus_candidate_question_links 
      WHERE universe = 'EXPANSION'
    `);
    const linkCount = parseInt(linkCountResult.rows[0].count);
    
    if (dryRun) {
      console.log('\n[DRY RUN] Would delete:');
      console.log(`  - ${beforeCount} expansion questions`);
      console.log(`  - ${linkCount} expansion question links in corpus_candidate_question_links`);
      console.log('\n[DRY RUN] No changes made. Run without --dry-run to execute.');
      return;
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Delete expansion question links first
    const linkDeleteResult = await client.query(`
      DELETE FROM public.corpus_candidate_question_links
      WHERE universe = 'EXPANSION'
    `);
    const linksDeleted = linkDeleteResult.rowCount;
    console.log(`Deleted ${linksDeleted} expansion question links`);
    
    // Delete all expansion questions
    const questionDeleteResult = await client.query('DELETE FROM public.expansion_questions');
    const questionsDeleted = questionDeleteResult.rowCount;
    console.log(`Deleted ${questionsDeleted} expansion questions`);
    
    // Verify deletion
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM public.expansion_questions');
    const afterCount = parseInt(verifyResult.rows[0].count);
    
    if (afterCount > 0) {
      throw new Error(`Failed to delete all expansion questions. ${afterCount} remain.`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`\n✅ Successfully removed all expansion questions from CORPUS database`);
    console.log(`   - Deleted ${questionsDeleted} expansion questions`);
    console.log(`   - Deleted ${linksDeleted} related question links`);
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

removeExpansionQuestions(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
