import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * POST /api/admin/modules/create
 * 
 * Creates a new assessment module (metadata only, status = DRAFT).
 * Importing module content remains a separate step.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { module_code, title, description } = body;

    // Validation
    if (!module_code || typeof module_code !== "string") {
      return NextResponse.json(
        { error: "module_code is required and must be a string" },
        { status: 400 }
      );
    }

    if (!module_code.startsWith("MODULE_")) {
      return NextResponse.json(
        { error: 'module_code must start with "MODULE_"' },
        { status: 400 }
      );
    }

    if (!/^MODULE_[A-Z0-9_]+$/.test(module_code)) {
      return NextResponse.json(
        { error: 'module_code must match pattern MODULE_[A-Z0-9_]+' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();
    const client = await runtimePool.connect();

    try {
      await client.query("BEGIN");

      // Check if module_code already exists
      const existing = await client.query(
        `SELECT module_code FROM public.assessment_modules WHERE module_code = $1`,
        [module_code]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Module with code "${module_code}" already exists` },
          { status: 409 }
        );
      }

      // Insert new module with DRAFT status
      const result = await client.query(
        `
        INSERT INTO public.assessment_modules 
          (module_code, module_name, description, status, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'DRAFT', true, NOW(), NOW())
        RETURNING module_code, module_name, description, status
        `,
        [module_code, title.trim(), description ? description.trim() : null]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          module_code: result.rows[0].module_code,
          module_name: result.rows[0].module_name,
          description: result.rows[0].description,
          status: result.rows[0].status,
        },
        { status: 201 }
      );
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error(`[API /api/admin/modules/create] Error:`, error);
    return NextResponse.json(
      {
        error: "Failed to create module",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

