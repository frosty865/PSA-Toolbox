#!/usr/bin/env tsx
/**
 * Generate authoritative cleanup SQL scripts for CORPUS/RUNTIME decontamination.
 * 
 * Usage:
 *   npx tsx tools/db/generate_pool_cleanup_sql.ts
 * 
 * Inputs:
 *   - tools/db/pool_ownership.json
 *   - analytics/reports/pool_diff_report.json (optional, for verification)
 * 
 * Outputs:
 *   - analytics/reports/pool_cleanup_corpus.sql (RUN ONLY ON CORPUS)
 *   - analytics/reports/pool_cleanup_runtime.sql (RUN ONLY ON RUNTIME)
 *   - analytics/reports/pool_cleanup_notes.md
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local (relative to project root)
dotenv.config({ path: '.env.local' });

import poolOwnership from "./pool_ownership.json";

function generateAuthoritativeCleanupSQL(): { corpusSQL: string[]; runtimeSQL: string[]; notes: string[] } {
  const corpusSQL: string[] = [];
  const runtimeSQL: string[] = [];
  const notes: string[] = [];
  
  // CORPUS SQL Header
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("-- CORPUS Database Cleanup SQL");
  corpusSQL.push("-- Generated: " + new Date().toISOString());
  corpusSQL.push("-- ⚠️  RUN ONLY ON CORPUS DATABASE ⚠️");
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("");
  
  // SECTION B — CORPUS DB CLEANUP
  corpusSQL.push("-- SECTION B — CORPUS DB CLEANUP (RUN ONLY ON CORPUS)");
  corpusSQL.push("");
  
  corpusSQL.push("-- 1. DROP TAXONOMY TABLES FROM CORPUS (RUNTIME IS CANONICAL)");
  corpusSQL.push("DROP TABLE IF EXISTS public.discipline_subtypes CASCADE;");
  corpusSQL.push("DROP TABLE IF EXISTS public.disciplines CASCADE;");
  corpusSQL.push("");
  
  corpusSQL.push("-- 2. RENAME CORPUS expansion_questions (PREVENT NAME COLLISION)");
  corpusSQL.push("ALTER TABLE IF EXISTS public.expansion_questions");
  corpusSQL.push("RENAME TO corpus_expansion_questions;");
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
  
  // RUNTIME SQL Header
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("-- RUNTIME Database Cleanup SQL");
  runtimeSQL.push("-- Generated: " + new Date().toISOString());
  runtimeSQL.push("-- ⚠️  RUN ONLY ON RUNTIME DATABASE ⚠️");
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("");
  
  // SECTION C — RUNTIME DB CLEANUP
  runtimeSQL.push("-- SECTION C — RUNTIME DB CLEANUP (RUN ONLY ON RUNTIME)");
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
  
  // Verification queries
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("-- POST-CLEANUP VERIFICATION (CORPUS)");
  corpusSQL.push("-- ================================================================================");
  corpusSQL.push("");
  corpusSQL.push("-- Expected CORPUS state:");
  corpusSQL.push("-- ofc_candidate_queue          ✅ exists");
  corpusSQL.push("-- ofc_candidate_targets        ✅ exists");
  corpusSQL.push("-- corpus_expansion_questions   ✅ exists");
  corpusSQL.push("-- disciplines                 ❌ does not exist");
  corpusSQL.push("-- discipline_subtypes          ❌ does not exist");
  corpusSQL.push("-- expansion_questions         ❌ does not exist");
  corpusSQL.push("");
  corpusSQL.push("-- Verification queries:");
  corpusSQL.push("SELECT 'ofc_candidate_queue' as table_name, to_regclass('public.ofc_candidate_queue') IS NOT NULL as exists;");
  corpusSQL.push("SELECT 'ofc_candidate_targets' as table_name, to_regclass('public.ofc_candidate_targets') IS NOT NULL as exists;");
  corpusSQL.push("SELECT 'corpus_expansion_questions' as table_name, to_regclass('public.corpus_expansion_questions') IS NOT NULL as exists;");
  corpusSQL.push("SELECT 'disciplines' as table_name, to_regclass('public.disciplines') IS NOT NULL as exists;");
  corpusSQL.push("SELECT 'discipline_subtypes' as table_name, to_regclass('public.discipline_subtypes') IS NOT NULL as exists;");
  corpusSQL.push("SELECT 'expansion_questions' as table_name, to_regclass('public.expansion_questions') IS NOT NULL as exists;");
  corpusSQL.push("");
  
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("-- POST-CLEANUP VERIFICATION (RUNTIME)");
  runtimeSQL.push("-- ================================================================================");
  runtimeSQL.push("");
  runtimeSQL.push("-- Expected RUNTIME state:");
  runtimeSQL.push("-- disciplines                 ✅ exists");
  runtimeSQL.push("-- discipline_subtypes          ✅ exists");
  runtimeSQL.push("-- expansion_questions          ✅ exists");
  runtimeSQL.push("-- assessment_responses         ✅ exists");
  runtimeSQL.push("-- ofc_candidate_queue          ❌ does not exist");
  runtimeSQL.push("-- ofc_candidate_targets        ❌ does not exist");
  runtimeSQL.push("-- ofc_library_citations        ❌ does not exist");
  runtimeSQL.push("");
  runtimeSQL.push("-- Verification queries:");
  runtimeSQL.push("SELECT 'disciplines' as table_name, to_regclass('public.disciplines') IS NOT NULL as exists;");
  runtimeSQL.push("SELECT 'discipline_subtypes' as table_name, to_regclass('public.discipline_subtypes') IS NOT NULL as exists;");
  runtimeSQL.push("SELECT 'expansion_questions' as table_name, to_regclass('public.expansion_questions') IS NOT NULL as exists;");
  runtimeSQL.push("SELECT 'assessment_responses' as table_name, to_regclass('public.assessment_responses') IS NOT NULL as exists;");
  runtimeSQL.push("SELECT 'ofc_candidate_queue' as table_name, to_regclass('public.ofc_candidate_queue') IS NOT NULL as exists;");
  runtimeSQL.push("SELECT 'ofc_candidate_targets' as table_name, to_regclass('public.ofc_candidate_targets') IS NOT NULL as exists;");
  runtimeSQL.push("SELECT 'ofc_library_citations' as table_name, to_regclass('public.ofc_library_citations') IS NOT NULL as exists;");
  runtimeSQL.push("");
  
  // Notes
  notes.push("# Pool Cleanup Notes - Authoritative One-Time Cleanup");
  notes.push("");
  notes.push("Generated: " + new Date().toISOString());
  notes.push("");
  notes.push("## ⚠️ CRITICAL INSTRUCTIONS");
  notes.push("");
  notes.push("1. **CORPUS SQL** (`pool_cleanup_corpus.sql`) - RUN ONLY ON CORPUS DATABASE");
  notes.push("2. **RUNTIME SQL** (`pool_cleanup_runtime.sql`) - RUN ONLY ON RUNTIME DATABASE");
  notes.push("3. **DO NOT** run CORPUS SQL on RUNTIME or vice versa");
  notes.push("4. **DO NOT** make application code changes until cleanup is complete");
  notes.push("");
  notes.push("## Run Order");
  notes.push("");
  notes.push("1. **Backup both databases** (safety first)");
  notes.push("2. Run `pool_cleanup_corpus.sql` against CORPUS database");
  notes.push("3. Run `pool_cleanup_runtime.sql` against RUNTIME database");
  notes.push("4. Run verification queries (included in SQL files)");
  notes.push("5. Re-run audit: `npm run db:audit`");
  notes.push("6. Confirm: duplicates = 0, mapping errors = 0");
  notes.push("7. **ONLY THEN**: Re-enable promote route and enforce pool guards");
  notes.push("");
  notes.push("## Expected Final State");
  notes.push("");
  notes.push("### CORPUS OWNS (evidence + candidate generation):");
  notes.push("- ✅ public.ofc_candidate_queue");
  notes.push("- ✅ public.ofc_candidate_targets");
  notes.push("- ✅ public.ofc_library_citations");
  notes.push("- ✅ public.corpus_expansion_questions (renamed from expansion_questions)");
  notes.push("- ✅ public.corpus_documents");
  notes.push("- ✅ public.document_chunks");
  notes.push("- ✅ public.source_registry");
  notes.push("");
  notes.push("### RUNTIME OWNS (taxonomy + assessments + execution):");
  notes.push("- ✅ public.disciplines");
  notes.push("- ✅ public.discipline_subtypes");
  notes.push("- ✅ public.expansion_questions");
  notes.push("- ✅ public.assessments");
  notes.push("- ✅ public.assessment_responses");
  notes.push("- ✅ public.baseline_spines_runtime");
  notes.push("");
  notes.push("## Hard Rules After Cleanup");
  notes.push("");
  notes.push("- ❌ **NO TABLE MAY EXIST IN BOTH POOLS**");
  notes.push("- Promote logic:");
  notes.push("  - READS from CORPUS.ofc_candidate_queue");
  notes.push("  - WRITES approval state in CORPUS");
  notes.push("  - CREATES OFCs in RUNTIME ONLY WHEN ATTACHED TO:");
  notes.push("    - assessment_id + question_canon_id + assessment_response(answer=NO)");
  notes.push("- MODULE inventory stays in CORPUS");
  notes.push("- ASSESSMENT OFCs live in RUNTIME and MUST answer a NO");
  notes.push("");
  notes.push("## Done Criteria");
  notes.push("");
  notes.push("✅ `ofc_candidate_queue` exists ONLY in CORPUS");
  notes.push("✅ `disciplines` & `discipline_subtypes` exist ONLY in RUNTIME");
  notes.push("✅ `ofc_library_citations` exists ONLY in CORPUS");
  notes.push("✅ `assessment_responses` exists in RUNTIME");
  notes.push("✅ `expansion_questions` exists ONLY in RUNTIME");
  notes.push("✅ `corpus_expansion_questions` exists ONLY in CORPUS");
  notes.push("✅ Audit reports 0 duplicates, 0 mapping failures");
  notes.push("");
  
  return {
    corpusSQL,
    runtimeSQL,
    notes,
  };
}

async function main() {
  try {
    console.log("🔧 Generating authoritative pool cleanup SQL...\n");
    
    // Generate authoritative SQL
    const { corpusSQL, runtimeSQL, notes } = generateAuthoritativeCleanupSQL();
    
    // Write SQL files
    const reportsDir = path.join(process.cwd(), 'analytics', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const corpusSQLPath = path.join(reportsDir, 'pool_cleanup_corpus.sql');
    const runtimeSQLPath = path.join(reportsDir, 'pool_cleanup_runtime.sql');
    const notesPath = path.join(reportsDir, 'pool_cleanup_notes.md');
    
    fs.writeFileSync(corpusSQLPath, corpusSQL.join('\n'));
    fs.writeFileSync(runtimeSQLPath, runtimeSQL.join('\n'));
    fs.writeFileSync(notesPath, notes.join('\n'));
    
    console.log(`✅ Generated authoritative cleanup SQL files:`);
    console.log(`   - ${corpusSQLPath}`);
    console.log(`   - ${runtimeSQLPath}`);
    console.log(`   - ${notesPath}`);
    console.log(`\n⚠️  CRITICAL: Review SQL files before running.`);
    console.log(`   - CORPUS SQL runs ONLY on CORPUS database`);
    console.log(`   - RUNTIME SQL runs ONLY on RUNTIME database`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Backup both databases`);
    console.log(`   2. Run SQL files against respective databases`);
    console.log(`   3. Run verification queries`);
    console.log(`   4. Run 'npm run db:audit' to confirm cleanup`);
    
  } catch (error) {
    console.error("\n❌ Fatal error during SQL generation:", error);
    process.exit(1);
  }
}

main();
