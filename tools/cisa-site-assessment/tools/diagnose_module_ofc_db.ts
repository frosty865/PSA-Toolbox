#!/usr/bin/env tsx
/**
 * Diagnostic script to check which database/schema the MODULE OFC API is using
 * and verify taxonomy availability
 */

import * as dotenv from 'dotenv';
import { getCorpusPool } from '../app/lib/db/corpus_client';

dotenv.config({ path: '.env.local' });

async function main() {
  console.log('MODULE OFC Database Diagnostic');
  console.log('================================\n');
  
  try {
    const pool = getCorpusPool();
    
    // Get comprehensive diagnostic information
    const diagResult = await pool.query(`
      SELECT
        current_database() as db,
        current_schema() as schema,
        current_user as db_user,
        current_setting('search_path', true) as search_path,
        to_regclass('public.discipline_subtypes') as discipline_subtypes,
        to_regclass('public.disciplines') as disciplines,
        to_regclass('public.ofc_candidate_queue') as ofc_candidate_queue
    `);
    
    const diag = diagResult.rows[0];
    
    console.log('Connection Info:');
    console.log(`  Database: ${diag.db}`);
    console.log(`  Schema: ${diag.schema}`);
    console.log(`  User: ${diag.db_user}`);
    console.log(`  Search Path: ${diag.search_path}`);
    console.log('');
    
    console.log('Table/View Existence:');
    console.log(`  public.discipline_subtypes: ${diag.discipline_subtypes || 'NULL (NOT FOUND)'}`);
    console.log(`  public.disciplines: ${diag.disciplines || 'NULL (NOT FOUND)'}`);
    console.log(`  public.ofc_candidate_queue: ${diag.ofc_candidate_queue || 'NULL (NOT FOUND)'}`);
    console.log('');
    
    // Check row counts if tables exist
    if (diag.discipline_subtypes) {
      try {
        const countResult = await pool.query('SELECT COUNT(*) as count FROM public.discipline_subtypes');
        const subtypeCount = parseInt(countResult.rows[0].count);
        console.log(`  public.discipline_subtypes row count: ${subtypeCount}`);
        
        if (subtypeCount === 0) {
          console.log('  ⚠️  WARNING: Table exists but is EMPTY - needs seeding!');
        } else if (subtypeCount < 100) {
          console.log(`  ⚠️  WARNING: Expected ~104 rows, found ${subtypeCount}`);
        } else {
          console.log('  ✅ Table has expected number of rows');
        }
      } catch (e: any) {
        console.log(`  ❌ Error counting rows: ${e.message}`);
      }
    } else {
      console.log('  ❌ public.discipline_subtypes does NOT exist - migration needed!');
    }
    
    if (diag.disciplines) {
      try {
        const countResult = await pool.query('SELECT COUNT(*) as count FROM public.disciplines');
        const disciplineCount = parseInt(countResult.rows[0].count);
        console.log(`  public.disciplines row count: ${disciplineCount}`);
      } catch (e: any) {
        console.log(`  ❌ Error counting rows: ${e.message}`);
      }
    }
    
    console.log('');
    
    // Check ofc_candidate_queue columns
    if (diag.ofc_candidate_queue) {
      try {
        const columnsResult = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' 
            AND table_name = 'ofc_candidate_queue'
            AND column_name IN ('ofc_origin', 'discipline_id', 'discipline_subtype_id', 'title', 'ofc_class')
          ORDER BY column_name
        `);
        
        console.log('ofc_candidate_queue Required Columns:');
        const foundColumns = columnsResult.rows.map((r: any) => r.column_name);
        const requiredColumns = ['ofc_origin', 'discipline_id', 'discipline_subtype_id', 'title', 'ofc_class'];
        
        requiredColumns.forEach(col => {
          if (foundColumns.includes(col)) {
            const colInfo = columnsResult.rows.find((r: any) => r.column_name === col);
            console.log(`  ✅ ${col}: ${colInfo.data_type} (nullable: ${colInfo.is_nullable})`);
          } else {
            console.log(`  ❌ ${col}: MISSING`);
          }
        });
      } catch (e: any) {
        console.log(`  ❌ Error checking columns: ${e.message}`);
      }
    }
    
    console.log('');
    console.log('Summary:');
    if (!diag.discipline_subtypes) {
      console.log('  ❌ CRITICAL: public.discipline_subtypes does not exist');
      console.log('     → Apply migration: migrations/20260123_ensure_taxonomy_discipline_subtypes.sql');
    } else {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM public.discipline_subtypes');
      const count = parseInt(countResult.rows[0].count);
      if (count === 0) {
        console.log('  ⚠️  WARNING: public.discipline_subtypes exists but is empty');
        console.log('     → Run seeding: npx tsx tools/restore_discipline_subtypes_corpus.ts');
      } else {
        console.log('  ✅ public.discipline_subtypes exists and has data');
      }
    }
    
    await pool.end();
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
