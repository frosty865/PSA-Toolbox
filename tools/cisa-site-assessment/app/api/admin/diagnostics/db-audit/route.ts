import { NextResponse } from "next/server";
import tableMap from "../../../../../config/db_table_map.json";
import { tableExists, dbIdentity } from "@/app/lib/db/table_exists";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const corpus = getCorpusPool();
    const runtime = getRuntimePool();

    const corpusId = await dbIdentity(corpus as Parameters<typeof dbIdentity>[0]);
    const runtimeId = await dbIdentity(runtime as Parameters<typeof dbIdentity>[0]);

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

    interface CheckResult { schema: string; table: string; corpus: boolean; runtime: boolean; verdict: string }
    const results: CheckResult[] = [];
    for (const c of checks) {
      const inCorpus = await tableExists(corpus as Parameters<typeof tableExists>[0], c.schema, c.table);
      const inRuntime = await tableExists(runtime as Parameters<typeof tableExists>[0], c.schema, c.table);

      results.push({
        schema: c.schema,
        table: c.table,
        corpus: inCorpus,
        runtime: inRuntime,
        verdict:
          inCorpus && inRuntime ? "DUPLICATE (BAD)" :
          inCorpus ? "CORPUS" :
          inRuntime ? "RUNTIME" :
          "MISSING"
      });
    }

    interface TableMapTable { schema: string; table: string; pool: string }
    const mapping: Array<{ schema: string; table: string; expected: string; corpus: boolean; runtime: boolean; ok: boolean }> = [];
    for (const t of (tableMap as { tables: TableMapTable[] }).tables) {
      const inCorpus = await tableExists(corpus as Parameters<typeof tableExists>[0], t.schema, t.table);
      const inRuntime = await tableExists(runtime as Parameters<typeof tableExists>[0], t.schema, t.table);
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
    }

    // Check for any DUPLICATE (BAD) verdicts
    const duplicates = results.filter(r => r.verdict === "DUPLICATE (BAD)");
    const mappingErrors = mapping.filter(m => !m.ok);

    return NextResponse.json({
      ok: duplicates.length === 0 && mappingErrors.length === 0,
      corpus_identity: corpusId,
      runtime_identity: runtimeId,
      quick_audit: results,
      mapping_validation: mapping,
      summary: {
        total_tables_checked: checks.length,
        duplicates_found: duplicates.length,
        mapping_errors: mappingErrors.length,
        ofc_candidate_queue_location: results.find(r => r.table === "ofc_candidate_queue")?.verdict || "UNKNOWN"
      }
    });
  } catch (error: unknown) {
    console.error('[DB Audit] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to audit databases',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

