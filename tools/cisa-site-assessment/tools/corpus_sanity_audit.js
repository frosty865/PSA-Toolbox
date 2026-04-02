#!/usr/bin/env node
/**
 * CORPUS Data Sanity Audit
 * Step 1: Verify documents, chunks, and source linkage
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function auditCorpus() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    
    console.log('='.repeat(80));
    console.log('CORPUS Data Sanity Audit');
    console.log('='.repeat(80));
    console.log('');
    
    // A) Check corpus_documents
    console.log('A) Corpus Documents:');
    const docsResult = await client.query(`
      SELECT COUNT(*) AS docs FROM public.corpus_documents
    `);
    const docCount = parseInt(docsResult.rows[0].docs, 10);
    console.log(`   Total documents: ${docCount}`);
    if (docCount === 0) {
      console.log('   ⚠️  WARNING: No corpus documents found!');
      console.log('   You need to ingest PDFs into CORPUS first.');
    } else {
      console.log('   ✅ Documents exist');
    }
    
    // Check document_chunks
    console.log('\nB) Document Chunks:');
    const chunksResult = await client.query(`
      SELECT COUNT(*) AS chunks FROM public.document_chunks
    `);
    const chunkCount = parseInt(chunksResult.rows[0].chunks, 10);
    console.log(`   Total chunks: ${chunkCount}`);
    if (chunkCount === 0) {
      console.log('   ⚠️  WARNING: No chunks found!');
      console.log('   Mining will do nothing without chunks.');
    } else {
      console.log('   ✅ Chunks exist');
    }
    
    // B) Check source linkage (via corpus_documents -> source_registry -> canonical_sources)
    console.log('\nC) Source Linkage:');
    
    // Check if corpus_documents table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('corpus_documents', 'documents')
    `);
    
    const hasCorpusDocuments = tableCheck.rows.some(r => r.table_name === 'corpus_documents');
    const hasDocuments = tableCheck.rows.some(r => r.table_name === 'documents');
    
    let linkageResult;
    if (hasCorpusDocuments) {
      // Use corpus_documents -> source_registry -> canonical_sources path
      linkageResult = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE cs.source_id IS NULL) AS chunks_missing_source,
          COUNT(*) FILTER (WHERE cs.source_id IS NOT NULL) AS chunks_with_source
        FROM public.document_chunks dc
        LEFT JOIN public.corpus_documents cd ON dc.document_id = cd.id
        LEFT JOIN public.source_registry sr ON cd.source_registry_id = sr.id
        LEFT JOIN public.canonical_sources cs ON sr.source_key = cs.source_key
      `);
    } else if (hasDocuments) {
      // Use documents -> canonical_sources path
      linkageResult = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE d.source_id IS NULL) AS chunks_missing_source,
          COUNT(*) FILTER (WHERE d.source_id IS NOT NULL) AS chunks_with_source
        FROM public.document_chunks dc
        LEFT JOIN public.documents d ON dc.document_id = d.document_id
      `);
    } else {
      console.log('   ⚠️  Could not find corpus_documents or documents table');
      linkageResult = { rows: [{ chunks_missing_source: 0, chunks_with_source: 0 }] };
    }
    
    const missingSource = parseInt(linkageResult.rows[0].chunks_missing_source, 10);
    const withSource = parseInt(linkageResult.rows[0].chunks_with_source, 10);
    console.log(`   Chunks with source: ${withSource}`);
    console.log(`   Chunks missing source: ${missingSource}`);
    if (withSource === 0) {
      console.log('   ⚠️  WARNING: No chunks have source linkage!');
      console.log('   Mining may fail or create UNKNOWN sources.');
    } else {
      console.log('   ✅ Source linkage exists');
    }
    
    // C) Chunk distribution by source_kind
    console.log('\nD) Chunk Distribution by source_kind:');
    let distResult;
    if (hasCorpusDocuments) {
      // Use corpus_documents -> source_registry -> canonical_sources path
      distResult = await client.query(`
        SELECT
          COALESCE(cs.source_kind, 'UNKNOWN') AS source_kind,
          COUNT(*) AS chunk_count
        FROM public.document_chunks dc
        LEFT JOIN public.corpus_documents cd ON dc.document_id = cd.id
        LEFT JOIN public.source_registry sr ON cd.source_registry_id = sr.id
        LEFT JOIN public.canonical_sources cs ON sr.source_key = cs.source_key
        GROUP BY cs.source_kind
        ORDER BY chunk_count DESC
      `);
    } else if (hasDocuments) {
      // Use documents -> canonical_sources path
      distResult = await client.query(`
        SELECT
          COALESCE(cs.source_kind, 'UNKNOWN') AS source_kind,
          COUNT(*) AS chunk_count
        FROM public.document_chunks dc
        LEFT JOIN public.documents d ON dc.document_id = d.document_id
        LEFT JOIN public.canonical_sources cs ON d.source_id = cs.source_id
        GROUP BY cs.source_kind
        ORDER BY chunk_count DESC
      `);
    } else {
      distResult = { rows: [] };
    }
    
    if (distResult.rows.length > 0) {
      distResult.rows.forEach(row => {
        console.log(`   ${row.source_kind}: ${row.chunk_count} chunks`);
      });
      
      const corpusChunks = distResult.rows.find(r => r.source_kind === 'CORPUS');
      const moduleChunks = distResult.rows.find(r => r.source_kind === 'MODULE_RESEARCH');
      
      if (corpusChunks && parseInt(corpusChunks.chunk_count, 10) > 0) {
        console.log('   ✅ CORPUS chunks available for mining');
      } else {
        console.log('   ⚠️  No CORPUS chunks found');
      }
      
      if (moduleChunks && parseInt(moduleChunks.chunk_count, 10) > 0) {
        console.log(`   ℹ️  ${moduleChunks.chunk_count} MODULE_RESEARCH chunks (will be blocked by default)`);
      }
    } else {
      console.log('   ⚠️  Could not determine source_kind distribution');
    }
    
    // Check existing candidates
    console.log('\nE) Existing Candidates:');
    const candidatesResult = await client.query(`
      SELECT ofc_origin, COUNT(*) AS count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    candidatesResult.rows.forEach(row => {
      console.log(`   ${row.ofc_origin}: ${row.count}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('Audit Summary');
    console.log('='.repeat(80));
    
    if (docCount === 0 || chunkCount === 0) {
      console.log('❌ CORPUS data missing - cannot proceed with mining');
      console.log('   Next: Ingest PDFs into CORPUS first');
    } else if (withSource === 0) {
      console.log('⚠️  Chunks exist but lack source linkage');
      console.log('   Mining may create UNKNOWN sources');
    } else {
      console.log('✅ CORPUS data ready for mining');
      console.log('   Next: Run mining script');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

auditCorpus().catch(console.error);
