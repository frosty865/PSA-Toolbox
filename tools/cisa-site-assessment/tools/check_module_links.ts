#!/usr/bin/env tsx
import { getRuntimePool } from '../app/lib/db/runtime_client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getRuntimePool();
  
  const result = await pool.query(`
    SELECT 
      ms.id, 
      ms.source_label, 
      ms.source_url, 
      ms.sha256,
      (SELECT COUNT(*) FROM public.module_source_documents msd WHERE msd.module_source_id = ms.id) as link_count
    FROM public.module_sources ms
    WHERE ms.module_code = 'MODULE_EV_PARKING'
      AND ms.source_type = 'MODULE_UPLOAD'
      AND ms.storage_relpath LIKE 'raw/%'
    ORDER BY ms.created_at
    LIMIT 10
  `);
  
  console.log('Module sources and link counts:');
  result.rows.forEach((r: any) => {
    console.log(`  ${r.source_label}: links=${r.link_count}, url=${r.source_url?.substring(0, 60) || 'null'}, sha256=${r.sha256?.substring(0, 12)}`);
  });
  
  await pool.end();
}

main();
