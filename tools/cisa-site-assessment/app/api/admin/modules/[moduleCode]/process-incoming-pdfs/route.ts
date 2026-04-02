import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getPythonExecutablePath, findPythonExecutable } from "@/app/lib/python/venv";
import { getComprehensionModel } from "@/app/lib/ollama/model_router";

const SCRIPT_REL = "tools/corpus/process_module_pdfs_from_incoming.py";
const INGEST_SCRIPT_REL = "tools/corpus/ingest_module_sources.py";
const COMPREHENSION_SCRIPT_REL = "tools/module_crawler/extract_module_comprehension_from_corpus.py";
const TIMEOUT_MS = 120_000;
const INGEST_TIMEOUT_MS = 120_000;
const COMPREHENSION_TIMEOUT_MS = 180_000;

function getProcessorPythonExe(): string {
  // Prefer env override
  if (process.env.PROCESSOR_PYTHON?.trim()) {
    return process.env.PROCESSOR_PYTHON.trim();
  }
  
  // Use PSA System venv utility to find processor Python
  const venvPython = getPythonExecutablePath('processor');
  const found = findPythonExecutable('processor');
  
  // Return venv Python if it exists, otherwise fall back to found Python
  return found || venvPython;
}

function resolveExePath(p: string): string {
  const path = require("path") as typeof import("path"); // eslint-disable-line @typescript-eslint/no-require-imports
  // Resolve relative to cwd at runtime; path.resolve(p) uses cwd when p is relative.
  // Avoid path.resolve(process.cwd(), p) — it triggers Turbopack broad tracing.
  return path.isAbsolute(p) ? p : path.resolve(p);
}

async function runPythonScript(
  spawn: (cmd: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv; windowsHide: boolean }) => import("child_process").ChildProcess,
  pythonExe: string,
  scriptPath: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = spawn(pythonExe, args, { cwd: process.cwd(), env: process.env, windowsHide: true });
  const chunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  proc.stdout?.on("data", (d: Buffer) => chunks.push(d));
  proc.stderr?.on("data", (d: Buffer) => errChunks.push(d));
  let exitCode = -1;
  let timedOut = false;
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      if (proc.exitCode != null) return;
      timedOut = true;
      proc.kill("SIGTERM");
      try {
        proc.kill("SIGKILL");
      } catch {
        /* noop */
      }
      errChunks.push(Buffer.from("\n[Process killed: timeout " + timeoutMs / 1000 + "s exceeded.]", "utf-8"));
      exitCode = 124;
      resolve({
        exitCode,
        stdout: Buffer.concat(chunks).toString("utf-8"),
        stderr: Buffer.concat(errChunks).toString("utf-8"),
      });
    }, timeoutMs);
    proc.on("close", (code, signal) => {
      clearTimeout(t);
      if (!timedOut) {
        exitCode = code ?? (signal ? 124 : -1);
      }
      resolve({
        exitCode,
        stdout: Buffer.concat(chunks).toString("utf-8"),
        stderr: Buffer.concat(errChunks).toString("utf-8"),
      });
    });
  });
}

