#!/usr/bin/env node
/**
 * Remove all expansion questions from CORPUS database.
 * 
 * Usage:
 *   node scripts/remove_expansion_questions.js [--dry-run]
 */

const { getCorpusPool } = require('../app/lib/db/corpus_client');

async function removeExpansionQuestions(dryRun = false) {
  let pool = null;
  let client = null;
  
  try {
    pool = getCorpusPool();
    client = await pool.connect();
    
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
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error(`❌ Error: ${error.message}`, error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
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
