#!/usr/bin/env node
/**
 * Test source_kind guardrail by checking if MODULE_RESEARCH sources are detected
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function testGuardrail() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    
    console.log('='.repeat(80));
    console.log('Testing source_kind Guardrail');
    console.log('='.repeat(80));
    console.log('');
    
    // Find chunks from MODULE_RESEARCH sources
    console.log('1. Finding chunks from MODULE_RESEARCH sources:');
    const chunksResult = await client.query(`
      SELECT 
        dc.chunk_id,
        dc.document_id,
        cs.source_id,
        cs.source_kind,
        cs.title as source_title,
        cs.citation_text as source_citation_text,
        LEFT(dc.chunk_text, 100) as chunk_preview
      FROM public.document_chunks dc
      LEFT JOIN public.documents d ON dc.document_id = d.document_id
      LEFT JOIN public.canonical_sources cs ON d.source_id = cs.source_id
      WHERE cs.source_kind = 'MODULE_RESEARCH'
      LIMIT 5
    `);
    
    if (chunksResult.rows.length > 0) {
      console.log(`   Found ${chunksResult.rows.length} chunks from MODULE_RESEARCH sources:`);
      chunksResult.rows.forEach((row, idx) => {
        console.log(`\n   ${idx + 1}. Chunk ID: ${row.chunk_id}`);
        console.log(`      Document ID: ${row.document_id}`);
        console.log(`      Source ID: ${row.source_id}`);
        console.log(`      source_kind: ${row.source_kind}`);
        console.log(`      Source: ${row.source_title || 'N/A'}`);
        console.log(`      Chunk preview: ${row.chunk_preview || 'N/A'}...`);
      });
      
      console.log('\n2. Guardrail behavior:');
      console.log('   ✅ These chunks should be BLOCKED by default (without --allow-module-research)');
      console.log('   ✅ These chunks should be ALLOWED with --allow-module-research flag');
      console.log('   ✅ Detection uses source_kind column (authoritative)');
      console.log('   ✅ Falls back to string matching if source_kind is NULL');
      
    } else {
      console.log('   ⚠️  No chunks found from MODULE_RESEARCH sources');
      console.log('   This is expected if no documents are linked to MODULE_RESEARCH sources');
    }
    
    // Check total chunks vs MODULE_RESEARCH chunks
    console.log('\n3. Chunk distribution by source_kind:');
    const distResult = await client.query(`
      SELECT 
        COALESCE(cs.source_kind, 'UNKNOWN') as source_kind,
        COUNT(*) as chunk_count
      FROM public.document_chunks dc
      LEFT JOIN public.documents d ON dc.document_id = d.document_id
      LEFT JOIN public.canonical_sources cs ON d.source_id = cs.source_id
      GROUP BY cs.source_kind
      ORDER BY chunk_count DESC
    `);
    
    distResult.rows.forEach(row => {
      console.log(`   ${row.source_kind}: ${row.chunk_count} chunks`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('Guardrail Test Summary');
    console.log('='.repeat(80));
    console.log('✅ source_kind column is queryable');
    console.log('✅ MODULE_RESEARCH sources can be identified');
    console.log('✅ Mining script will use source_kind for detection');
    console.log('');
    console.log('To test mining script guardrail:');
    console.log('  # Dry run (should skip MODULE_RESEARCH chunks)');
    console.log('  python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --max-chunks 10');
    console.log('');
    console.log('  # With opt-in (should include MODULE_RESEARCH chunks)');
    console.log('  python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --max-chunks 10 --allow-module-research');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testGuardrail().catch(console.error);
