#!/usr/bin/env node
/**
 * Reclassify Mis-Tagged CORPUS Candidates
 * 
 * Identifies and reclassifies candidates incorrectly tagged as MODULE
 * that should be CORPUS (mined/research-derived, not manually authored).
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function checkSchema(client) {
  // Check what columns exist
  const columnsResult = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ofc_candidate_queue'
      AND column_name IN ('submitted_by', 'created_by', 'citation', 'citation_text', 'source_id')
    ORDER BY column_name
  `);
  
  return columnsResult.rows.map(r => r.column_name);
}

async function identifyMisclassified(client, availableColumns) {
  // Build WHERE clause based on available columns
  const conditions = [];
  
  if (availableColumns.includes('submitted_by')) {
    conditions.push("submitted_by = 'MINED'");
  }
  if (availableColumns.includes('created_by')) {
    conditions.push("created_by = 'MINED'");
  }
  
  // Check citation fields
  let citationField = null;
  if (availableColumns.includes('citation')) {
    citationField = 'citation';
  } else if (availableColumns.includes('citation_text')) {
    citationField = 'citation_text';
  }
  
  if (citationField) {
    conditions.push(`${citationField} ILIKE '%RESEARCH%'`);
  }
  
  // Also check canonical_sources for MODULE RESEARCH
  const whereClause = conditions.length > 0 
    ? `AND (${conditions.join(' OR ')})`
    : '';
  
  const query = `
    SELECT
      ocq.candidate_id::text as id,
      ocq.title,
      ocq.snippet_text,
      ocq.ofc_origin,
      ocq.created_at,
      ${availableColumns.includes('submitted_by') ? 'ocq.submitted_by,' : ''}
      ${availableColumns.includes('created_by') ? 'ocq.created_by,' : ''}
      cs.title as source_title,
      cs.citation_text
    FROM public.ofc_candidate_queue ocq
    LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
    WHERE ocq.ofc_origin = 'MODULE'
      ${whereClause}
    ORDER BY ocq.created_at
  `;
  
  const result = await client.query(query);
  return result.rows;
}

async function reclassify(client, misclassified, dryRun = true) {
  if (misclassified.length === 0) {
    console.log('✅ No misclassified candidates found');
    return 0;
  }
  
  const ids = misclassified.map(r => r.id);
  
  if (dryRun) {
    console.log(`\n🔍 DRY RUN: Would reclassify ${ids.length} candidates:`);
    misclassified.forEach((row, idx) => {
      console.log(`\n   ${idx + 1}. ID: ${row.id}`);
      console.log(`      Title: ${row.title || '(no title)'}`);
      console.log(`      Source: ${row.source_title || 'N/A'}`);
      console.log(`      Citation: ${row.citation_text || 'N/A'}`);
      if (row.submitted_by) console.log(`      submitted_by: ${row.submitted_by}`);
      if (row.created_by) console.log(`      created_by: ${row.created_by}`);
      console.log(`      Created: ${row.created_at}`);
      console.log(`      Snippet preview: ${(row.snippet_text || '').substring(0, 100)}...`);
    });
    return 0;
  } else {
    console.log(`\n🔄 Reclassifying ${ids.length} candidates to CORPUS...`);
    
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await client.query(`
      UPDATE public.ofc_candidate_queue
      SET ofc_origin = 'CORPUS'
      WHERE candidate_id::text IN (${placeholders})
        AND ofc_origin = 'MODULE'
      RETURNING candidate_id::text as id
    `, ids);
    
    console.log(`   ✅ Reclassified ${result.rows.length} candidates`);
    return result.rows.length;
  }
}

async function main() {
  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  
  if (!corpusUrl) {
    console.error('❌ CORPUS_DATABASE_URL not found');
    process.exit(1);
  }
  
  const connectionString = ensureNodePgTls(corpusUrl) ?? corpusUrl;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );

  try {
    await client.connect();

    console.log('='.repeat(80));
    console.log('Reclassify Mis-Tagged MODULE Candidates');
    console.log('='.repeat(80));
    console.log('');
    
    // Step 1: Check schema
    console.log('[1/5] Checking table schema...');
    const availableColumns = await checkSchema(client);
    console.log(`   Available columns: ${availableColumns.join(', ') || 'none'}`);
    console.log('');
    
    // Step 2: Identify misclassified candidates
    console.log('[2/5] Identifying misclassified candidates...');
    const misclassified = await identifyMisclassified(client, availableColumns);
    console.log(`   Found ${misclassified.length} potentially misclassified candidates`);
    console.log('');
    
    // Step 3: Show current distribution
    console.log('[3/5] Current distribution:');
    const currentDist = await client.query(`
      SELECT ofc_origin, count(*) as count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    currentDist.rows.forEach(row => {
      console.log(`   ${row.ofc_origin}: ${row.count}`);
    });
    console.log('');
    
    // Step 4: Dry run
    console.log('[4/5] DRY RUN - Showing candidates that would be reclassified:');
    await reclassify(client, misclassified, true);
    
    if (misclassified.length === 0) {
      console.log('\n✅ No misclassified candidates found - nothing to do!');
      return;
    }
    
    // Step 5: Ask for confirmation (in real scenario) or proceed
    console.log('\n' + '='.repeat(80));
    console.log('Ready to reclassify. Run with --apply to execute:');
    console.log('  node tools/reclassify_misclassified_module_candidates.js --apply');
    console.log('='.repeat(80));
    
    // Check if --apply flag is set
    const args = process.argv.slice(2);
    if (args.includes('--apply')) {
      console.log('\n[5/5] Applying reclassification...');
      const updated = await reclassify(client, misclassified, false);
      
      // Verify new distribution
      console.log('\n📊 New distribution:');
      const newDist = await client.query(`
        SELECT ofc_origin, count(*) as count
        FROM public.ofc_candidate_queue
        GROUP BY ofc_origin
        ORDER BY ofc_origin
      `);
      newDist.rows.forEach(row => {
        console.log(`   ${row.ofc_origin}: ${row.count}`);
      });
      
      console.log('\n✅ Reclassification complete!');
      console.log('   - Candidates removed from Module Data Management');
      console.log('   - Candidates available for assessment targeting');
      console.log('   - All data preserved (IDs, timestamps, targets)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
