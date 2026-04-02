#!/usr/bin/env node
/**
 * Module Question + Module OFC creation regression. Self-contained, deterministic.
 * Run: npx tsx scripts/tests/moduleCreateAutomation.test.ts
 *
 * Prerequisites (test asserts or creates):
 * - RUNTIME_DATABASE_URL (required; exit 1 if missing)
 * - module_ofcs.discipline_subtype_id column (migration 20260125; exit 1 if missing)
 * - assessment_modules row for MODULE_CREATE_TEST_MODULE (upserted if missing)
 * - discipline_subtypes row with code SFO_GUARD_POSTS (exit 1 if missing)
 *
 * Asserts: POST module question (201 + created id); POST module OFC (201 + id OR 400
 * NO_OFC_TEMPLATE_FOR_SUBTYPE with message and request_id); SUBTYPE_CODE_NOT_ALLOWED;
 * NO_OFC_TEMPLATE_FOR_SUBTYPE for unknown subtype. Cleanup: deletes created
 * module_questions and module_ofcs; does not delete the test module row.
 */

import { ensureRuntimePoolConnected } from "../../app/lib/db/runtime_client";
import { createModuleQuestion } from "../../app/lib/admin/createModuleQuestion";
import { createModuleOfc } from "../../app/lib/admin/createModuleOfc";
import { loadEnvLocal } from "../../app/lib/db/load_env_local";

const MODULE_CODE = "MODULE_CREATE_TEST_MODULE";
const SUBTYPE_CODE_WITH_TEMPLATE = "SFO_GUARD_POSTS";
const NO_TEMPLATE_UUID = "00000000-0000-4000-8000-000000000001";

let failed = 0;

async function ok(name: string, fn: () => void | Promise<void>) {
  try {
    await Promise.resolve(fn());
    console.log(`  OK: ${name}`);
  } catch (e) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

async function main() {
  loadEnvLocal(process.cwd());

  if (!process.env.RUNTIME_DATABASE_URL) {
    console.error("Set RUNTIME_DATABASE_URL (PostgreSQL connection string for runtime DB).");
    process.exit(1);
  }

  console.log("moduleCreateAutomation (self-contained)\n");

  let pool: Awaited<ReturnType<typeof ensureRuntimePoolConnected>>;
  try {
    pool = await ensureRuntimePoolConnected();
  } catch (e) {
    console.error(`  FAIL: ensureRuntimePoolConnected — ${(e as Error).message}`);
    process.exit(1);
  }

  const col = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_ofcs' AND column_name = 'discipline_subtype_id'`
  );
  if (!col.rowCount) {
    console.error("Missing column module_ofcs.discipline_subtype_id. Apply migration db/migrations/20260125_module_ofcs_discipline_subtype_id.sql");
    process.exit(1);
  }

  const mod = await pool.query(`SELECT 1 FROM public.assessment_modules WHERE module_code = $1`, [MODULE_CODE]);
  if (!mod.rowCount) {
    await pool.query(
      `INSERT INTO public.assessment_modules (module_code, module_name) VALUES ($1, $2)`,
      [MODULE_CODE, "Module Create Test Fixture"]
    );
  }

  const st = await pool.query<{ id: string; discipline_id: string }>(
    `SELECT id, discipline_id FROM public.discipline_subtypes WHERE code = $1 AND (is_active IS NULL OR is_active = true) LIMIT 1`,
    [SUBTYPE_CODE_WITH_TEMPLATE]
  );
  if (!st.rowCount) {
    console.error(`discipline_subtypes row with code ${SUBTYPE_CODE_WITH_TEMPLATE} not found. Ensure runtime taxonomy is seeded.`);
    process.exit(1);
  }
  const subtypeId = st.rows[0].id;
  const disciplineId = st.rows[0].discipline_id;

  let createdQuestionId: string | null = null;
  let createdOfcId: string | null = null;

  await ok("POST module question → 201 and created id", async () => {
    const out = await createModuleQuestion(pool, MODULE_CODE, {
      question_text: "Regression: Are guard post controls in place for EV parking area in the event of FIRE?",
      discipline_id: disciplineId,
      discipline_subtype_id: subtypeId,
      asset_or_location: "EV parking area",
      event_trigger: "FIRE",
    });
    if (!out?.module_question_id) throw new Error("createModuleQuestion did not return module_question_id");
    createdQuestionId = out.module_question_id;
    const row = await pool.query(
      `SELECT 1 FROM public.module_questions WHERE module_code = $1 AND module_question_id = $2`,
      [MODULE_CODE, out.module_question_id]
    );
    if (!row.rowCount) throw new Error("module_questions row missing after create");
  });

  await ok("POST module OFC (subtype with template) → 201 and created id", async () => {
    const out = await createModuleOfc(pool, MODULE_CODE, { discipline_subtype_id: subtypeId });
    if (!out?.id) throw new Error("createModuleOfc did not return id");
    createdOfcId = out.id;
    const row = await pool.query(`SELECT 1 FROM public.module_ofcs WHERE id = $1`, [out.id]);
    if (!row.rowCount) throw new Error("module_ofcs row missing after create");
  });

  await ok("POST module OFC (no template) → structured 400 NO_OFC_TEMPLATE_FOR_SUBTYPE", async () => {
    try {
      await createModuleOfc(pool, MODULE_CODE, { discipline_subtype_id: NO_TEMPLATE_UUID });
      throw new Error("expected createModuleOfc to throw");
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== "NO_OFC_TEMPLATE_FOR_SUBTYPE") throw new Error(`expected code NO_OFC_TEMPLATE_FOR_SUBTYPE, got ${err?.code}`);
      if (!err?.message || typeof err.message !== "string") throw new Error("expected message present");
    }
  });

  await ok("POST module question with subtype_code → SUBTYPE_CODE_NOT_ALLOWED", async () => {
    try {
      await createModuleQuestion(pool, MODULE_CODE, {
        question_text: "X?",
        discipline_id: disciplineId,
        discipline_subtype_id: subtypeId,
        asset_or_location: "EV parking",
        subtype_code: SUBTYPE_CODE_WITH_TEMPLATE,
      });
      throw new Error("expected createModuleQuestion to throw");
    } catch (e: unknown) {
      const c = (e as { code?: string }).code;
      if (c !== "SUBTYPE_CODE_NOT_ALLOWED") throw new Error(`expected code SUBTYPE_CODE_NOT_ALLOWED, got ${c}`);
    }
  });

  if (createdQuestionId) {
    await pool.query(`DELETE FROM public.module_questions WHERE module_code = $1 AND module_question_id = $2`, [MODULE_CODE, createdQuestionId]);
  }
  if (createdOfcId) {
    await pool.query(`DELETE FROM public.module_ofcs WHERE id = $1`, [createdOfcId]);
  }

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll tests passed.");
  process.exit(0);
}

main();
