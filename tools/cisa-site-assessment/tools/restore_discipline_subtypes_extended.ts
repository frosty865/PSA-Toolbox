#!/usr/bin/env tsx
/**
 * Restore Extended Information for Discipline Subtypes from Archive Schema
 * 
 * This script:
 * 1. Checks if archive.discipline_subtypes exists
 * 2. Updates public.discipline_subtypes with extended fields from archive
 * 3. Preserves existing basic data (id, name, code, etc.)
 * 
 * Extended fields restored:
 * - overview
 * - indicators_of_risk
 * - common_failures
 * - assessment_questions
 * - mitigation_guidance
 * - standards_references
 * - psa_notes
 * 
 * Usage:
 *   npx tsx tools/restore_discipline_subtypes_extended.ts
 */

import * as dotenv from 'dotenv';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Clean up environment variables
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

async function checkArchiveTable(pool: any): Promise<boolean> {
  console.log('Checking for archive.discipline_subtypes table...');
  
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'archive' AND table_name = 'discipline_subtypes'
    ) as exists
  `);
  
  const exists = result.rows[0]?.exists || false;
  
  if (exists) {
    // Check row count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM archive.discipline_subtypes
    `);
    const count = parseInt(countResult.rows[0]?.count || '0', 10);
    console.log(`✓ Found archive.discipline_subtypes with ${count} rows`);
  } else {
    console.log('✗ archive.discipline_subtypes table does not exist');
  }
  
  return exists;
}

async function restoreExtendedInfo(pool: any) {
  console.log('\nRestoring extended information from archive...');
  
  // Update public.discipline_subtypes with extended fields from archive.discipline_subtypes
  // Match on id (primary key)
  const updateQuery = `
    UPDATE public.discipline_subtypes ds
    SET 
      overview = arch.overview,
      indicators_of_risk = arch.indicators_of_risk,
      common_failures = arch.common_failures,
      assessment_questions = arch.assessment_questions,
      mitigation_guidance = arch.mitigation_guidance,
      standards_references = arch.standards_references,
      psa_notes = arch.psa_notes,
      updated_at = now()
    FROM archive.discipline_subtypes arch
    WHERE ds.id = arch.id
      AND (
        ds.overview IS DISTINCT FROM arch.overview OR
        ds.indicators_of_risk IS DISTINCT FROM arch.indicators_of_risk OR
        ds.common_failures IS DISTINCT FROM arch.common_failures OR
        ds.assessment_questions IS DISTINCT FROM arch.assessment_questions OR
        ds.mitigation_guidance IS DISTINCT FROM arch.mitigation_guidance OR
        ds.standards_references IS DISTINCT FROM arch.standards_references OR
        ds.psa_notes IS DISTINCT FROM arch.psa_notes
      )
    RETURNING ds.id, ds.name, ds.code
  `;
  
  const result = await pool.query(updateQuery);
  const updatedCount = result.rows.length;
  
  console.log(`✓ Updated ${updatedCount} subtypes with extended information`);
  
  return updatedCount;
}

async function verifyRestoration(pool: any) {
  console.log('\nVerifying extended information restoration...');
  
  // Check how many subtypes have extended information
  const statsResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE overview IS NOT NULL) as with_overview,
      COUNT(*) FILTER (WHERE indicators_of_risk IS NOT NULL AND array_length(indicators_of_risk, 1) > 0) as with_indicators,
      COUNT(*) FILTER (WHERE common_failures IS NOT NULL AND array_length(common_failures, 1) > 0) as with_failures,
      COUNT(*) FILTER (WHERE assessment_questions IS NOT NULL AND array_length(assessment_questions, 1) > 0) as with_questions,
      COUNT(*) FILTER (WHERE mitigation_guidance IS NOT NULL AND array_length(mitigation_guidance, 1) > 0) as with_mitigation,
      COUNT(*) FILTER (WHERE standards_references IS NOT NULL AND array_length(standards_references, 1) > 0) as with_standards,
      COUNT(*) FILTER (WHERE psa_notes IS NOT NULL) as with_notes
    FROM public.discipline_subtypes
  `);
  
  const stats = statsResult.rows[0];
  console.log(`✓ Extended information statistics:`);
  console.log(`  - Total subtypes: ${stats.total}`);
  console.log(`  - With overview: ${stats.with_overview}`);
  console.log(`  - With indicators_of_risk: ${stats.with_indicators}`);
  console.log(`  - With common_failures: ${stats.with_failures}`);
  console.log(`  - With assessment_questions: ${stats.with_questions}`);
  console.log(`  - With mitigation_guidance: ${stats.with_mitigation}`);
  console.log(`  - With standards_references: ${stats.with_standards}`);
  console.log(`  - With psa_notes: ${stats.with_notes}`);
  
  // Sample a few records with extended info
  const sampleResult = await pool.query(`
    SELECT 
      id, 
      name, 
      code,
      CASE WHEN overview IS NOT NULL THEN 'Yes' ELSE 'No' END as has_overview,
      CASE WHEN array_length(indicators_of_risk, 1) > 0 THEN array_length(indicators_of_risk, 1)::text ELSE '0' END as indicators_count,
      CASE WHEN array_length(common_failures, 1) > 0 THEN array_length(common_failures, 1)::text ELSE '0' END as failures_count
    FROM public.discipline_subtypes
    WHERE overview IS NOT NULL 
       OR (indicators_of_risk IS NOT NULL AND array_length(indicators_of_risk, 1) > 0)
       OR (common_failures IS NOT NULL AND array_length(common_failures, 1) > 0)
    ORDER BY code
    LIMIT 5
  `);
  
  if (sampleResult.rows.length > 0) {
    console.log(`\n  Sample records with extended info:`);
    sampleResult.rows.forEach((row: any) => {
      console.log(`    - ${row.code || 'NO_CODE'}: ${row.name}`);
      console.log(`      Overview: ${row.has_overview}, Indicators: ${row.indicators_count}, Failures: ${row.failures_count}`);
    });
  } else {
    console.log(`\n  ⚠ No subtypes found with extended information`);
  }
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('Restore Extended Information for Discipline Subtypes');
    console.log('='.repeat(80));
    console.log();
    
    // Connect to database
    console.log('Connecting to database...');
    const pool = await ensureRuntimePoolConnected();
    console.log('✓ Database connected');
    
    // Check if archive table exists
    const archiveExists = await checkArchiveTable(pool);
    
    if (!archiveExists) {
      console.log('\n⚠ archive.discipline_subtypes does not exist.');
      console.log('Extended information may have been lost or was never archived.');
      console.log('Only basic subtype information is available.');
      process.exit(0);
    }
    
    // Restore extended information
    const updatedCount = await restoreExtendedInfo(pool);
    
    if (updatedCount === 0) {
      console.log('\n⚠ No subtypes were updated. This could mean:');
      console.log('  - Extended information was already restored');
      console.log('  - No matching IDs between public and archive tables');
      console.log('  - Archive table has no extended information');
    }
    
    // Verify
    await verifyRestoration(pool);
    
    console.log('\n' + '='.repeat(80));
    console.log('✓ Extended information restoration complete!');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

main();
