#!/usr/bin/env node
/**
 * Verify Module API filter is working correctly
 */

const { Client } = require('pg');
const path = require('path');
const { loadEnvLocal } = require('../scripts/lib/load_env_local');
const { ensureNodePgTls, applyNodeTls } = require('../scripts/lib/pg_tls');

loadEnvLocal(path.join(__dirname, '..'));

async function verifyFilter() {
  const connectionString = ensureNodePgTls(process.env.CORPUS_DATABASE_URL) ?? process.env.CORPUS_DATABASE_URL;
  const client = new Client(
    applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })
  );
  
  try {
    await client.connect();
    
    console.log('='.repeat(80));
    console.log('Verifying Module API Filter');
    console.log('='.repeat(80));
    console.log('');
    
    // Check current distribution
    console.log('📊 Current database state:');
    const distResult = await client.query(`
      SELECT ofc_origin, count(*) as count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    distResult.rows.forEach(row => {
      console.log(`   ${row.ofc_origin}: ${row.count}`);
    });
    console.log('');
    
    // Test the exact query the API uses
    console.log('🔍 Testing Module API query (should return 0 rows):');
    const apiQueryResult = await client.query(`
      SELECT 
        ocq.candidate_id::text as id,
        ocq.snippet_text as ofc_text,
        ocq.title,
        ocq.status,
        ocq.created_at,
        ocq.ofc_origin,
        cs.title as source_title,
        cs.citation_text
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE ocq.ofc_origin = 'MODULE'
      ORDER BY ocq.created_at DESC
      LIMIT 500
    `);
    
    console.log(`   Found ${apiQueryResult.rows.length} MODULE candidates`);
    
    if (apiQueryResult.rows.length > 0) {
      console.log('\n   ⚠️  WARNING: API query returned MODULE candidates:');
      apiQueryResult.rows.forEach((row, idx) => {
        console.log(`\n   ${idx + 1}. ID: ${row.id}`);
        console.log(`      Title: ${row.title || '(no title)'}`);
        console.log(`      ofc_origin: ${row.ofc_origin}`);
        console.log(`      Source: ${row.source_title || 'N/A'}`);
        console.log(`      Citation: ${row.citation_text || 'N/A'}`);
        console.log(`      Status: ${row.status}`);
      });
    } else {
      console.log('   ✅ API query correctly returns 0 MODULE candidates');
    }
    
    // Check if there are any candidates with MODULE RESEARCH source that are CORPUS
    console.log('\n📋 Checking CORPUS candidates with MODULE RESEARCH source:');
    const corpusWithModuleSource = await client.query(`
      SELECT 
        ocq.candidate_id::text as id,
        ocq.title,
        ocq.ofc_origin,
        cs.title as source_title,
        cs.citation_text
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE ocq.ofc_origin = 'CORPUS'
        AND cs.title = 'MODULE RESEARCH'
      ORDER BY ocq.created_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${corpusWithModuleSource.rows.length} CORPUS candidates with MODULE RESEARCH source`);
    if (corpusWithModuleSource.rows.length > 0) {
      console.log('   ✅ These are correctly classified as CORPUS (source citation is just metadata)');
      corpusWithModuleSource.rows.slice(0, 3).forEach(row => {
        console.log(`      - ${row.title || row.id}: ofc_origin=${row.ofc_origin}, source="${row.source_title}"`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    
    if (apiQueryResult.rows.length === 0) {
      console.log('✅ API filter is working correctly');
      console.log('   If UI still shows candidates, possible causes:');
      console.log('   1. Browser cache - try hard refresh (Ctrl+Shift+R)');
      console.log('   2. Next.js cache - restart dev server');
      console.log('   3. UI calling wrong endpoint - check network tab');
    } else {
      console.log('❌ API filter issue: Found MODULE candidates that should not exist');
      console.log('   These need to be reclassified to CORPUS');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyFilter().catch(console.error);
