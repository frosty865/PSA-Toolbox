import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { spawn } from "child_process";
import path from "path";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/modules/ingest/scan
 * Body: { module_code: string }
 * Triggers the module incoming PDF processor for the given module_code (scans incoming/{module_code}).
 */
export async function POST(request: NextRequest) {
  try {
    let body: { module_code?: string } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      // optional body
    }
    const module_code = body.module_code?.trim();
    if (!module_code) {
      return NextResponse.json(
        { error: "module_code is required" },
        { status: 400 }
      );
    }

    const runtime = getRuntimePool();
    const mod = await runtime.query(
      "SELECT 1 FROM public.assessment_modules WHERE module_code = $1",
      [module_code]
    );
    if (mod.rows.length === 0) {
      return NextResponse.json(
        { error: `module_code "${module_code}" not found in assessment_modules` },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const scriptPath = path.resolve(projectRoot, "tools", "corpus", "process_module_pdfs_from_incoming.py");
    if (!existsSync(scriptPath)) {
      return NextResponse.json(
        { error: "Module processor script not found: tools/corpus/process_module_pdfs_from_incoming.py", triggered: false },
        { status: 500 }
      );
    }

    const pythonExe = process.env.PYTHON_EXECUTABLE || process.env.PROCESSOR_PYTHON || "python";
    const proc = spawn(pythonExe, [scriptPath, "--module-code", module_code], { cwd: projectRoot });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    const code = await new Promise<number>((resolve) => proc.on("close", resolve));

    if (code !== 0) {
      return NextResponse.json(
        { error: "Scan script failed", message: stderr.slice(-500), exitCode: code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Module ingestion scan completed",
      module_code,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Scan failed", message: msg }, { status: 500 });
  }
}
