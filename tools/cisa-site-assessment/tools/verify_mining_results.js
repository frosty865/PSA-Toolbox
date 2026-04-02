#!/usr/bin/env node
/**
 * Verify mining results after running mine_ofc_candidates_from_chunks_v3.py
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function verifyMining() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    
    console.log('='.repeat(80));
    console.log('Mining Results Verification');
    console.log('='.repeat(80));
    console.log('');
    
    // Check candidate counts by origin
    console.log('1. Candidate counts by origin:');
    const countsResult = await client.query(`
      SELECT ofc_origin, COUNT(*) AS count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    
    countsResult.rows.forEach(row => {
      console.log(`   ${row.ofc_origin}: ${row.count}`);
    });
    
    const corpusCount = parseInt(countsResult.rows.find(r => r.ofc_origin === 'CORPUS')?.count || '0', 10);
    const moduleCount = parseInt(countsResult.rows.find(r => r.ofc_origin === 'MODULE')?.count || '0', 10);
    
    if (corpusCount > 0) {
      console.log(`   ✅ CORPUS candidates: ${corpusCount}`);
    } else {
      console.log(`   ⚠️  No CORPUS candidates found`);
    }
    
    // Check source_kind distribution for CORPUS candidates
    console.log('\n2. CORPUS candidate source_kind distribution:');
    const sourceKindResult = await client.query(`
      SELECT
        COALESCE(cs.source_kind, 'UNKNOWN') AS source_kind,
        COUNT(*) AS candidate_count
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE ocq.ofc_origin = 'CORPUS'
      GROUP BY cs.source_kind
      ORDER BY candidate_count DESC
    `);
    
    if (sourceKindResult.rows.length > 0) {
      sourceKindResult.rows.forEach(row => {
        console.log(`   ${row.source_kind}: ${row.candidate_count} candidates`);
      });
    } else {
      console.log('   ⚠️  No source_kind data available (candidates may not have source_id)');
    }
    
    // Check for MODULE_RESEARCH sources in CORPUS candidates (should be 0 by default)
    console.log('\n3. MODULE_RESEARCH source check:');
    const moduleResearchCheck = await client.query(`
      SELECT COUNT(*) AS count
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE ocq.ofc_origin = 'CORPUS'
        AND cs.source_kind = 'MODULE_RESEARCH'
    `);
    
    const moduleResearchCount = parseInt(moduleResearchCheck.rows[0].count, 10);
    if (moduleResearchCount === 0) {
      console.log(`   ✅ No MODULE_RESEARCH sources in CORPUS candidates (guardrail working)`);
    } else {
      console.log(`   ⚠️  Found ${moduleResearchCount} CORPUS candidates from MODULE_RESEARCH sources`);
      console.log(`   This suggests --allow-module-research was used or guardrail failed`);
    }
    
    // Check recent candidates
    console.log('\n4. Recent CORPUS candidates (last 5):');
    const recentResult = await client.query(`
      SELECT 
        candidate_id,
        title,
        LEFT(snippet_text, 100) AS snippet_preview,
        status,
        created_at
      FROM public.ofc_candidate_queue
      WHERE ofc_origin = 'CORPUS'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (recentResult.rows.length > 0) {
      recentResult.rows.forEach((row, idx) => {
        console.log(`\n   ${idx + 1}. ${row.candidate_id}`);
        console.log(`      Title: ${row.title || 'N/A'}`);
        console.log(`      Status: ${row.status}`);
        console.log(`      Created: ${row.created_at}`);
        console.log(`      Preview: ${row.snippet_preview || 'N/A'}...`);
      });
    } else {
      console.log('   ⚠️  No CORPUS candidates found');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    
    if (corpusCount > 0) {
      console.log(`✅ Mining successful: ${corpusCount} CORPUS candidates created`);
      if (moduleResearchCount === 0) {
        console.log('✅ Guardrail working: No MODULE_RESEARCH sources in CORPUS candidates');
      }
      console.log('\nNext: Run npm run targets:baseline to build candidate targets');
    } else {
      console.log('⚠️  No CORPUS candidates found');
      console.log('   Possible reasons:');
      console.log('   - Mining script not run yet');
      console.log('   - Mining script failed');
      console.log('   - No chunks matched mining criteria');
      console.log('\n   Action: Run mining script:');
      console.log('   python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyMining().catch(console.error);
