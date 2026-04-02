import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { getCorpusPoolForAdmin } from "@/app/lib/db/corpus_client";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/corpus/process-one
 * Body: { source_registry_id: string }
 * Runs the corpus ingestion Python script for this one source (creates corpus_document + chunks).
 */
export async function POST(request: NextRequest) {
  try {
    let body: { source_registry_id?: string } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      // optional body
    }
    const source_registry_id = body.source_registry_id;
    if (!source_registry_id || typeof source_registry_id !== "string") {
      return NextResponse.json(
        { error: "source_registry_id is required" },
        { status: 400 }
      );
    }

    const pool = getCorpusPoolForAdmin();
    const sr = await pool.query(
      `SELECT id, local_path, title, source_key FROM public.source_registry WHERE id = $1`,
      [source_registry_id]
    );
    if (sr.rows.length === 0) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    const row = sr.rows[0];
    const pdfPath = row.local_path;
    if (!pdfPath) {
      return NextResponse.json(
        { error: "Source has no local_path (file not downloaded)" },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const pythonScript = path.resolve(projectRoot, "tools", "corpus_ingest_pdf.py");
    const { existsSync } = await import("fs");
    if (!existsSync(pythonScript)) {
      return NextResponse.json(
        { error: "Python ingestion script not found: tools/corpus_ingest_pdf.py" },
        { status: 500 }
      );
    }
    const pythonExe = process.env.PYTHON_EXECUTABLE || "python";

    const result = await new Promise<{ ok: boolean; stderr: string }>((resolve) => {
      const proc = spawn(pythonExe, [
        pythonScript,
        "--pdf_path", pdfPath,
        "--source_registry_id", source_registry_id,
        "--ingestion-stream", "GENERAL",
        "--source_name", "",
        "--title", (row.title || row.source_key || "document").slice(0, 200),
        "--authority_scope", "BASELINE_AUTHORITY",
      ], { cwd: projectRoot });

      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        resolve({ ok: code === 0, stderr });
      });
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Ingestion script failed", message: result.stderr.slice(-500) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Processed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "process-one failed", message: msg }, { status: 500 });
  }
}
