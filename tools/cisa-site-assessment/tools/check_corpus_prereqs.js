#!/usr/bin/env node
/**
 * Quick sanity check: confirm corpus chunks and documents exist
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function checkPrereqs() {
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
    
    console.log('🔍 Checking CORPUS prerequisites...\n');
    
    // Check chunks
    const chunksResult = await client.query('SELECT count(*) AS chunks FROM public.document_chunks');
    const chunks = parseInt(chunksResult.rows[0].chunks);
    console.log(`📄 Document chunks: ${chunks}`);
    
    // Check documents
    const docsResult = await client.query('SELECT count(*) AS docs FROM public.corpus_documents');
    const docs = parseInt(docsResult.rows[0].docs);
    console.log(`📚 Corpus documents: ${docs}`);
    
    // Check existing candidates
    const candidatesResult = await client.query(`
      SELECT ofc_origin, count(*) as count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    console.log(`\n🎯 Existing candidates:`);
    candidatesResult.rows.forEach(row => {
      console.log(`   ${row.ofc_origin}: ${row.count}`);
    });
    
    // Check targets
    const targetsResult = await client.query('SELECT count(*) AS targets FROM public.ofc_candidate_targets');
    const targets = parseInt(targetsResult.rows[0].targets);
    console.log(`\n🔗 Candidate targets: ${targets}`);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (chunks === 0) {
      console.log('❌ No chunks found - need to ingest PDFs first!');
      console.log('   Run PDF ingestion before mining.');
    } else if (docs === 0) {
      console.log('⚠️  No corpus_documents found - may need to set up corpus_documents table');
    } else {
      console.log('✅ Prerequisites met - ready for mining');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkPrereqs().catch(console.error);
