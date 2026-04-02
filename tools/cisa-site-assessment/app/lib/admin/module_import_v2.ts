/**
 * Module Import Library V2 - Additive Modules Only
 * 
 * Validates and imports module definitions including:
 * - Module metadata (code, name, description)
 * - Module-specific questions (NOT baseline) with discipline ownership
 * - Module-specific OFCs (NOT baseline)
 * - Risk drivers (read-only context)
 * - Source registration in source_registry (CORPUS)
 * 
 * NON-NEGOTIABLE RULES:
 * - Modules must not link to baseline question IDs or baseline OFCs
 * - Module content must be technology/situation dependent and additive
 * - Module questions must be discipline-anchored and non-generic
 */

import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { registerSources } from "./source_registration";
import { lintModuleImport, type ModuleImportPayloadInput } from "./module_import_linter";
import { validateDisciplineOwnership } from "./module_validators/discipline_ownership_validator";
import { validateRiskDrivers } from "./module_validators/risk_driver_validator";
import { validateEventTriggers } from "./module_validators/event_trigger_validator";
import { createModuleMetadata } from "./module_creation";
import { guardModuleQuery } from "@/app/lib/modules/table_access_guards";
import crypto from "crypto";

export type ModuleQuestion = {
  id: string; // e.g., MODULEQ_EV_CHARGING_001
  text: string;
  order: number;
  discipline_id: string; // UUID
  discipline_subtype_id: string; // UUID
  asset_or_location: string;
  event_trigger: "FIRE" | "TAMPERING" | "IMPACT" | "OUTAGE" | "OTHER";
};

export type ModuleOFCSource = {
  url: string;
  label?: string | null;
};

export type ModuleOFC = {
  ofc_id: string;
  ofc_num?: number | null;
  ofc_text: string;
  order_index: number;
  source_system?: string | null;
  source_ofc_id?: string | null;
  source_ofc_num?: number | null;
  sources?: ModuleOFCSource[];
};

export type ModuleImportPayload = {
  module_code: string;
  title: string; // Maps to module_name in DB
  description?: string | null;
  import_source?: string; // e.g., "module_ev_charging_import.json"
  mode?: "REPLACE" | "APPEND"; // Default: REPLACE
  module_questions?: ModuleQuestion[];
  module_ofcs?: ModuleOFC[];
  risk_drivers?: Array<{
    driver_type: "CYBER_DRIVER" | "FRAUD_DRIVER";
    driver_text: string;
  }>;
};

function assertModuleCode(code: string) {
  if (!code || typeof code !== "string") {
    throw new Error("module_code required");
  }
  if (!code.startsWith("MODULE_")) {
    throw new Error('module_code must start with "MODULE_"');
  }
  if (!/^MODULE_[A-Z0-9_]+$/.test(code)) {
    throw new Error('module_code must match pattern MODULE_[A-Z0-9_]+');
  }
}

// Note: Validation is now handled by lintModuleImport()
// This function is kept for backward compatibility but should not be called directly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function validateModuleQuestion(q: ModuleQuestion): void {
  if (!q.id || typeof q.id !== "string") {
    throw new Error("module_questions[].id required");
  }
  if (!q.id.startsWith("MODULEQ_")) {
    throw new Error(`module_questions[].id must start with "MODULEQ_": ${q.id}`);
  }
  if (q.id.startsWith("BASE-")) {
    throw new Error(`Modules cannot use baseline question IDs: ${q.id}`);
  }
  if (!q.text || typeof q.text !== "string" || q.text.trim().length === 0) {
    throw new Error(`module_questions[].text required for ${q.id}`);
  }
  if (typeof q.order !== "number" || q.order < 0) {
    throw new Error(`module_questions[].order must be non-negative number: ${q.id}`);
  }
  if (!q.discipline_id || typeof q.discipline_id !== "string") {
    throw new Error(`module_questions[].discipline_id required for ${q.id}`);
  }
  if (!q.discipline_subtype_id || typeof q.discipline_subtype_id !== "string") {
    throw new Error(`module_questions[].discipline_subtype_id required for ${q.id}`);
  }
  if (!q.asset_or_location || typeof q.asset_or_location !== "string" || q.asset_or_location.trim().length === 0) {
    throw new Error(`module_questions[].asset_or_location required for ${q.id}`);
  }
  if (!q.event_trigger || !["FIRE", "TAMPERING", "IMPACT", "OUTAGE", "OTHER"].includes(q.event_trigger)) {
    throw new Error(`module_questions[].event_trigger must be one of: FIRE, TAMPERING, IMPACT, OUTAGE, OTHER`);
  }
}

