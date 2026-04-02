/**
 * Module Import Library
 * 
 * Validates and imports module definitions including:
 * - Module metadata (code, name, description)
 * - Question associations (canon_ids)
 * - Curated OFCs with sources
 * - Source registration in source_registry (CORPUS)
 */

import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { registerSources } from "./source_registration";
import {
  detectRiskDrivers,
  inferModuleQuestions,
  filterCyberFraudControls,
  type InferredQuestion,
  type DetectedDriver,
} from "./module_question_infer";

export type CuratedOFC = {
  ofc_id: string;
  ofc_num?: number | null;
  ofc_text: string;
  source_urls?: string[];
  source_labels?: (string | null)[];
};

export type BaselineReference = {
  baseline_canon_id: string;
  note?: string | null;
};

export type Vulnerability = {
  vulnerability?: string;
  possible_impact?: string;
  options_for_consideration?: Array<{ option?: string; reference?: string }>;
};

export type ModuleImportPayload = {
  module_code: string;
  title: string; // Maps to module_name in DB
  description?: string | null;
  questions?: string[]; // module-specific question IDs (must NOT start with "BASE-")
  baseline_references?: BaselineReference[]; // informational only, non-answerable
  vulnerabilities?: Vulnerability[]; // For convergence bridge inference
  curated_ofcs?: CuratedOFC[];
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

export async function importModule(payload: ModuleImportPayload) {
  assertModuleCode(payload.module_code);

  const title = (payload.title || "").trim();
  if (!title) {
    throw new Error("title required");
  }

  const questions = Array.from(
    new Set((payload.questions || []).map((s) => (s || "").trim()).filter(Boolean))
  );

  // AUTHORITATIVE RULE: Reject any question starting with "BASE-"
  const baselineQuestions = questions.filter((q) => q.startsWith("BASE-"));
  if (baselineQuestions.length > 0) {
    throw new Error(
      `Modules cannot attach baseline questions. Use baseline_references instead. Found: ${baselineQuestions.slice(0, 5).join(", ")}${
        baselineQuestions.length > 5 ? "…" : ""
      }`
    );
  }

  // Validate baseline_references exist in baseline_spines_runtime
  const runtimePool = getRuntimePool();
  const baselineRefs = payload.baseline_references || [];
  if (baselineRefs.length > 0) {
    const refCanonIds = baselineRefs.map((ref) => ref.baseline_canon_id.trim()).filter(Boolean);
    const refCheck = await runtimePool.query(
      `SELECT canon_id FROM public.baseline_spines_runtime WHERE canon_id = ANY($1::text[]) AND active = true`,
      [refCanonIds]
    );
    const found = new Set(refCheck.rows.map((r: Record<string, unknown>) => r.canon_id as string));
    const missing = refCanonIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new Error(
        `Unknown baseline_canon_id(s) in baseline_references: ${missing.slice(0, 10).join(", ")}${
          missing.length > 10 ? "…" : ""
        }`
      );
    }
  }

  const client = await runtimePool.connect();
  try {
    await client.query("BEGIN");

    // Upsert module (using module_code as primary key)
    const m = await client.query(
      `
      INSERT INTO public.assessment_modules (module_code, module_name, description, is_active, updated_at)
      VALUES ($1, $2, $3, true, NOW())
      ON CONFLICT (module_code)
      DO UPDATE SET 
        module_name = EXCLUDED.module_name, 
        description = EXCLUDED.description, 
        is_active = true,
        updated_at = NOW()
      RETURNING module_code
      `,
      [payload.module_code, title, payload.description ?? null]
    );

    const moduleCode = m.rows[0].module_code as string;

    // Replace module-question links deterministically (only if module-specific questions provided)
    await client.query(
      `DELETE FROM public.assessment_module_questions WHERE module_code = $1`,
      [moduleCode]
    );

    // Insert module-specific questions in provided order
    if (questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        await client.query(
          `
          INSERT INTO public.assessment_module_questions (module_code, question_canon_id, question_order)
          VALUES ($1, $2, $3)
          `,
          [moduleCode, questions[i], i + 1]
        );
      }
    }

    // Replace baseline references deterministically
    await client.query(
      `DELETE FROM public.module_baseline_references WHERE module_code = $1`,
      [moduleCode]
    );

    // Insert baseline references (informational only)
    if (baselineRefs.length > 0) {
      for (const ref of baselineRefs) {
        const canonId = ref.baseline_canon_id.trim();
        if (!canonId) continue;
        await client.query(
          `
          INSERT INTO public.module_baseline_references (module_code, baseline_canon_id, note)
          VALUES ($1, $2, $3)
          `,
          [moduleCode, canonId, ref.note?.trim() || null]
        );
      }
    }

    // Convergence Bridge Inference: Detect drivers and infer PSA-scope questions
    const vulnerabilities = payload.vulnerabilities || [];
    let detectedDrivers: DetectedDriver[] = [];
    let inferredQuestions: InferredQuestion[] = [];
    let filteredControlsCount = 0;

    if (vulnerabilities.length > 0) {
      // Collect all text for driver detection
      const allVulnerabilityText = vulnerabilities
        .map((v) => [
          v.vulnerability || "",
          v.possible_impact || "",
          ...(v.options_for_consideration || []).map((o) => o.option || ""),
        ])
        .join(" ");

      // Detect risk drivers
      detectedDrivers = detectRiskDrivers(allVulnerabilityText);

      // Filter out cyber/fraud controls from options
      for (const vuln of vulnerabilities) {
        const options = vuln.options_for_consideration || [];
        const { filteredCount } = filterCyberFraudControls(options);
        filteredControlsCount += filteredCount;
      }

      // Infer module questions if drivers detected
      if (detectedDrivers.length > 0) {
        inferredQuestions = inferModuleQuestions(
          moduleCode,
          vulnerabilities,
          detectedDrivers
        );
      }
    }

    // Store detected risk drivers (context only)
    await client.query(
      `DELETE FROM public.module_risk_drivers WHERE module_code = $1`,
      [moduleCode]
    );

    if (detectedDrivers.length > 0) {
      for (const driver of detectedDrivers) {
        await client.query(
          `
          INSERT INTO public.module_risk_drivers (module_code, driver_type, driver_text)
          VALUES ($1, $2, $3)
          `,
          [moduleCode, driver.driver_type, driver.driver_text]
        );
      }
    }

    // Store inferred module questions
    await client.query(
      `DELETE FROM public.module_questions WHERE module_code = $1`,
      [moduleCode]
    );

    if (inferredQuestions.length > 0) {
      for (const q of inferredQuestions) {
        await client.query(
          `
          INSERT INTO public.module_questions (module_code, module_question_id, question_text, question_intent, question_order)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            moduleCode,
            q.module_question_id,
            q.question_text,
            q.question_intent,
            q.question_order,
          ]
        );
      }
    }

    // Curated OFCs (optional)
    const curated = payload.curated_ofcs || [];
    
    // Collect all unique sources from all OFCs for batch registration
    const allSources: Array<{ url: string; label?: string | null }> = [];
    for (const o of curated) {
      const urls = o.source_urls || [];
      const labels = o.source_labels || [];
      for (let k = 0; k < urls.length; k++) {
        const u = (urls[k] || "").trim();
        if (u) {
          allSources.push({
            url: u,
            label: labels[k] ?? null,
          });
        }
      }
    }
    
    // Register all sources in source_registry (CORPUS) - happens BEFORE transaction
    // This is best-effort and won't fail the import if source registration fails
    let sourceKeyMap = new Map<string, string>();
    let sourcesRegistered = 0;
    let sourcesSkipped = 0;
    try {
      sourceKeyMap = await registerSources(allSources);
      // Count how many were actually registered (map size = unique URLs registered)
      sourcesRegistered = sourceKeyMap.size;
      sourcesSkipped = allSources.length - sourcesRegistered;
      
      // Count new vs existing (would need to track this in registerSources)
      // For now, we'll just report total registered
    } catch (sourceError: unknown) {
      const msg = sourceError instanceof Error ? sourceError.message : String(sourceError);
      console.warn(
        `[Module Import] Source registration failed (continuing import):`,
        msg
      );
    }
    
    // Now insert OFCs and link sources
    for (const o of curated) {
      const ofcId = (o.ofc_id || "").trim();
      const ofcText = (o.ofc_text || "").trim();
      if (!ofcId || !ofcText) {
        continue;
      }

      const ins = await client.query(
        `
        INSERT INTO public.module_curated_ofcs (module_code, ofc_id, ofc_num, ofc_text)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (module_code, ofc_id)
        DO UPDATE SET 
          ofc_num = EXCLUDED.ofc_num, 
          ofc_text = EXCLUDED.ofc_text
        RETURNING id
        `,
        [moduleCode, ofcId, o.ofc_num ?? null, ofcText]
      );

      const moduleOfcId = ins.rows[0].id as string;

      // Replace sources for this OFC deterministically
      await client.query(
        `DELETE FROM public.module_curated_ofc_sources WHERE module_curated_ofc_id = $1`,
        [moduleOfcId]
      );

      const urls = o.source_urls || [];
      const labels = o.source_labels || [];
      for (let k = 0; k < urls.length; k++) {
        const u = (urls[k] || "").trim();
        if (!u) {
          continue;
        }
        const lbl = labels[k] ?? null;
        await client.query(
          `
          INSERT INTO public.module_curated_ofc_sources (module_curated_ofc_id, source_url, source_label)
          VALUES ($1, $2, $3)
          `,
          [moduleOfcId, u, typeof lbl === "string" ? lbl.trim() : null]
        );
      }
    }

    await client.query("COMMIT");

    return {
      module_code: moduleCode,
      questions: questions.length,
      baseline_references: baselineRefs.length,
      inferred_questions_count: inferredQuestions.length,
      risk_drivers_count_by_type: {
        CYBER_DRIVER: detectedDrivers.filter((d) => d.driver_type === "CYBER_DRIVER").length,
        FRAUD_DRIVER: detectedDrivers.filter((d) => d.driver_type === "FRAUD_DRIVER").length,
      },
      filtered_out_controls_count: filteredControlsCount,
      curated_ofcs: curated.length,
      sources_total: allSources.length,
      sources_registered: sourcesRegistered,
      sources_skipped: sourcesSkipped,
    };
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
