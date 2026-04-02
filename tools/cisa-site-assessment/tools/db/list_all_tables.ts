#!/usr/bin/env tsx
/**
 * List all tables in both CORPUS and RUNTIME databases to identify duplicates.
 * 
 * Usage:
 *   npx tsx tools/db/list_all_tables.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';

async function main() {
  try {
    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();
    
    const corpusResult = await corpusPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const runtimeResult = await runtimePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const corpusTables = new Set(corpusResult.rows.map((r: any) => r.table_name));
    const runtimeTables = new Set(runtimeResult.rows.map((r: any) => r.table_name));
    
    const allTables = new Set([...corpusTables, ...runtimeTables]);
    const duplicates = [...allTables].filter(t => corpusTables.has(t) && runtimeTables.has(t));
    const corpusOnly = [...allTables].filter(t => corpusTables.has(t) && !runtimeTables.has(t));
    const runtimeOnly = [...allTables].filter(t => !corpusTables.has(t) && runtimeTables.has(t));
    
    console.log("📊 Table Inventory:\n");
    console.log(`Total unique tables: ${allTables.size}`);
    console.log(`Tables in CORPUS only: ${corpusOnly.length}`);
    console.log(`Tables in RUNTIME only: ${runtimeOnly.length}`);
    console.log(`DUPLICATE tables (in both): ${duplicates.length}\n`);
    
    if (duplicates.length > 0) {
      console.log("❌ DUPLICATE TABLES (exist in both databases):");
      duplicates.forEach(t => {
        console.log(`   - ${t}`);
      });
      console.log("");
    }
    
    if (corpusOnly.length > 0) {
      console.log("📦 CORPUS ONLY tables:");
      corpusOnly.forEach(t => {
        console.log(`   - ${t}`);
      });
      console.log("");
    }
    
    if (runtimeOnly.length > 0) {
      console.log("⚙️  RUNTIME ONLY tables:");
      runtimeOnly.forEach(t => {
        console.log(`   - ${t}`);
      });
      console.log("");
    }
    
    // Generate cleanup SQL for duplicates
    if (duplicates.length > 0) {
      console.log("🔧 Generating cleanup SQL for duplicates...\n");
      
      // Check ownership config to determine which copy to keep
      const ownershipConfig = require('../../config/db_ownership.json');
      const corpusDrops: string[] = [];
      const runtimeDrops: string[] = [];
      
      // Determine ownership based on migrations and documentation
      const tableOwnership: Record<string, 'CORPUS' | 'RUNTIME'> = {
        'assessment_modules': 'RUNTIME', // Created in RUNTIME migration, referenced by RUNTIME tables
        'assessment_module_instances': 'RUNTIME', // References assessment_modules
        'assessment_module_questions': 'RUNTIME', // References assessment_modules
        'module_chunk_links': 'CORPUS', // Created in CORPUS migration, references document_chunks (CORPUS)
        'module_source_documents': 'CORPUS', // Created in CORPUS migration, references corpus_documents (CORPUS)
        'ofc_question_links': 'CORPUS', // Created in CORPUS migration first, has source_set/scope_code fields
      };
      
      for (const dup of duplicates) {
        const owner = ownershipConfig.owners[`public.${dup}`] || tableOwnership[dup];
        
        if (owner === 'CORPUS') {
          runtimeDrops.push(dup);
          console.log(`   → ${dup}: Keep in CORPUS, DROP from RUNTIME`);
        } else if (owner === 'RUNTIME') {
          corpusDrops.push(dup);
          console.log(`   → ${dup}: Keep in RUNTIME, DROP from CORPUS`);
        } else {
          console.log(`   ⚠️  ${dup}: Ownership unclear - manual review needed`);
        }
      }
      
      if (corpusDrops.length > 0 || runtimeDrops.length > 0) {
        const fs = require('fs');
        const path = require('path');
        
        const corpusSQL: string[] = [];
        const runtimeSQL: string[] = [];
        
        corpusSQL.push("-- ================================================================================");
        corpusSQL.push("-- CORPUS Database Cleanup - Remove Duplicate Tables");
        corpusSQL.push(`-- Generated: ${new Date().toISOString()}`);
        corpusSQL.push("-- ⚠️  RUN ONLY ON CORPUS DATABASE ⚠️");
        corpusSQL.push("-- ================================================================================");
        corpusSQL.push("");
        
        if (corpusDrops.length > 0) {
          corpusSQL.push("-- DROP tables that should be in RUNTIME only:");
          corpusDrops.forEach(t => {
            corpusSQL.push(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
          });
        } else {
          corpusSQL.push("-- No tables to drop from CORPUS");
        }
        
        runtimeSQL.push("-- ================================================================================");
        runtimeSQL.push("-- RUNTIME Database Cleanup - Remove Duplicate Tables");
        runtimeSQL.push(`-- Generated: ${new Date().toISOString()}`);
        runtimeSQL.push("-- ⚠️  RUN ONLY ON RUNTIME DATABASE ⚠️");
        runtimeSQL.push("-- ================================================================================");
        runtimeSQL.push("");
        
        if (runtimeDrops.length > 0) {
          runtimeSQL.push("-- DROP tables that should be in CORPUS only:");
          runtimeDrops.forEach(t => {
            runtimeSQL.push(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
          });
        } else {
          runtimeSQL.push("-- No tables to drop from RUNTIME");
        }
        
        const reportsDir = path.join(process.cwd(), 'analytics', 'reports');
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        fs.writeFileSync(
          path.join(reportsDir, 'cleanup_duplicates_corpus.sql'),
          corpusSQL.join('\n')
        );
        fs.writeFileSync(
          path.join(reportsDir, 'cleanup_duplicates_runtime.sql'),
          runtimeSQL.join('\n')
        );
        
        console.log(`\n✅ Generated cleanup SQL files:`);
        console.log(`   - analytics/reports/cleanup_duplicates_corpus.sql`);
        console.log(`   - analytics/reports/cleanup_duplicates_runtime.sql`);
      }
    } else {
      console.log("✅ No duplicate tables found!");
    }
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
