/**
 * Module Creation Utility
 * 
 * Provides programmatic methods for creating modules:
 * - createModuleMetadata: Creates module with DRAFT status
 * - createAndImportModule: Creates module and imports content in one step
 */

import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { importModule, type ModuleImportPayload } from "./module_import_v2";

export type CreateModuleMetadataParams = {
  module_code: string;
  title: string;
  description?: string | null;
};

export type CreateModuleMetadataResult = {
  module_code: string;
  module_name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE";
};

/**
 * Create module metadata only (status = DRAFT)
 * 
 * This creates the module record without any questions/OFCs.
 * Use importModule() separately to add content.
 */
export async function createModuleMetadata(
  params: CreateModuleMetadataParams
): Promise<CreateModuleMetadataResult> {
  const { module_code, title, description } = params;

  // Validation
  if (!module_code || typeof module_code !== "string") {
    throw new Error("module_code is required and must be a string");
  }

  if (!module_code.startsWith("MODULE_")) {
    throw new Error('module_code must start with "MODULE_"');
  }

  if (!/^MODULE_[A-Z0-9_]+$/.test(module_code)) {
    throw new Error('module_code must match pattern MODULE_[A-Z0-9_]+');
  }

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw new Error("title is required and must be a non-empty string");
  }

  const runtimePool = getRuntimePool();
  const client = await runtimePool.connect();

  try {
    await client.query("BEGIN");

    // Check if module_code already exists
    const existing = await client.query(
      `SELECT module_code, status FROM public.assessment_modules WHERE module_code = $1`,
      [module_code]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const existingModule = existing.rows[0];
      await client.query("ROLLBACK");
      
      // Return existing module info instead of throwing error
      return {
        module_code: existingModule.module_code,
        module_name: existingModule.module_name || title.trim(),
        description: existingModule.description,
        status: existingModule.status || "DRAFT"
      };
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

    return {
      module_code: result.rows[0].module_code,
      module_name: result.rows[0].module_name,
      description: result.rows[0].description,
      status: result.rows[0].status,
    };
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Create module and import content in one step
 * 
 * This combines createModuleMetadata() and importModule() into a single operation.
 * If the module already exists, it will update it with the new content.
 */
export async function createAndImportModule(
  payload: ModuleImportPayload
): Promise<{
  module_code: string;
  status: "DRAFT" | "ACTIVE";
  batch_id: string;
  module_questions_imported: number;
  module_ofcs_imported: number;
  risk_drivers_imported: number;
  sources_imported: number;
  sources_registered: number;
  sources_skipped: number;
}> {
  // First, ensure module metadata exists (create if needed)
  await createModuleMetadata({
    module_code: payload.module_code,
    title: payload.title,
    description: payload.description || null
  });

  // Then import the content (this will update status to ACTIVE if content is imported)
  const importResult = await importModule(payload);

  return {
    module_code: importResult.module_code,
    status: "ACTIVE", // Import sets status to ACTIVE
    batch_id: importResult.batch_id,
    module_questions_imported: importResult.module_questions_imported,
    module_ofcs_imported: importResult.module_ofcs_imported,
    risk_drivers_imported: importResult.risk_drivers_imported,
    sources_imported: importResult.sources_imported,
    sources_registered: importResult.sources_registered,
    sources_skipped: importResult.sources_skipped || 0,
  };
}