type Body = {
  dryRun?: boolean;
  limit?: number | null;
  pdfDir?: string | null;
  /** Skip CORPUS mirror (corpus_documents + document_chunks). Default false. */
  skipCorpusIngest?: boolean;
  /** Skip comprehension pass after ingest. Default false. */
  skipComprehension?: boolean;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
    if (!normalizedModuleCode) {
      return NextResponse.json(
        { error: "moduleCode is required" },
        { status: 400 }
      );
    }

    let body: Body = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text) as Body;
    } catch {
      // optional body; use defaults
    }
    const dryRun = body.dryRun !== false;
    const limit = body.limit != null && typeof body.limit === "number" ? body.limit : null;
    const pdfDir = typeof body.pdfDir === "string" && body.pdfDir.trim() ? body.pdfDir.trim() : null;
    const skipCorpusIngest = body.skipCorpusIngest === true;
    const skipComprehension = body.skipComprehension === true;

    // Validate module exists in assessment_modules
    let runtimePool;
    try {
      runtimePool = getRuntimePool();
    } catch (dbError) {
      console.error("[process-incoming-pdfs] Failed to get runtime pool:", dbError);
      return NextResponse.json(
        {
          error: "Database connection failed",
          message: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 }
      );
    }

    let m;
    try {
      m = await runtimePool.query(
        "SELECT 1 FROM public.assessment_modules WHERE module_code = $1",
        [normalizedModuleCode]
      );
    } catch (queryError) {
      console.error("[process-incoming-pdfs] Database query failed:", queryError);
      return NextResponse.json(
        {
          error: "Database query failed",
          message: queryError instanceof Error ? queryError.message : String(queryError),
        },
        { status: 500 }
      );
    }

    if (!m.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    let existsSync: typeof import("fs")["existsSync"];
    let spawn: typeof import("child_process")["spawn"];
    try {
      const fs = require("fs") as typeof import("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
      const cp = require("child_process") as typeof import("child_process"); // eslint-disable-line @typescript-eslint/no-require-imports
      existsSync = fs.existsSync;
      spawn = cp.spawn;
    } catch (requireError) {
      console.error("[process-incoming-pdfs] Failed to require modules:", requireError);
      return NextResponse.json(
        {
          error: "Failed to load required modules",
          message: requireError instanceof Error ? requireError.message : String(requireError),
        },
        { status: 500 }
      );
    }

    const processorPython = resolveExePath(getProcessorPythonExe());
    console.log("[process-incoming-pdfs] Python executable:", processorPython);
    console.log("[process-incoming-pdfs] CWD:", process.cwd());

    if (!existsSync(processorPython)) {
      console.error("[process-incoming-pdfs] Python executable not found:", processorPython);
      const psaRoot = process.env.PSA_SYSTEM_ROOT || 'D:\\PSA_System';
      return NextResponse.json(
        { 
          error: "Processor Python not found", 
          path: processorPython,
          expectedPath: getPythonExecutablePath('processor'),
          psaSystemRoot: psaRoot,
          hint: `Ensure the processor venv exists at ${psaRoot}\\Dependencies\\python\\venvs\\processor\\Scripts\\python.exe or set PROCESSOR_PYTHON environment variable`
        },
        { status: 500 }
      );
    }

    const scriptPath = resolveExePath(SCRIPT_REL);
    console.log("[process-incoming-pdfs] Script path:", scriptPath);
    if (!existsSync(scriptPath)) {
      console.error("[process-incoming-pdfs] Script not found:", scriptPath);
      return NextResponse.json(
        {
          error: "Ingestion script not found",
          message: `Expected: ${scriptPath}`,
        },
        { status: 500 }
      );
    }

    const args: string[] = [
      scriptPath,
      "--module-code",
      normalizedModuleCode,
      ...(dryRun ? ["--dry-run"] : []),
      ...(limit != null ? ["--limit", String(limit)] : []),
      ...(pdfDir ? ["--pdf-dir", pdfDir] : []),
    ];
    const command = [processorPython, ...args].join(" ");
    console.log("[process-incoming-pdfs] Command:", command);
    console.log("[process-incoming-pdfs] Args:", args);

    let proc;
    try {
      proc = spawn(processorPython, args, {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
      });
    } catch (spawnError) {
      console.error("[process-incoming-pdfs] Spawn failed:", spawnError);
      return NextResponse.json(
        {
          error: "Failed to spawn process",
          message: spawnError instanceof Error ? spawnError.message : String(spawnError),
        },
        { status: 500 }
      );
    }

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout?.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr?.on("data", (d: Buffer) => errChunks.push(d));

    let exitCode: number = -1;
    let timedOut = false;

    const done = new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        if (proc.exitCode != null) return; // already exited
        timedOut = true;
        proc.kill("SIGTERM");
        try {
          proc.kill("SIGKILL");
        } catch {
          /* noop */
        }
        const msg =
          "\n[Process killed: timeout " +
          TIMEOUT_MS / 1000 +
          "s exceeded. Partial output above.]";
        errChunks.push(Buffer.from(msg, "utf-8"));
        exitCode = 124;
        resolve();
      }, TIMEOUT_MS);

      proc.on("close", (code, signal) => {
        clearTimeout(t);
        if (!timedOut) {
          exitCode = code ?? (signal ? 124 : -1);
        }
        resolve();
      });
    });

    await done;

    const stdout = Buffer.concat(chunks).toString("utf-8");
    const stderr = Buffer.concat(errChunks).toString("utf-8");

    let replicated = 0;
    let publisherBackfilled = 0;
    let corpusIngest: { exitCode: number; stdout?: string; stderr?: string; skipped?: boolean } | undefined;
    let comprehension: { exitCode: number; stdout?: string; stderr?: string; skipped?: boolean; model?: string } | undefined;
    if (exitCode === 0 && !dryRun) {
      try {
        const { replicateModuleDocsToSourceRegistry } = await import("@/app/lib/corpus/replicate_module_docs_to_source_registry");
        const rep = await replicateModuleDocsToSourceRegistry(normalizedModuleCode);
        replicated = rep.replicated;
        if (rep.replicated > 0) {
          const { getCorpusPoolForAdmin } = await import("@/app/lib/db/corpus_client");
          const {
            resolvePathForSourceRegistryRow,
            extractAndApplyPublisherToSourceRegistry,
          } = await import("@/app/lib/corpus/extract_module_source_publisher");
          const corpusPool = getCorpusPoolForAdmin();
          const rows = await corpusPool.query<{ id: string; source_key: string; local_path: string | null; storage_relpath: string | null }>(
            `SELECT id, source_key, local_path, storage_relpath FROM public.source_registry WHERE source_key LIKE $1`,
            [`module:${normalizedModuleCode}:%`]
          );
          for (const row of rows.rows) {
            const absPath = resolvePathForSourceRegistryRow(row);
            if (absPath) {
              const result = await extractAndApplyPublisherToSourceRegistry(corpusPool, row.id, absPath);
              if (result.updated) publisherBackfilled++;
            }
          }
        }
      } catch (e) {
        console.warn("[process-incoming-pdfs] Replication or publisher backfill failed (non-fatal):", e instanceof Error ? e.message : e);
      }

      // CORPUS mirror: corpus_documents + document_chunks (for comprehension and RAG)
      if (!skipCorpusIngest) {
        const ingestPath = resolveExePath(INGEST_SCRIPT_REL);
        if (existsSync(ingestPath)) {
          console.log("[process-incoming-pdfs] Running CORPUS ingest:", ingestPath);
          const ingestResult = await runPythonScript(
            spawn,
            processorPython,
            ingestPath,
            [ingestPath, "--module-code", normalizedModuleCode],
            INGEST_TIMEOUT_MS
          );
          corpusIngest = {
            exitCode: ingestResult.exitCode,
            stdout: ingestResult.stdout,
            stderr: ingestResult.stderr,
          };
          if (ingestResult.exitCode !== 0) {
            console.warn("[process-incoming-pdfs] CORPUS ingest non-zero exit:", ingestResult.exitCode, ingestResult.stderr?.slice(0, 300));
          }
        } else {
          corpusIngest = { exitCode: -1, skipped: true };
        }
      } else {
        corpusIngest = { exitCode: 0, skipped: true };
      }

      // Comprehension pass (reads CORPUS document_chunks, writes RUNTIME module_chunk_comprehension)
      if (!skipComprehension) {
        const compPath = resolveExePath(COMPREHENSION_SCRIPT_REL);
        const compModel = getComprehensionModel();
        if (existsSync(compPath)) {
          console.log("[process-incoming-pdfs] Running comprehension:", compPath, "model=", compModel);
          const compResult = await runPythonScript(
            spawn,
            processorPython,
            compPath,
            [compPath, "--module-code", normalizedModuleCode, "--model", compModel, "--apply"],
            COMPREHENSION_TIMEOUT_MS
          );
          comprehension = {
            exitCode: compResult.exitCode,
            stdout: compResult.stdout,
            stderr: compResult.stderr,
            model: compModel,
          };
          if (compResult.exitCode !== 0) {
            console.warn("[process-incoming-pdfs] Comprehension non-zero exit:", compResult.exitCode, compResult.stderr?.slice(0, 300));
          }
        } else {
          comprehension = { exitCode: -1, skipped: true, model: compModel };
        }
      } else {
        comprehension = { exitCode: 0, skipped: true };
      }
    }

    const payload: Record<string, unknown> = {
      ok: exitCode === 0,
      exitCode,
      stdout,
      stderr,
      command,
      ...(replicated > 0 ? { replicated, publisherBackfilled } : {}),
    };
    if (typeof corpusIngest !== "undefined") {
      payload.corpusIngest = corpusIngest;
    }
    if (typeof comprehension !== "undefined") {
      payload.comprehension = comprehension;
    }
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[process-incoming-pdfs]", err);
    console.error("[process-incoming-pdfs] Stack:", err.stack);
    return NextResponse.json(
      { 
        error: "Request failed", 
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
      },
      { status: 500 }
    );
  }
}
