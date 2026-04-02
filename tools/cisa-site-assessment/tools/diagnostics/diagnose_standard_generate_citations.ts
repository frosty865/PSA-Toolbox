/**
 * Diagnostic: reproduce standard/generate citation flow and print handle map + drop reasons.
 * Usage: npx tsx tools/diagnostics/diagnose_standard_generate_citations.ts <module_code>
 * Requires: data/module_chunks/<module_code>.json (run standard/generate export or extract first).
 * DB URLs: loaded from .env.local (RUNTIME_DATABASE_URL or RUNTIME_DB_URL) for raw row query.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { Client } from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const CHUNKS_DIR = path.join(process.cwd(), "data", "module_chunks");
const OUTPUT_DIR = path.join(process.cwd(), "tools", "outputs");
const SCRIPT_PATH = path.join(process.cwd(), "tools", "modules", "run_module_parser_from_db.py");

function getPythonExecutable(): string {
  const fromEnv = process.env.PYTHON_PATH || process.env.PYTHON;
  if (fromEnv?.trim()) return fromEnv.trim();
  if (process.platform === "win32") {
    const py = spawnSync("py", ["-3", "-c", "import sys; print(sys.executable)"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    if (!py.error && py.status === 0 && py.stdout?.trim()) return py.stdout.trim();
  }
  const t = spawnSync("python3", ["-c", "pass"], { encoding: "utf-8", timeout: 5000 });
  if (!t.error) return "python3";
  return "python";
}

async function main(): Promise<void> {
  const moduleCode = process.argv[2]?.trim();
  if (!moduleCode) {
    console.error("Usage: npx tsx tools/diagnostics/diagnose_standard_generate_citations.ts <module_code>");
    process.exit(1);
  }

  const chunksPath = path.join(CHUNKS_DIR, `${moduleCode}.json`);
  if (!fs.existsSync(chunksPath)) {
    console.error(`Chunks file not found: ${chunksPath}`);
    console.error("Run standard/generate once (export step) or extract chunks first.");
    process.exit(1);
  }

  let data: {
    chunks?: Array<{
      chunk_id?: string;
      source_registry_id?: string;
      source_file?: string;
      source_label?: string;
      page_range?: string;
      locator_value?: string;
      text?: string;
    }>;
    source_index?: Record<string, string>;
  };
  try {
    data = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
  } catch (e) {
    console.error("Failed to parse chunks JSON:", e);
    process.exit(1);
  }

  const chunks = data.chunks ?? [];
  const sourceIndex = data.source_index ?? {};
  console.log(`\n--- Chunks: ${chunks.length} ---\n`);

  const firstChunkIds = chunks.slice(0, 5).map((c) => c.chunk_id).filter(Boolean) as string[];
  const runtimeUrl = process.env.RUNTIME_DATABASE_URL || process.env.RUNTIME_DB_URL || "";
  if (runtimeUrl && firstChunkIds.length > 0) {
    try {
      const allowInsecureTls = process.env.ALLOW_INSECURE_DB_TLS_FOR_DIAGNOSTICS === "true";
      const client = new Client({
        connectionString: runtimeUrl,
        ...(allowInsecureTls ? { ssl: { rejectUnauthorized: false } } : {}),
      });
      await client.connect();
      const res = await client.query(
        `SELECT
          mc.id AS chunk_id,
          mc.module_document_id AS doc_id,
          mc.chunk_index,
          mc.locator,
          length(mc.text) AS text_len,
          md.label AS doc_label,
          md.local_path AS doc_local_path,
          ms.id AS source_id,
          ms.source_label AS source_label,
          ms.storage_relpath AS source_storage_relpath
        FROM public.module_chunks mc
        JOIN public.module_documents md ON md.id = mc.module_document_id
        LEFT JOIN public.module_sources ms ON ms.module_code = md.module_code AND ms.sha256 = md.sha256 AND ms.source_type = 'MODULE_UPLOAD'
        WHERE mc.id = ANY($1::uuid[])`,
        [firstChunkIds]
      );
      console.log("--- Raw DB rows (first 5 chunk_ids) ---\n");
      for (const row of res.rows as Record<string, unknown>[]) {
        console.log("  chunk_id:", row.chunk_id);
        console.log("  source_id:", row.source_id);
        console.log("  doc_id:", row.doc_id);
        console.log("  locator:", row.locator);
        console.log("  doc_label:", row.doc_label);
        console.log("  doc_local_path:", row.doc_local_path);
        console.log("  source_label:", row.source_label);
        console.log("  source_storage_relpath:", row.source_storage_relpath);
        console.log("  text_len:", row.text_len);
        console.log("  ---");
      }
      await client.end();
    } catch (e) {
      console.warn("DB raw row query failed (optional):", e);
    }
  }

  const handleMap: Record<string, { chunk_id: string; source_file: string; page_range: string }> = {};
  for (let i = 0; i < chunks.length; i++) {
    const h = `C${(i + 1).toString().padStart(2, "0")}`;
    const c = chunks[i];
    const sid = c.source_registry_id;
    const source_file =
      String(c.source_label ?? c.source_file ?? (sid ? sourceIndex[sid] : "") ?? "").trim() || "(no label)";
    const page_range = String(c.page_range ?? c.locator_value ?? "").trim();
    handleMap[h] = {
      chunk_id: String(c.chunk_id ?? "").trim(),
      source_file,
      page_range: page_range || "?",
    };
  }

  const entries = Object.entries(handleMap).slice(0, 20);
  console.log("\nFirst 20 handle mappings (C01 -> chunk_id / source_file / locator):");
  for (const [h, ref] of entries) {
    const locator = ref.page_range && ref.page_range !== "?" ? `p.${ref.page_range}` : "p.?";
    console.log(`  ${h} -> chunk_id=${(ref.chunk_id || "(empty)").slice(0, 36)} source_file=${(ref.source_file || "").slice(0, 50)} locator=${locator}`);
  }
  if (Object.keys(handleMap).length > 20) {
    console.log(`  ... and ${Object.keys(handleMap).length - 20} more`);
  }

  console.log("\n--- Running generation (same as standard/generate) ---\n");
  const env = { ...process.env, PYTHONPATH: process.cwd(), RUNTIME_DATABASE_URL: runtimeUrl };
  const stdinPayload = JSON.stringify({ chunks, source_index: data.source_index ?? {} });
  const result = spawnSync(getPythonExecutable(), [SCRIPT_PATH, "--module-code", moduleCode, "--stdin", "--use-packet-pipeline", "--module-kind", "OBJECT"], {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
    encoding: "utf-8",
    timeout: 600_000,
    input: stdinPayload,
  });

  if (result.error) {
    console.error("Python spawn error:", result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("Python exited", result.status);
    console.error("stderr:", (result.stderr || "").slice(0, 1000));
    process.exit(1);
  }

  const outputPath = path.join(OUTPUT_DIR, `module_parser_test_${moduleCode}.json`);
  if (!fs.existsSync(outputPath)) {
    console.error("Output file not found:", outputPath);
    process.exit(1);
  }

  let out: {
    items?: unknown[];
    items_empty_reason?: string;
    dropped_total?: number;
    drop_reasons?: Record<string, number>;
    examples?: Array<{ reason: string; bad_handles?: string[] | null; text?: string }>;
  };
  try {
    out = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  } catch (e) {
    console.error("Failed to parse output JSON:", e);
    process.exit(1);
  }

  const items = out.items ?? [];
  console.log(`\n--- Result: ${items.length} items ---\n`);
  if (items.length === 0 && out.items_empty_reason) {
    console.log("items_empty_reason:", out.items_empty_reason);
    if (out.dropped_total != null) {
      console.log("dropped_total:", out.dropped_total);
      console.log("drop_reasons:", JSON.stringify(out.drop_reasons ?? {}, null, 2));
      const examples = out.examples ?? [];
      const invalidHandles = new Set<string>();
      for (const ex of examples) {
        if (ex.bad_handles) for (const h of ex.bad_handles) invalidHandles.add(h);
      }
      const badList = [...invalidHandles].slice(0, 10);
      console.log("First 10 invalid handles found:", badList.length ? badList : "(none in examples)");
      console.log("Example drops (top 5):");
      for (const ex of examples.slice(0, 5)) {
        console.log(`  reason=${ex.reason} bad_handles=${JSON.stringify(ex.bad_handles ?? [])} text=${(ex.text ?? "").slice(0, 60)}...`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
