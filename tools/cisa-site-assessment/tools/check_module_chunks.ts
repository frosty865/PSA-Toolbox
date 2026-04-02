#!/usr/bin/env tsx
import { getCorpusPool } from '../app/lib/db/corpus_client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getCorpusPool();
  
  // Check for module_chunk_links for MODULE_EV_PARKING
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_chunks,
      COUNT(DISTINCT mcl.chunk_id) as unique_chunks,
      COUNT(DISTINCT dc.document_id) as unique_documents
    FROM public.module_chunk_links mcl
    INNER JOIN public.document_chunks dc ON dc.chunk_id = mcl.chunk_id
    WHERE mcl.module_code = 'MODULE_EV_PARKING'
  `);
  
  console.log('Module chunk links for MODULE_EV_PARKING:');
  if (result.rows.length > 0) {
    const r = result.rows[0];
    console.log(`  Total chunk links: ${r.total_chunks}`);
    console.log(`  Unique chunks: ${r.unique_chunks}`);
    console.log(`  Unique documents: ${r.unique_documents}`);
  }
  
  // Also check document links
  const docResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM public.module_source_documents
    WHERE module_code = 'MODULE_EV_PARKING'
  `);
  
  console.log(`  Linked documents: ${docResult.rows[0]?.count || 0}`);
  
  await pool.end();
}

main();
