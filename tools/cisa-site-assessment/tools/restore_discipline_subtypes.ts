#!/usr/bin/env tsx
/**
 * Restore discipline_subtypes table from archive
 * 
 * This script:
 * 1. Creates the discipline_subtypes table if it doesn't exist
 * 2. Imports data from taxonomy/discipline_subtypes.json
 * 3. Uses UPSERT to handle existing records
 * 
 * Usage:
 *   npx tsx tools/restore_discipline_subtypes.ts
 */

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Clean up environment variables (remove trailing slashes/backslashes)
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

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

async function createTable(pool: any) {
  console.log('Creating discipline_subtypes table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.discipline_subtypes (
      id uuid PRIMARY KEY,
      discipline_id uuid NOT NULL,
      name text NOT NULL,
      description text,
      code text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      overview text,
      indicators_of_risk text[],
      common_failures text[],
      assessment_questions text[],
      mitigation_guidance text[],
      standards_references text[],
      psa_notes text,
      
      CONSTRAINT fk_discipline_subtypes_discipline
        FOREIGN KEY (discipline_id)
        REFERENCES public.disciplines(id)
        ON DELETE RESTRICT
    );
    
    CREATE INDEX IF NOT EXISTS idx_discipline_subtypes_discipline_id
      ON public.discipline_subtypes(discipline_id);
    
    CREATE INDEX IF NOT EXISTS idx_discipline_subtypes_code
      ON public.discipline_subtypes(code)
      WHERE code IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_discipline_subtypes_active
      ON public.discipline_subtypes(is_active)
      WHERE is_active = true;
    
    COMMENT ON TABLE public.discipline_subtypes IS
    'Discipline subtypes - detailed categorization within each discipline';
    
    COMMENT ON COLUMN public.discipline_subtypes.code IS
    'Stable subtype code identifier (format: DISCIPLINE_CODE_SUBTYPE_SLUG)';
  `;
  
  await pool.query(createTableSQL);
  console.log('✓ Table created/verified');
}

async function restoreData(pool: any, subtypes: SubtypeData[]) {
  console.log(`\nRestoring ${subtypes.length} discipline subtypes...`);
  
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const subtype of subtypes) {
    try {
      // Use subtype_code from JSON as the code column
      const result = await pool.query(
        `INSERT INTO public.discipline_subtypes (
          id, discipline_id, name, description, code, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, now(), now())
        ON CONFLICT (id) DO UPDATE SET
          discipline_id = EXCLUDED.discipline_id,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          code = EXCLUDED.code,
          is_active = EXCLUDED.is_active,
          updated_at = now()
        RETURNING id`,
        [
          subtype.id,
          subtype.discipline_id,
          subtype.name,
          subtype.description,
          subtype.subtype_code, // Map subtype_code to code column
          subtype.is_active
        ]
      );
      
      if (result.rows.length > 0) {
        // Check if it was an insert or update by checking if updated_at changed
        // (This is approximate - we'll count as updated if conflict occurred)
        updated++;
      } else {
        inserted++;
      }
    } catch (error: any) {
      const errCode = error.code || '';
      const errMessage = error.message || '';
      
      // Check if discipline_id doesn't exist
      if (errCode === '23503') {
        console.warn(`⚠ Skipping subtype "${subtype.name}" (${subtype.subtype_code}): discipline_id ${subtype.discipline_id} not found`);
        skipped++;
      } else {
        console.error(`✗ Error restoring subtype "${subtype.name}" (${subtype.subtype_code}):`, errMessage);
        errors++;
      }
    }
  }
  
  console.log(`\n✓ Restoration complete:`);
  console.log(`  - Inserted: ${inserted}`);
  console.log(`  - Updated: ${updated}`);
  console.log(`  - Skipped (missing discipline): ${skipped}`);
  console.log(`  - Errors: ${errors}`);
}

async function verifyRestoration(pool: any) {
  console.log('\nVerifying restoration...');
  
  const countResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active_count,
      COUNT(*) FILTER (WHERE code IS NOT NULL) as with_code_count
    FROM public.discipline_subtypes
  `);
  
  const counts = countResult.rows[0];
  console.log(`✓ Table verification:`);
  console.log(`  - Total subtypes: ${counts.total}`);
  console.log(`  - Active subtypes: ${counts.active_count}`);
  console.log(`  - With code: ${counts.with_code_count}`);
  
  // Sample a few records
  const sampleResult = await pool.query(`
    SELECT id, name, code, discipline_id, is_active
    FROM public.discipline_subtypes
    ORDER BY code
    LIMIT 5
  `);
  
  if (sampleResult.rows.length > 0) {
    console.log(`\n  Sample records:`);
    sampleResult.rows.forEach((row: any) => {
      console.log(`    - ${row.code || 'NO_CODE'}: ${row.name} (active: ${row.is_active})`);
    });
  }
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('Restore Discipline Subtypes from Archive');
    console.log('='.repeat(80));
    console.log();
    
    // Load archive data
    const archivePath = join(process.cwd(), 'taxonomy', 'discipline_subtypes.json');
    console.log(`Loading archive from: ${archivePath}`);
    
    const archiveContent = readFileSync(archivePath, 'utf-8');
    const archive: ArchiveData = JSON.parse(archiveContent);
    
    console.log(`✓ Loaded archive:`);
    console.log(`  - Version: ${archive.metadata.version}`);
    console.log(`  - Total subtypes: ${archive.metadata.total_subtypes}`);
    console.log(`  - Generated: ${archive.metadata.generated_at}`);
    console.log(`  - Authority: ${archive.metadata.authority}`);
    
    if (archive.subtypes.length !== archive.metadata.total_subtypes) {
      console.warn(`⚠ Warning: Expected ${archive.metadata.total_subtypes} subtypes, found ${archive.subtypes.length}`);
    }
    
    // Connect to database
    console.log('\nConnecting to database...');
    const pool = await ensureRuntimePoolConnected();
    console.log('✓ Database connected');
    
    // Create table
    await createTable(pool);
    
    // Restore data
    await restoreData(pool, archive.subtypes);
    
    // Verify
    await verifyRestoration(pool);
    
    console.log('\n' + '='.repeat(80));
    console.log('✓ Restoration complete!');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

main();
