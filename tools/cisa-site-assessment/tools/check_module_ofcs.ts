#!/usr/bin/env tsx
import { getRuntimePool } from '../app/lib/db/runtime_client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = getRuntimePool();
  
  // Check OFCs by module
  const result = await pool.query(`
    SELECT 
      module_code, 
      COUNT(*) as count,
      MIN(created_at) as first_created,
      MAX(created_at) as last_created
    FROM public.module_ofcs 
    GROUP BY module_code 
    ORDER BY module_code
  `);
  
  console.log('OFCs by module:');
  if (result.rows.length === 0) {
    console.log('  No OFCs found in any module');
  } else {
    result.rows.forEach((r: any) => {
      console.log(`  ${r.module_code}: ${r.count} OFCs (first: ${r.first_created}, last: ${r.last_created})`);
    });
  }
  
  // Check for a specific module (MODULE_EV_PARKING as example)
  const specificModule = 'MODULE_EV_PARKING';
  
  // Check if discipline_subtype_id column exists
  const colCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'module_ofcs' 
      AND column_name = 'discipline_subtype_id'
  `);
  const hasDisciplineSubtypeId = colCheck.rows.length > 0;
  
  const selectCols = ['id', 'ofc_id', 'ofc_text', 'order_index', 'created_at'];
  if (hasDisciplineSubtypeId) {
    selectCols.push('discipline_subtype_id');
  }
  
  const specificResult = await pool.query(`
    SELECT ${selectCols.join(', ')}
    FROM public.module_ofcs
    WHERE module_code = $1
    ORDER BY order_index, created_at
    LIMIT 10
  `, [specificModule]);
  
  console.log(`\nRecent OFCs for ${specificModule}:`);
  if (specificResult.rows.length === 0) {
    console.log(`  No OFCs found for ${specificModule}`);
  } else {
    specificResult.rows.forEach((r: any) => {
      console.log(`  ${r.ofc_id} (id=${r.id}, order=${r.order_index}, created=${r.created_at})`);
      console.log(`    text: ${r.ofc_text?.substring(0, 60)}...`);
      console.log(`    discipline_subtype_id: ${r.discipline_subtype_id || 'NULL'}`);
    });
  }
  
  await pool.end();
}

main();
