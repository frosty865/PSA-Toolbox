#!/usr/bin/env node
/**
 * Trace citation source for candidates
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function traceCitation() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    
    console.log('='.repeat(80));
    console.log('Citation Data Trace');
    console.log('='.repeat(80));
    console.log('');
    
    // Find candidates with MODULE RESEARCH citation
    const result = await client.query(`
      SELECT 
        ocq.candidate_id,
        ocq.ofc_origin,
        ocq.title,
        ocq.source_id,
        cs.title as source_title,
        cs.citation_text,
        cs.source_id as canonical_source_id
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE cs.citation_text ILIKE '%MODULE RESEARCH%'
         OR cs.title ILIKE '%MODULE RESEARCH%'
      ORDER BY ocq.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} candidates with MODULE RESEARCH citation:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. Candidate ID: ${row.candidate_id}`);
      console.log(`   Title: ${row.title || '(no title)'}`);
      console.log(`   ofc_origin: ${row.ofc_origin} ← This determines visibility`);
      console.log(`   source_id: ${row.source_id}`);
      console.log(`   Source Title: ${row.source_title || 'N/A'}`);
      console.log(`   Citation Text: ${row.citation_text || 'N/A'} ← This is just metadata`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    console.log('Data Flow Summary');
    console.log('='.repeat(80));
    console.log('');
    console.log('1. Database: canonical_sources.citation_text (metadata)');
    console.log('   ↓ (via source_id foreign key)');
    console.log('2. Database: ofc_candidate_queue.source_id');
    console.log('   ↓ (via SQL LEFT JOIN)');
    console.log('3. API: /api/admin/ofcs/review-queue');
    console.log('   - Selects: cs.citation_text');
    console.log('   - Joins: LEFT JOIN canonical_sources cs ON ocq.source_id = cs.source_id');
    console.log('   ↓ (via HTTP response)');
    console.log('4. UI: /admin/ofcs (Review Queue page)');
    console.log('   - Displays: {ofc.citation}');
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('   - Citation text is descriptive metadata only');
    console.log('   - ofc_origin column determines which UI shows the candidate');
    console.log('   - CORPUS candidates can have "MODULE RESEARCH" citation (it\'s just the source name)');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

traceCitation().catch(console.error);
