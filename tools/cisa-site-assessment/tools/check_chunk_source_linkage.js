#!/usr/bin/env node
/**
 * Check chunk source linkage paths
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function checkLinkage() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    
    console.log('='.repeat(80));
    console.log('Chunk Source Linkage Check');
    console.log('='.repeat(80));
    console.log('');
    
    // Check tables
    console.log('1. Available tables:');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('corpus_documents', 'documents', 'document_chunks', 'source_registry', 'canonical_sources')
      ORDER BY table_name
    `);
    tablesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check document_chunks columns
    console.log('\n2. document_chunks columns:');
    const chunkCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'document_chunks'
        AND (column_name LIKE '%document%' OR column_name LIKE '%source%')
      ORDER BY column_name
    `);
    chunkCols.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type})`);
    });
    
    // Check sample chunks
    console.log('\n3. Sample chunk document_id values:');
    const sampleChunks = await client.query(`
      SELECT DISTINCT document_id
      FROM public.document_chunks
      LIMIT 5
    `);
    console.log(`   Found ${sampleChunks.rows.length} unique document_ids`);
    sampleChunks.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.document_id}`);
    });
    
    // Check if these document_ids exist in corpus_documents
    if (sampleChunks.rows.length > 0) {
      const docId = sampleChunks.rows[0].document_id;
      console.log(`\n4. Checking document_id ${docId}:`);
      
      // First check corpus_documents columns
      const corpusCols = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'corpus_documents'
      `);
      const corpusColNames = corpusCols.rows.map(r => r.column_name);
      
      const selectCols = ['id'];
      if (corpusColNames.includes('title')) selectCols.push('title');
      if (corpusColNames.includes('source_registry_id')) selectCols.push('source_registry_id');
      if (corpusColNames.includes('file_name')) selectCols.push('file_name');
      
      const corpusDocCheck = await client.query(`
        SELECT ${selectCols.join(', ')}
        FROM public.corpus_documents
        WHERE id = $1
      `, [docId]);
      
      if (corpusDocCheck.rows.length > 0) {
        console.log(`   ✅ Found in corpus_documents:`);
        const doc = corpusDocCheck.rows[0];
        console.log(`      Title: ${doc.title || 'N/A'}`);
        console.log(`      source_registry_id: ${doc.source_registry_id || 'NULL'}`);
        
        if (doc.source_registry_id) {
          const sourceCheck = await client.query(`
            SELECT sr.id, sr.source_key, cs.source_id, cs.source_kind, cs.title
            FROM public.source_registry sr
            LEFT JOIN public.canonical_sources cs ON sr.source_key = cs.source_key
            WHERE sr.id = $1
          `, [doc.source_registry_id]);
          
          if (sourceCheck.rows.length > 0) {
            const src = sourceCheck.rows[0];
            console.log(`      source_key: ${src.source_key || 'N/A'}`);
            console.log(`      canonical source_id: ${src.source_id || 'NULL'}`);
            console.log(`      source_kind: ${src.source_kind || 'NULL'}`);
            console.log(`      source title: ${src.title || 'N/A'}`);
          }
        }
      } else {
        console.log(`   ❌ NOT found in corpus_documents`);
      }
      
      const documentsCheck = await client.query(`
        SELECT document_id, title, source_id
        FROM public.documents
        WHERE document_id = $1
      `, [docId]);
      
      if (documentsCheck.rows.length > 0) {
        console.log(`   ✅ Found in documents table:`);
        const doc = documentsCheck.rows[0];
        console.log(`      Title: ${doc.title || 'N/A'}`);
        console.log(`      source_id: ${doc.source_id || 'NULL'}`);
      } else {
        console.log(`   ❌ NOT found in documents table`);
      }
    }
    
    // Count chunks with valid linkage
    console.log('\n5. Chunk linkage counts:');
    const linkageCounts = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE cd.id IS NOT NULL) AS via_corpus_documents,
        COUNT(*) FILTER (WHERE d.document_id IS NOT NULL) AS via_documents,
        COUNT(*) FILTER (WHERE cs.source_id IS NOT NULL) AS with_canonical_source
      FROM public.document_chunks dc
      LEFT JOIN public.corpus_documents cd ON dc.document_id = cd.id
      LEFT JOIN public.documents d ON dc.document_id = d.document_id
      LEFT JOIN public.source_registry sr ON cd.source_registry_id = sr.id
      LEFT JOIN public.canonical_sources cs ON sr.source_key = cs.source_key OR d.source_id = cs.source_id
    `);
    const counts = linkageCounts.rows[0];
    console.log(`   Via corpus_documents: ${counts.via_corpus_documents}`);
    console.log(`   Via documents table: ${counts.via_documents}`);
    console.log(`   With canonical_source: ${counts.with_canonical_source}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkLinkage().catch(console.error);
