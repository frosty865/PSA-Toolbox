/**
 * Create a module_questions row. Used by POST /api/admin/modules/[moduleCode]/questions.
 * Validates required fields, rejects subtype_code, uses discipline_subtype_id (UUID) only.
 */

import type { Pool } from "pg";
import { isUuid } from "@/app/lib/api/reqId";

const MODULE_CODE_RE = /^MODULE_[A-Z0-9_]+$/;
const EVENT_TRIGGERS = ["FIRE", "TAMPERING", "IMPACT", "OUTAGE", "OTHER"] as const;

export type CreateQuestionBody = {
  question_text: string;
  discipline_id: string;
  discipline_subtype_id: string;
  asset_or_location: string;
  event_trigger?: string;
  subtype_code?: unknown;
};

export type CreateQuestionResult = { module_question_id: string; order_index: number };

export type ValidationError = { message: string; code: string; details?: Record<string, unknown> };

export async function createModuleQuestion(
  pool: Pool,
  moduleCode: string,
  body: CreateQuestionBody
): Promise<CreateQuestionResult> {
  const normalized = decodeURIComponent(moduleCode).trim();
  if (!normalized.startsWith("MODULE_") || !MODULE_CODE_RE.test(normalized)) {
    throw { message: "Invalid module_code", code: "INVALID_MODULE_CODE", details: { moduleCode: normalized } };
  }

  if (body.subtype_code !== undefined && body.subtype_code !== null) {
    throw { message: "Use discipline_subtype_id", code: "SUBTYPE_CODE_NOT_ALLOWED" };
  }

  const q = (body.question_text != null && typeof body.question_text === "string") ? body.question_text.trim() : "";
  if (!q) throw { message: "question_text is required", code: "VALIDATION_ERROR", details: { field: "question_text" } };

  if (!isUuid(body.discipline_id)) {
    throw { message: "discipline_id must be a valid UUID", code: "VALIDATION_ERROR", details: { field: "discipline_id" } };
  }
  if (!isUuid(body.discipline_subtype_id)) {
    throw { message: "discipline_subtype_id must be a valid UUID", code: "VALIDATION_ERROR", details: { field: "discipline_subtype_id" } };
  }

  const asset = (body.asset_or_location != null && typeof body.asset_or_location === "string") ? body.asset_or_location.trim() : "";
  if (!asset) throw { message: "asset_or_location is required", code: "VALIDATION_ERROR", details: { field: "asset_or_location" } };

  const et = body.event_trigger && typeof body.event_trigger === "string" && EVENT_TRIGGERS.includes(body.event_trigger.toUpperCase() as typeof EVENT_TRIGGERS[number])
    ? body.event_trigger.toUpperCase()
    : "OTHER";

  const mod = await pool.query(`SELECT 1 FROM public.assessment_modules WHERE module_code = $1`, [normalized]);
  if (!mod.rowCount) {
    throw { message: "Module not found", code: "MODULE_NOT_FOUND", details: { moduleCode: normalized } };
  }

  const suffix = normalized.replace(/^MODULE_/, "");
  const existing = await pool.query(
    `SELECT module_question_id FROM public.module_questions WHERE module_code = $1 ORDER BY module_question_id DESC LIMIT 1`,
    [normalized]
  );
  let seq = 1;
  if (existing.rows?.length) {
    const m = (existing.rows[0].module_question_id as string).match(/_(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  const module_question_id = `MODULEQ_${suffix}_${String(seq).padStart(3, "0")}`;

  const orderRes = await pool.query(
    `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM public.module_questions WHERE module_code = $1`,
    [normalized]
  );
  const order_index = parseInt(String(orderRes.rows[0]?.next_idx ?? 0), 10);

  await pool.query(
    `INSERT INTO public.module_questions
      (module_code, module_question_id, question_text, discipline_id, discipline_subtype_id, asset_or_location, event_trigger, order_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [normalized, module_question_id, q, body.discipline_id, body.discipline_subtype_id, asset, et, order_index]
  );

  return { module_question_id, order_index };
}
