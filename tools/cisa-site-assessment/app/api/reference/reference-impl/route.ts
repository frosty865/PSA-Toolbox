import { NextRequest, NextResponse } from "next/server";
import { getOrCompute } from "@/app/lib/runtime/reference_impl_cache";
import { runPython } from "@/app/lib/runtime/python_runner";
import { getPythonExe } from "@/app/lib/runtime/python_exec";

export const runtime = "nodejs";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const discipline_subtype_id = url.searchParams.get("discipline_subtype_id")?.trim();

  if (!discipline_subtype_id) {
    return jsonError(400, "Missing required query param: discipline_subtype_id");
  }

  // Basic UUID-ish validation (non-blocking strictness)
  if (!/^[0-9a-fA-F-]{32,36}$/.test(discipline_subtype_id)) {
    return jsonError(400, "discipline_subtype_id does not look like a UUID");
  }

  const subtypeId = discipline_subtype_id;

  const cached = await getOrCompute(subtypeId, async () => {
    const py = getPythonExe();
    const repoRoot = process.cwd();

    const script = `
import json
from model.doctrine.reference_impls import try_get_reference_impl
rid = ${JSON.stringify(subtypeId)}
ref = try_get_reference_impl(rid)
if not ref:
    print(json.dumps({"ok": True, "found": False}))
else:
    print(json.dumps({"ok": True, "found": True, "payload": ref.payload}))
`.trim();

    const res = await runPython(py, ["-c", script], {
      cwd: repoRoot,
      env: process.env,
      timeoutMs: 8000,
    });

    if (!res.ok) {
      throw new Error(
        `reference-impl python failed: ${res.error ?? "unknown"}; stderr=${res.stderr}`
      );
    }

    const txt = (res.stdout || "").trim();
    if (!txt) {
      throw new Error("reference-impl python returned empty stdout");
    }

    try {
      return JSON.parse(txt) as { ok: boolean; found?: boolean; payload?: unknown };
    } catch {
      throw new Error(`reference-impl python stdout not JSON: ${txt.slice(0, 200)}`);
    }
  });

  if ("error" in cached) {
    const resp = NextResponse.json({ ok: false, error: cached.error }, { status: 500 });
    resp.headers.set("X-Reference-Impl-Cache", cached.cache);
    return resp;
  }

  const resp = NextResponse.json(cached.payload, { status: 200 });
  resp.headers.set("X-Reference-Impl-Cache", cached.cache);
  return resp;
}

