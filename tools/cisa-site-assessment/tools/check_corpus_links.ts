#!/usr/bin/env tsx
import { getCorpusPool } from '../app/lib/db/corpus_client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getCorpusPool();
  
  // Check for module_source_documents for MODULE_EV_PARKING
  const result = await pool.query(`
    SELECT 
      msd.module_source_id,
      msd.corpus_document_id,
      msd.module_code,
      cd.inferred_title
    FROM public.module_source_documents msd
    INNER JOIN public.corpus_documents cd ON cd.id = msd.corpus_document_id
    WHERE msd.module_code = 'MODULE_EV_PARKING'
    LIMIT 10
  `);
  
  console.log(`Found ${result.rows.length} linked documents for MODULE_EV_PARKING:`);
  result.rows.forEach((r: any) => {
    console.log(`  Document: ${r.inferred_title?.substring(0, 50) || 'N/A'}, module_source_id=${r.module_source_id}`);
  });
  
  await pool.end();
}

main();
