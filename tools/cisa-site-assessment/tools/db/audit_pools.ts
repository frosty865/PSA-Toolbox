#!/usr/bin/env tsx
/**
 * CLI tool to audit database pool separation.
 * 
 * Checks that tables exist on their expected pools and reports any contamination.
 * 
 * Usage:
 *   npx tsx tools/db/audit_pools.ts
 * 
 * Exit codes:
 *   0 - All checks passed
 *   1 - Duplicates found or mapping validation failed
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env.local (relative to project root)
dotenv.config({ path: '.env.local' });

import tableMap from "../../config/db_table_map.json";
import { tableExists, dbIdentity } from "../../app/lib/db/table_exists";
import { getCorpusPool } from "../../app/lib/db/corpus_client";
import { getRuntimePool } from "../../app/lib/db/runtime_client";

async function main() {
  try {
    console.log("🔍 Auditing database pool separation...\n");

    const corpus = getCorpusPool();
    const runtime = getRuntimePool();

    const corpusId = await dbIdentity(corpus as any);
    const runtimeId = await dbIdentity(runtime as any);

    console.log("📊 Database Identities:");
    console.log(`  CORPUS: ${corpusId?.db} (user: ${corpusId?.db_user})`);
    console.log(`  RUNTIME: ${runtimeId?.db} (user: ${runtimeId?.db_user})`);
    console.log("");

    const checks = [
      // Always audit these, regardless of table_map.json contents:
      { schema: "public", table: "ofc_candidate_queue" },
      { schema: "public", table: "ofc_library" },
      { schema: "public", table: "ofc_library_citations" },
      { schema: "public", table: "document_chunks" },
      { schema: "public", table: "assessments" },
      { schema: "public", table: "assessment_responses" },
      { schema: "public", table: "disciplines" },
      { schema: "public", table: "discipline_subtypes" },
      { schema: "public", table: "source_registry" },
      { schema: "public", table: "canonical_sources" },
      { schema: "public", table: "documents" },
      { schema: "public", table: "ofc_candidate_targets" },
      { schema: "public", table: "assessment_instances" },
      { schema: "public", table: "ofc_nominations" },
      { schema: "public", table: "expansion_questions" },
      { schema: "public", table: "assessment_expansion_responses" },
      { schema: "public", table: "baseline_spines_runtime" },
    ];

    console.log("🔎 Quick Audit (all tables):");
    const results: any[] = [];
    for (const c of checks) {
      const inCorpus = await tableExists(corpus as any, c.schema, c.table);
      const inRuntime = await tableExists(runtime as any, c.schema, c.table);

      const verdict =
        inCorpus && inRuntime ? "DUPLICATE (BAD)" :
        inCorpus ? "CORPUS" :
        inRuntime ? "RUNTIME" :
        "MISSING";

      results.push({
        schema: c.schema,
        table: c.table,
        corpus: inCorpus,
        runtime: inRuntime,
        verdict
      });

      const icon = verdict === "DUPLICATE (BAD)" ? "❌" : verdict === "MISSING" ? "⚠️" : "✓";
      console.log(`  ${icon} ${c.schema}.${c.table}: ${verdict}`);
    }

    console.log("\n📋 Mapping Validation:");
    const mapping: any[] = [];
    for (const t of (tableMap as any).tables) {
      const inCorpus = await tableExists(corpus as any, t.schema, t.table);
      const inRuntime = await tableExists(runtime as any, t.schema, t.table);
      const expected = t.pool;

      const ok =
        (expected === "CORPUS" && inCorpus && !inRuntime) ||
        (expected === "RUNTIME" && inRuntime && !inCorpus);

      mapping.push({
        schema: t.schema,
        table: t.table,
        expected,
        corpus: inCorpus,
        runtime: inRuntime,
        ok
      });

      const icon = ok ? "✓" : "❌";
      const status = ok ? "OK" : "FAIL";
      console.log(`  ${icon} ${t.schema}.${t.table}: expected ${expected}, status: ${status}`);
      if (!ok) {
        console.log(`      → Found in CORPUS: ${inCorpus}, RUNTIME: ${inRuntime}`);
      }
    }

    // Check for duplicates
    const duplicates = results.filter(r => r.verdict === "DUPLICATE (BAD)");
    const mappingErrors = mapping.filter(m => !m.ok);

    console.log("\n📊 Summary:");
    console.log(`  Total tables checked: ${checks.length}`);
    console.log(`  Duplicates found: ${duplicates.length}`);
    console.log(`  Mapping errors: ${mappingErrors.length}`);

    const ofcCandidateQueueResult = results.find(r => r.table === "ofc_candidate_queue");
    if (ofcCandidateQueueResult) {
      console.log(`\n🎯 ofc_candidate_queue location: ${ofcCandidateQueueResult.verdict}`);
      console.log(`   → CORPUS: ${ofcCandidateQueueResult.corpus}, RUNTIME: ${ofcCandidateQueueResult.runtime}`);
    }

    if (duplicates.length > 0) {
      console.log("\n❌ ERRORS FOUND:");
      console.log("   Duplicate tables (exist in both pools):");
      duplicates.forEach(d => {
        console.log(`     - ${d.schema}.${d.table}`);
      });
    }

    if (mappingErrors.length > 0) {
      console.log("\n❌ ERRORS FOUND:");
      console.log("   Mapping validation failures:");
      mappingErrors.forEach(m => {
        console.log(`     - ${m.schema}.${m.table}: expected ${m.expected}, but found in CORPUS: ${m.corpus}, RUNTIME: ${m.runtime}`);
      });
    }

    if (duplicates.length === 0 && mappingErrors.length === 0) {
      console.log("\n✅ All checks passed!");
      process.exit(0);
    } else {
      console.log("\n❌ Audit failed. Fix issues above and re-run.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error during audit:", error);
    process.exit(1);
  }
}

main();
