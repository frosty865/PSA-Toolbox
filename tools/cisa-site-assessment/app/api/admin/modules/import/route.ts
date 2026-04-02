import { NextResponse } from "next/server";
import { importModule } from "@/app/lib/admin/module_import_v2";
import { lintModuleImport } from "@/app/lib/admin/module_import_linter";

/**
 * POST /api/admin/modules/import
 * 
 * Import a module definition including metadata, module-specific questions, and module-specific OFCs.
 * 
 * Body: ModuleImportPayload
 * {
 *   module_code: "MODULE_EV_CHARGING",
 *   title: "EV Charging Stations",
 *   description: "...",
 *   module_questions: [{
 *     id: "MODULEQ_EV_CHARGING_001", 
 *     text: "...", 
 *     order: 1,
 *     discipline_id: "<uuid>",
 *     discipline_subtype_id: "<uuid>",
 *     asset_or_location: "EV parking area",
 *     event_trigger: "TAMPERING"
 *   }],
 *   module_ofcs: [{ofc_id: "...", ofc_text: "...", order_index: 1, sources: [...]}],
 *   risk_drivers: [{driver_type: "CYBER_DRIVER", driver_text: "..."}]
 * }
 * 
 * Returns:
 * {
 *   ok: true,
 *   result: {
 *     module_code: string,
 *     batch_id: string,
 *     module_questions_imported: number,
 *     module_ofcs_imported: number,
 *     sources_imported: number,
 *     sources_registered: number,
 *     sources_skipped: number,
 *     risk_drivers_imported: number
 *   }
 * }
 * 
 * On validation failure:
 * {
 *   ok: false,
 *   error: string,
 *   linter_errors: string[]
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Run linter first to get detailed errors
    const linterResult = lintModuleImport(body);
    if (!linterResult.ok) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Module import validation failed",
          linter_errors: linterResult.errors 
        },
        { status: 400 }
      );
    }

    const result = await importModule(body);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e: unknown) {
    console.error("[API /api/admin/modules/import] Error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    // Check if error message contains linter errors (from importModule)
    if (msg.includes("validation failed")) {
      const errorLines = msg.split("\n");
      const linterErrors = errorLines.slice(1); // Skip first line "Module import validation failed:"
      return NextResponse.json(
        { 
          ok: false, 
          error: "Module import validation failed",
          linter_errors: linterErrors.filter(Boolean)
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: msg || "Import failed" },
      { status: 400 }
    );
  }
}

