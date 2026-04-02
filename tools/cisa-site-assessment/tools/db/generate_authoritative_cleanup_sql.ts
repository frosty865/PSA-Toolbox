#!/usr/bin/env tsx
/**
 * Generate AUTHORITATIVE cleanup SQL scripts (one-time cleanup).
 * 
 * This script generates the exact cleanup SQL as specified in the DB decontamination prompt.
 * It enforces single ownership per table and handles renames/creations.
 * 
 * Usage:
 *   npx tsx tools/db/generate_authoritative_cleanup_sql.ts
 * 
 * Outputs:
 *   - analytics/reports/pool_cleanup_corpus_authoritative.sql
 *   - analytics/reports/pool_cleanup_runtime_authoritative.sql
 *   - analytics/reports/pool_cleanup_verification.sql
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local (relative to project root)
dotenv.config({ path: '.env.local' });

function generateAuthoritativeCleanupSQL(): {
  corpusSQL: string[];
  runtimeSQL: string[];
  verificationSQL: string[];
} {
  const corpusSQL: string[] = [];
  const runtimeSQL: string[] = [];
  const verificationSQL: string[] = [];
  
  // CORPUS DB CLEANUP
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("-- CORPUS Database Cleanup SQL (RUN ONLY ON CORPUS)");
  corpusSQL.push("-- Generated: " + new Date().toISOString());
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("");
  corpusSQL.push("-- 1. DROP TAXONOMY TABLES FROM CORPUS (RUNTIME IS CANONICAL)");
  corpusSQL.push("DROP TABLE IF EXISTS public.discipline_subtypes CASCADE;");
  corpusSQL.push("DROP TABLE IF EXISTS public.disciplines CASCADE;");
  corpusSQL.push("");
  corpusSQL.push("-- 2. RENAME CORPUS expansion_questions (PREVENT NAME COLLISION)");
  corpusSQL.push("-- Note: Only rename if table exists and corpus_expansion_questions doesn't exist");
  corpusSQL.push("DO $$");
  corpusSQL.push("BEGIN");
  corpusSQL.push("  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expansion_questions')");
  corpusSQL.push("     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corpus_expansion_questions') THEN");
  corpusSQL.push("    ALTER TABLE public.expansion_questions RENAME TO corpus_expansion_questions;");
  corpusSQL.push("  END IF;");
  corpusSQL.push("END $$;");
  corpusSQL.push("");
  corpusSQL.push("-- 3. ENSURE CORPUS OWNS ofc_candidate_queue + targets (KEEP)");
  corpusSQL.push("-- (NO ACTION REQUIRED — CONFIRMED CANONICAL)");
  corpusSQL.push("");
  corpusSQL.push("-- 4. CREATE ofc_library_citations IN CORPUS IF MISSING");
  corpusSQL.push("CREATE TABLE IF NOT EXISTS public.ofc_library_citations (");
  corpusSQL.push("  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),");
  corpusSQL.push("  ofc_id uuid NOT NULL,");
  corpusSQL.push("  source_registry_id uuid NOT NULL,");
  corpusSQL.push("  locator_type text,");
  corpusSQL.push("  locator jsonb,");
  corpusSQL.push("  excerpt text,");
  corpusSQL.push("  created_at timestamptz DEFAULT now()");
  corpusSQL.push(");");
  corpusSQL.push("");
  
  // RUNTIME DB CLEANUP
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("-- RUNTIME Database Cleanup SQL (RUN ONLY ON RUNTIME)");
  runtimeSQL.push("-- Generated: " + new Date().toISOString());
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("");
  runtimeSQL.push("-- 1. DROP CANDIDATE TABLES FROM RUNTIME (CORPUS IS CANONICAL)");
  runtimeSQL.push("DROP TABLE IF EXISTS public.ofc_candidate_targets CASCADE;");
  runtimeSQL.push("DROP TABLE IF EXISTS public.ofc_candidate_queue CASCADE;");
  runtimeSQL.push("");
  runtimeSQL.push("-- 2. DROP ofc_library_citations FROM RUNTIME (BELONGS TO CORPUS)");
  runtimeSQL.push("DROP TABLE IF EXISTS public.ofc_library_citations CASCADE;");
  runtimeSQL.push("");
  runtimeSQL.push("-- 3. ENSURE TAXONOMY EXISTS IN RUNTIME (NO-OP IF ALREADY PRESENT)");
  runtimeSQL.push("-- disciplines + discipline_subtypes already verified as canonical");
  runtimeSQL.push("");
  runtimeSQL.push("-- 4. ENSURE assessment_responses EXISTS (BLOCKER FOR OFC ATTACHMENT)");
  runtimeSQL.push("CREATE TABLE IF NOT EXISTS public.assessment_responses (");
  runtimeSQL.push("  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),");
  runtimeSQL.push("  assessment_id uuid NOT NULL,");
  runtimeSQL.push("  question_canon_id text NOT NULL,");
  runtimeSQL.push("  answer text NOT NULL CHECK (answer IN ('YES','NO','N_A')),");
  runtimeSQL.push("  created_at timestamptz DEFAULT now(),");
  runtimeSQL.push("  updated_at timestamptz DEFAULT now()");
  runtimeSQL.push(");");
  runtimeSQL.push("");
  
  // VERIFICATION SQL (run against both DBs separately)
  verificationSQL.push("-- ================================================================================");
  verificationSQL.push("-- POST-CLEANUP VERIFICATION (RUN AGAINST BOTH DBS SEPARATELY)");
  verificationSQL.push("-- Generated: " + new Date().toISOString());
  verificationSQL.push("-- ================================================================================");
  verificationSQL.push("");
  verificationSQL.push("-- CORPUS EXPECTED:");
  verificationSQL.push("-- ofc_candidate_queue          ✅ exists");
  verificationSQL.push("-- ofc_candidate_targets        ✅ exists");
  verificationSQL.push("-- corpus_expansion_questions   ✅ exists");
  verificationSQL.push("-- ofc_library_citations         ✅ exists");
  verificationSQL.push("-- disciplines                 ❌ does not exist");
  verificationSQL.push("-- discipline_subtypes          ❌ does not exist");
  verificationSQL.push("-- expansion_questions           ❌ does not exist");
  verificationSQL.push("");
  verificationSQL.push("-- RUNTIME EXPECTED:");
  verificationSQL.push("-- disciplines                 ✅ exists");
  verificationSQL.push("-- discipline_subtypes          ✅ exists");
  verificationSQL.push("-- expansion_questions          ✅ exists");
  verificationSQL.push("-- assessment_responses         ✅ exists");
  verificationSQL.push("-- ofc_candidate_queue           ❌ does not exist");
  verificationSQL.push("-- ofc_candidate_targets         ❌ does not exist");
  verificationSQL.push("-- ofc_library_citations         ❌ does not exist");
  verificationSQL.push("");
  verificationSQL.push("-- Verification queries:");
  verificationSQL.push("");
  verificationSQL.push("-- Check CORPUS tables (should return true for CORPUS-owned, false for RUNTIME-owned):");
  verificationSQL.push("SELECT 'CORPUS: ofc_candidate_queue exists' as check_name, to_regclass('public.ofc_candidate_queue') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'CORPUS: ofc_candidate_targets exists' as check_name, to_regclass('public.ofc_candidate_targets') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'CORPUS: corpus_expansion_questions exists' as check_name, to_regclass('public.corpus_expansion_questions') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'CORPUS: ofc_library_citations exists' as check_name, to_regclass('public.ofc_library_citations') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'CORPUS: disciplines should NOT exist' as check_name, to_regclass('public.disciplines') IS NULL as result;");
  verificationSQL.push("SELECT 'CORPUS: discipline_subtypes should NOT exist' as check_name, to_regclass('public.discipline_subtypes') IS NULL as result;");
  verificationSQL.push("SELECT 'CORPUS: expansion_questions should NOT exist' as check_name, to_regclass('public.expansion_questions') IS NULL as result;");
  verificationSQL.push("");
  verificationSQL.push("-- Check RUNTIME tables (should return true for RUNTIME-owned, false for CORPUS-owned):");
  verificationSQL.push("SELECT 'RUNTIME: disciplines exists' as check_name, to_regclass('public.disciplines') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'RUNTIME: discipline_subtypes exists' as check_name, to_regclass('public.discipline_subtypes') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'RUNTIME: expansion_questions exists' as check_name, to_regclass('public.expansion_questions') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'RUNTIME: assessment_responses exists' as check_name, to_regclass('public.assessment_responses') IS NOT NULL as result;");
  verificationSQL.push("SELECT 'RUNTIME: ofc_candidate_queue should NOT exist' as check_name, to_regclass('public.ofc_candidate_queue') IS NULL as result;");
  verificationSQL.push("SELECT 'RUNTIME: ofc_candidate_targets should NOT exist' as check_name, to_regclass('public.ofc_candidate_targets') IS NULL as result;");
  verificationSQL.push("SELECT 'RUNTIME: ofc_library_citations should NOT exist' as check_name, to_regclass('public.ofc_library_citations') IS NULL as result;");
  
  return {
    corpusSQL,
    runtimeSQL,
    verificationSQL,
  };
}

async function main() {
  try {
    console.log("🔧 Generating AUTHORITATIVE cleanup SQL...\n");
    
    const { corpusSQL, runtimeSQL, verificationSQL } = generateAuthoritativeCleanupSQL();
    
    // Write SQL files
    const reportsDir = path.join(process.cwd(), 'analytics', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const corpusSQLPath = path.join(reportsDir, 'pool_cleanup_corpus_authoritative.sql');
    const runtimeSQLPath = path.join(reportsDir, 'pool_cleanup_runtime_authoritative.sql');
    const verificationSQLPath = path.join(reportsDir, 'pool_cleanup_verification.sql');
    
    fs.writeFileSync(corpusSQLPath, corpusSQL.join('\n'));
    fs.writeFileSync(runtimeSQLPath, runtimeSQL.join('\n'));
    fs.writeFileSync(verificationSQLPath, verificationSQL.join('\n'));
    
    console.log(`✅ Generated authoritative cleanup SQL files:`);
    console.log(`   - ${corpusSQLPath}`);
    console.log(`   - ${runtimeSQLPath}`);
    console.log(`   - ${verificationSQLPath}`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   1. Run CORPUS SQL against CORPUS DB only`);
    console.log(`   2. Run RUNTIME SQL against RUNTIME DB only`);
    console.log(`   3. Run verification SQL against both DBs separately`);
    console.log(`   4. Re-run 'npm run db:audit' to confirm duplicates = 0`);
    
  } catch (error) {
    console.error("\n❌ Fatal error during SQL generation:", error);
    process.exit(1);
  }
}

main();