function validateModuleOFCSource(src: ModuleOFCSource): void {
  if (!src.url || typeof src.url !== "string" || src.url.trim().length === 0) {
    throw new Error("module_ofcs[].sources[].url required");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function validateModuleOFC(ofc: ModuleOFC): void {
  if (!ofc.ofc_id || typeof ofc.ofc_id !== "string") {
    throw new Error("module_ofcs[].ofc_id required");
  }
  if (!ofc.ofc_text || typeof ofc.ofc_text !== "string" || ofc.ofc_text.trim().length === 0) {
    throw new Error(`module_ofcs[].ofc_text required for ${ofc.ofc_id}`);
  }
  if (typeof ofc.order_index !== "number" || ofc.order_index < 0) {
    throw new Error(`module_ofcs[].order_index must be non-negative number: ${ofc.ofc_id}`);
  }
  // Validate sources if present
  if (ofc.sources && Array.isArray(ofc.sources)) {
    for (const src of ofc.sources) {
      validateModuleOFCSource(src);
    }
  }
}

export async function importModule(payload: ModuleImportPayload) {
  // Run linter first (hard fail on any errors)
  const linterResult = lintModuleImport(payload as ModuleImportPayloadInput);
  if (!linterResult.ok) {
    throw new Error(`Module import validation failed:\n${linterResult.errors.join("\n")}`);
  }

  assertModuleCode(payload.module_code);

  const title = (payload.title || "").trim();
  if (!title) {
    throw new Error("title required");
  }

  // Ensure module metadata exists (create if needed, but don't fail if it exists)
  try {
    await createModuleMetadata({
      module_code: payload.module_code,
      title: title,
      description: payload.description || null
    });
  } catch (e: unknown) {
    // If module already exists, that's fine - continue with import
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      throw e;
    }
  }

  const mode = payload.mode || "REPLACE";
  const importSource = payload.import_source || "unknown";

  // Module questions (already validated by linter)
  const moduleQuestions = payload.module_questions || [];

  // Module OFCs (already validated by linter)
  const moduleOFCs = payload.module_ofcs || [];

  // Risk drivers (optional, already validated by linter)
  let riskDrivers = payload.risk_drivers || [];

  // MANDATORY VALIDATOR 1: Discipline Ownership Validation
  if (moduleQuestions.length > 0) {
    const disciplineValidation = await validateDisciplineOwnership(moduleQuestions);
    if (!disciplineValidation.ok) {
      throw new Error(
        `Discipline ownership validation failed:\n${disciplineValidation.errors.join("\n")}`
      );
    }
  }

  // MANDATORY VALIDATOR 2: Event Trigger Validation
  if (moduleQuestions.length > 0) {
    const eventTriggerValidation = validateEventTriggers(moduleQuestions);
    if (!eventTriggerValidation.ok) {
      throw new Error(
        `Event trigger validation failed:\n${eventTriggerValidation.errors.join("\n")}`
      );
    }
  }

  // MANDATORY VALIDATOR 3: Risk Driver Normalization & Deduplication
  if (riskDrivers.length > 0) {
    const riskDriverValidation = validateRiskDrivers(riskDrivers);
    if (!riskDriverValidation.ok) {
      throw new Error(
        `Risk driver validation failed:\n${riskDriverValidation.errors.join("\n")}`
      );
    }
    // Use normalized drivers
    riskDrivers = riskDriverValidation.normalized_drivers;
  }

  // Collect all unique sources from OFCs (for counting)
  // Include sources with empty URLs if they have labels (reference-only sources)
  const allSources: Array<{ url: string; label?: string | null }> = [];
  const sourceKeySet = new Set<string>();
  
  for (const ofc of moduleOFCs) {
    if (ofc.sources && Array.isArray(ofc.sources)) {
      for (const src of ofc.sources) {
        if (!src) continue;
        const url = (src.url || "").trim();
        const label = (src.label || "").trim();
        
        // Use URL as key if present, otherwise use label
        const key = url || label;
        if (key && !sourceKeySet.has(key)) {
          sourceKeySet.add(key);
          allSources.push({ url: url || "", label: label || null });
        }
      }
    }
  }
  const uniqueSources = allSources;

  // Register sources in source_registry (CORPUS DB) BEFORE main transaction
  // Build source objects with url and label from module OFCs
  const sourceObjects: Array<{ url: string; label?: string | null }> = [];
  
  for (const ofc of moduleOFCs) {
    if (ofc.sources && Array.isArray(ofc.sources)) {
      for (const src of ofc.sources) {
        if (!src) continue;
        const url = (src.url || "").trim();
        const label = (src.label || "").trim();
        
        // Include sources with either URL or label
        const key = url || label;
        if (key) {
          // Check if we've already added this source
          const alreadyAdded = sourceObjects.some(
            (s) => (s.url && s.url === url) || (!s.url && s.label === label)
          );
          if (!alreadyAdded) {
            sourceObjects.push({ url: url || "", label: label || null });
          }
        }
      }
    }
  }
  
  let sourcesRegistered = 0;
  let sourcesSkipped = 0;
  if (sourceObjects.length > 0) {
    try {
      const urlToKey = await registerSources(sourceObjects);
      sourcesRegistered = urlToKey.size;
      sourcesSkipped = sourceObjects.length - urlToKey.size;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Module Import] Source registration warning:`, msg);
      // Continue with import even if source registration fails
      sourcesRegistered = 0;
      sourcesSkipped = sourceObjects.length;
    }
  }

  // Generate SHA256 hash of payload for deduplication
  const payloadString = JSON.stringify(payload, Object.keys(payload).sort());
  const importSha256 = crypto.createHash("sha256").update(payloadString).digest("hex");

  const runtimePool = getRuntimePool();
  const client = await runtimePool.connect();

  try {
    await client.query("BEGIN");

    // Check if module exists, create if needed
    const moduleCheck = await client.query(
      `SELECT module_code, status FROM public.assessment_modules WHERE module_code = $1`,
      [payload.module_code]
    );

    let moduleCode: string;
    if (!moduleCheck.rowCount || moduleCheck.rowCount === 0) {
      // Module doesn't exist - create it
      const createResult = await client.query(
        `
        INSERT INTO public.assessment_modules 
          (module_code, module_name, description, status, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'DRAFT', true, NOW(), NOW())
        RETURNING module_code
        `,
        [payload.module_code, title, payload.description ?? null]
      );
      moduleCode = createResult.rows[0].module_code as string;
    } else {
      // Module exists - update it
      const m = await client.query(
        `
        UPDATE public.assessment_modules 
        SET 
          module_name = $2, 
          description = $3, 
          is_active = true,
          updated_at = NOW()
        WHERE module_code = $1
        RETURNING module_code
        `,
        [payload.module_code, title, payload.description ?? null]
      );
      moduleCode = m.rows[0].module_code as string;
    }

    // Check if this import batch already exists
    const existingBatch = await client.query(
      `SELECT id FROM public.module_import_batches WHERE module_code = $1 AND import_sha256 = $2`,
      [moduleCode, importSha256]
    );

    let batchId: string;
    if (existingBatch.rowCount && existingBatch.rowCount > 0) {
      batchId = existingBatch.rows[0].id as string;
      // Skip import if duplicate
      await client.query("COMMIT");
      return {
        module_code: moduleCode,
        batch_id: batchId,
        module_questions_imported: moduleQuestions.length,
        module_ofcs_imported: moduleOFCs.length,
        sources_imported: uniqueSources.length,
        sources_registered: sourcesRegistered,
        sources_skipped: sourcesSkipped,
        risk_drivers_imported: riskDrivers.length,
        duplicate: true,
      };
    }

    // Create import batch record
    const batch = await client.query(
      `
      INSERT INTO public.module_import_batches 
        (module_code, import_source, import_sha256, stats, raw_payload)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        moduleCode,
        importSource,
        importSha256,
        JSON.stringify({
          questions_count: moduleQuestions.length,
          ofcs_count: moduleOFCs.length,
          sources_count: uniqueSources.length,
        }),
        payloadString,
      ]
    );

    batchId = batch.rows[0].id as string;

    // Handle module questions (REPLACE or APPEND)
    if (mode === "REPLACE") {
      const deleteQuery = `DELETE FROM public.module_questions WHERE module_code = $1`;
      guardModuleQuery(deleteQuery, 'module_import_v2: delete module_questions');
      await client.query(deleteQuery, [moduleCode]);
    }

    // Insert module questions (with required fields)
    for (const q of moduleQuestions) {
      if (!q.id || !q.text || !q.discipline_id || !q.discipline_subtype_id || !q.asset_or_location || !q.event_trigger) {
        throw new Error(`Invalid module question (missing required fields): ${JSON.stringify(q)}`);
      }
      
      // Validate discipline_id and discipline_subtype_id exist
      const disciplineCheck = await client.query(
        `SELECT id FROM public.disciplines WHERE id = $1 AND is_active = true`,
        [q.discipline_id]
      );
      if (!disciplineCheck.rowCount || disciplineCheck.rowCount === 0) {
        throw new Error(`Invalid discipline_id: ${q.discipline_id} (not found or inactive)`);
      }

      const subtypeCheck = await client.query(
        `SELECT id FROM public.discipline_subtypes WHERE id = $1 AND discipline_id = $2 AND is_active = true`,
        [q.discipline_subtype_id, q.discipline_id]
      );
      if (!subtypeCheck.rowCount || subtypeCheck.rowCount === 0) {
        throw new Error(`Invalid discipline_subtype_id: ${q.discipline_subtype_id} (not found, inactive, or does not belong to discipline ${q.discipline_id})`);
      }

      const insertQuery = `
        INSERT INTO public.module_questions 
          (module_code, module_question_id, question_text, response_enum, discipline_id, discipline_subtype_id, asset_or_location, event_trigger, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (module_code, module_question_id) 
        DO UPDATE SET 
          question_text = EXCLUDED.question_text,
          discipline_id = EXCLUDED.discipline_id,
          discipline_subtype_id = EXCLUDED.discipline_subtype_id,
          asset_or_location = EXCLUDED.asset_or_location,
          event_trigger = EXCLUDED.event_trigger,
          order_index = EXCLUDED.order_index
      `;
      guardModuleQuery(insertQuery, 'module_import_v2: insert module_questions');
      await client.query(insertQuery, [
          moduleCode,
          q.id,
          String(q.text).trim(),
          ["YES", "NO", "N_A"],
          q.discipline_id,
          q.discipline_subtype_id,
          String(q.asset_or_location).trim(),
          q.event_trigger,
          q.order,
        ]
      );
    }

    // Handle module OFCs (REPLACE or APPEND)
    // IMPORTANT: Delete sources BEFORE deleting OFCs (foreign key constraint)
    if (mode === "REPLACE") {
      // First, get all OFC IDs for this module to delete their sources
      const existingOfcs = await client.query(
        `SELECT id FROM public.module_ofcs WHERE module_code = $1`,
        [moduleCode]
      );
      
      if (existingOfcs.rowCount && existingOfcs.rowCount > 0) {
        const ofcIds = existingOfcs.rows.map((r: Record<string, unknown>) => r.id);
        await client.query(
          `DELETE FROM public.module_ofc_sources WHERE module_ofc_id = ANY($1::uuid[])`,
          [ofcIds]
        );
      }
      
      // Now delete the OFCs
      const deleteOfcsQuery = `DELETE FROM public.module_ofcs WHERE module_code = $1`;
      guardModuleQuery(deleteOfcsQuery, 'module_import_v2: delete module_ofcs');
      await client.query(deleteOfcsQuery, [moduleCode]);
    }

    // Insert module OFCs
    for (const ofc of moduleOFCs) {
      if (!ofc.ofc_id || !ofc.ofc_text) {
        throw new Error(`Invalid module OFC: ${JSON.stringify(ofc)}`);
      }
      
      // Enforce MOD_OFC_ prefix (should be caught by linter, but double-check)
      if (!ofc.ofc_id.startsWith("MOD_OFC_")) {
        throw new Error(
          `Module OFC IDs must be module-owned (MOD_OFC_*). Found: ${ofc.ofc_id}`
        );
      }
      
      // Reject IST_OFC IDs (should be caught by linter, but double-check)
      if (ofc.ofc_id.includes("IST_OFC_") || ofc.ofc_id.startsWith("IST_OFC_")) {
        throw new Error(
          `Module OFC IDs cannot use IST_OFC IDs. Found: ${ofc.ofc_id}. Use MOD_OFC_* instead.`
        );
      }
      
      const ofcInsertQuery = `
        INSERT INTO public.module_ofcs 
          (module_code, batch_id, ofc_id, ofc_num, ofc_text, order_index, source_system, source_ofc_id, source_ofc_num)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (module_code, ofc_id) 
        DO UPDATE SET 
          ofc_num = EXCLUDED.ofc_num,
          ofc_text = EXCLUDED.ofc_text,
          order_index = EXCLUDED.order_index,
          batch_id = EXCLUDED.batch_id,
          source_system = EXCLUDED.source_system,
          source_ofc_id = EXCLUDED.source_ofc_id,
          source_ofc_num = EXCLUDED.source_ofc_num
        RETURNING id
      `;
      guardModuleQuery(ofcInsertQuery, 'module_import_v2: insert module_ofcs');
      const ofcInsert = await client.query(ofcInsertQuery,
        [
          moduleCode,
          batchId,
          String(ofc.ofc_id).trim(),
          ofc.ofc_num ?? null,
          String(ofc.ofc_text).trim(),
          ofc.order_index,
          ofc.source_system ?? null,
          ofc.source_ofc_id ?? null,
          ofc.source_ofc_num ?? null,
        ]
      );

      const moduleOfcId = ofcInsert.rows[0].id as string;

      // Replace sources for this OFC deterministically
      await client.query(
        `DELETE FROM public.module_ofc_sources WHERE module_ofc_id = $1`,
        [moduleOfcId]
      );

      if (ofc.sources && Array.isArray(ofc.sources) && ofc.sources.length > 0) {
        for (const src of ofc.sources) {
          if (!src) continue;
          // Allow empty URL if label exists (for reference-only sources)
          const url = src.url ? String(src.url).trim() : "";
          const label = src.label ? String(src.label).trim() : null;
          
          // Insert source if we have either URL or label
          if (url || label) {
            await client.query(
              `
              INSERT INTO public.module_ofc_sources (module_ofc_id, source_url, source_label)
              VALUES ($1, $2, $3)
              `,
              [moduleOfcId, url || "", label],
            );
          }
        }
      }
    }

    // Insert risk drivers (optional, context only)
    if (mode === "REPLACE") {
      const deleteRiskDriversQuery = `DELETE FROM public.module_risk_drivers WHERE module_code = $1`;
      guardModuleQuery(deleteRiskDriversQuery, 'module_import_v2: delete module_risk_drivers');
      await client.query(deleteRiskDriversQuery, [moduleCode]);
    }

    for (const driver of riskDrivers) {
      const insertRiskDriverQuery = `
        INSERT INTO public.module_risk_drivers (module_code, driver_type, driver_text)
        VALUES ($1, $2, $3)
      `;
      guardModuleQuery(insertRiskDriverQuery, 'module_import_v2: insert module_risk_drivers');
      await client.query(insertRiskDriverQuery, [moduleCode, driver.driver_type, driver.driver_text.trim()]);
    }

    // Update module status to ACTIVE after successful import
    const updateStatusQuery = `
      UPDATE public.assessment_modules 
      SET status = 'ACTIVE', updated_at = NOW()
      WHERE module_code = $1
    `;
    guardModuleQuery(updateStatusQuery, 'module_import_v2: update assessment_modules status');
    await client.query(updateStatusQuery, [moduleCode]);

    await client.query("COMMIT");

    return {
      module_code: moduleCode,
      batch_id: batchId,
      module_questions_imported: moduleQuestions.length,
      module_ofcs_imported: moduleOFCs.length,
      sources_imported: uniqueSources.length,
      sources_registered: sourcesRegistered,
      sources_skipped: sourcesSkipped,
      risk_drivers_imported: riskDrivers.length,
      duplicate: false,
    };
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
