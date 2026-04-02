#!/usr/bin/env tsx
/**
 * Restore discipline_subtypes table to CORPUS database
 * 
 * This script:
 * 1. Loads data from taxonomy/discipline_subtypes.json
 * 2. Seeds the CORPUS database's discipline_subtypes table
 * 3. Uses UPSERT to handle existing records
 * 
 * Usage:
 *   npx tsx tools/restore_discipline_subtypes_corpus.ts
 */

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getCorpusPool } from '../app/lib/db/corpus_client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface SubtypeData {
  id: string;
  name: string;
  subtype_code: string;
  description: string | null;
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  is_active: boolean;
}

interface ArchiveData {
  metadata: {
    version: string;
    total_subtypes: number;
    generated_at: string;
    authority: string;
  };
  subtypes: SubtypeData[];
}

async function restoreData(pool: any, subtypes: SubtypeData[]) {
  console.log(`\nRestoring ${subtypes.length} discipline subtypes to CORPUS database...`);
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const subtype of subtypes) {
    try {
      // UPSERT: Insert or update
      const result = await pool.query(`
        INSERT INTO public.discipline_subtypes (
          id,
          discipline_id,
          name,
          description,
          code,
          is_active,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          discipline_id = EXCLUDED.discipline_id,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          code = EXCLUDED.code,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `, [
        subtype.id,
        subtype.discipline_id,
        subtype.name,
        subtype.description || null,
        subtype.subtype_code || null,
        subtype.is_active !== false
      ]);
      
      if (result.rowCount === 1) {
        // Check if it was an insert or update by checking if it existed before
        const checkResult = await pool.query(
          'SELECT id FROM public.discipline_subtypes WHERE id = $1',
          [subtype.id]
        );
        // This is a bit of a hack - we'll count as inserted if the row didn't exist
        // In practice, UPSERT will return rowCount=1 for both insert and update
        inserted++;
      }
    } catch (error: any) {
      errors++;
      console.error(`  ✗ Error restoring ${subtype.name} (${subtype.id}):`, error.message);
      
      // Check if it's a foreign key constraint error (discipline_id doesn't exist)
      if (error.code === '23503') {
        console.error(`    ⚠️  Discipline ${subtype.discipline_id} not found in CORPUS. You may need to seed disciplines first.`);
      }
    }
  }
  
  console.log(`\n✓ Restoration complete:`);
  console.log(`  - Processed: ${subtypes.length}`);
  console.log(`  - Inserted/Updated: ${inserted}`);
  console.log(`  - Errors: ${errors}`);
  
  if (errors > 0) {
    console.log(`\n⚠️  Some subtypes failed to restore. Check errors above.`);
  }
}

async function verifyRestoration(pool: any) {
  console.log('\nVerifying restoration...');
  
  const countResult = await pool.query('SELECT COUNT(*) as count FROM public.discipline_subtypes');
  const count = parseInt(countResult.rows[0].count);
  
  console.log(`  Total subtypes in CORPUS: ${count}`);
  
  const activeResult = await pool.query(
    'SELECT COUNT(*) as count FROM public.discipline_subtypes WHERE is_active = true'
  );
  const activeCount = parseInt(activeResult.rows[0].count);
  
  console.log(`  Active subtypes: ${activeCount}`);
  
  if (count === 0) {
    console.log('\n⚠️  WARNING: No subtypes found in CORPUS database.');
    console.log('   The table may be empty or the migration was not applied.');
  } else if (count < 100) {
    console.log('\n⚠️  WARNING: Fewer subtypes than expected (expected ~104).');
    console.log('   Some subtypes may have failed to restore.');
  } else {
    console.log('\n✅ Restoration verified successfully!');
  }
}

async function main() {
  console.log('Restore Discipline Subtypes to CORPUS Database');
  console.log('===============================================\n');
  
  // Load taxonomy file
  const taxonomyPath = join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
  console.log(`Loading taxonomy from: ${taxonomyPath}`);
  
  if (!require('fs').existsSync(taxonomyPath)) {
    console.error(`✗ Taxonomy file not found: ${taxonomyPath}`);
    process.exit(1);
  }
  
  const taxonomyContent = readFileSync(taxonomyPath, 'utf-8');
  const taxonomyData: ArchiveData = JSON.parse(taxonomyContent);
  
  console.log(`✓ Loaded taxonomy:`);
  console.log(`  - Version: ${taxonomyData.metadata.version}`);
  console.log(`  - Total subtypes: ${taxonomyData.metadata.total_subtypes}`);
  console.log(`  - Authority: ${taxonomyData.metadata.authority}`);
  
  // Get CORPUS pool
  console.log('\nConnecting to CORPUS database...');
  const pool = getCorpusPool();
  console.log('✓ Connected to CORPUS database');
  
  // Verify table exists
  const tableCheck = await pool.query(`
    SELECT to_regclass('public.discipline_subtypes') as exists
  `);
  
  if (!tableCheck.rows[0]?.exists) {
    console.error('\n✗ ERROR: public.discipline_subtypes table does not exist in CORPUS.');
    console.error('   Please run the migration first:');
    console.error('   migrations/20260123_ensure_taxonomy_discipline_subtypes.sql');
    process.exit(1);
  }
  
  console.log('✓ Table exists');
  
  // Restore data
  await restoreData(pool, taxonomyData.subtypes);
  
  // Verify
  await verifyRestoration(pool);
  
  // Close pool
  await pool.end();
  
  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
