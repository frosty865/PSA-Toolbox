/**
 * Create a module_ofcs row from OFC template. Used by POST /api/admin/modules/[moduleCode]/ofcs.
 * Template-driven: discipline_subtype_id → ofc_text from module_ofc_templates_v1. No freeform ofc_text.
 */

import type { Pool } from "pg";
import { isUuid } from "@/app/lib/api/reqId";
import { getOfcTemplate } from "@/app/lib/doctrine/moduleOfcTemplates";

const MODULE_CODE_RE = /^MODULE_[A-Z0-9_]+$/;

export type CreateOfcBody = {
  discipline_subtype_id: string;
  source_url?: string;
  source_label?: string;
  subtype_code?: unknown;
  ofc_text?: unknown;
};

export type CreateOfcResult = { ofc_id: string; id: string; order_index: number };

export async function createModuleOfc(
  pool: Pool,
  moduleCode: string,
  body: CreateOfcBody
): Promise<CreateOfcResult> {
  const normalized = decodeURIComponent(moduleCode).trim();
  if (!normalized.startsWith("MODULE_") || !MODULE_CODE_RE.test(normalized)) {
    throw { message: "Invalid module_code", code: "INVALID_MODULE_CODE", details: { moduleCode: normalized } };
  }

  if (body.subtype_code !== undefined && body.subtype_code !== null) {
    throw { message: "Use discipline_subtype_id", code: "SUBTYPE_CODE_NOT_ALLOWED" };
  }
  if (body.ofc_text !== undefined && body.ofc_text !== null) {
    throw { message: "ofc_text is template-driven; do not send ofc_text", code: "OFC_TEXT_NOT_ALLOWED" };
  }

  if (!body.discipline_subtype_id || !isUuid(body.discipline_subtype_id)) {
    throw { message: "discipline_subtype_id must be a valid UUID", code: "VALIDATION_ERROR", details: { field: "discipline_subtype_id" } };
  }

  const ofc_text = getOfcTemplate(body.discipline_subtype_id);
  if (!ofc_text) {
    throw { message: "No OFC template exists for this discipline_subtype_id yet.", code: "NO_OFC_TEMPLATE_FOR_SUBTYPE", details: { discipline_subtype_id: body.discipline_subtype_id } };
  }

  const mod = await pool.query(`SELECT 1 FROM public.assessment_modules WHERE module_code = $1`, [normalized]);
  if (!mod.rowCount) {
    throw { message: "Module not found", code: "MODULE_NOT_FOUND", details: { moduleCode: normalized } };
  }

  const suffix = normalized.replace(/^MODULE_/, "");
  const existing = await pool.query(
    `SELECT ofc_id FROM public.module_ofcs WHERE module_code = $1 ORDER BY ofc_id DESC LIMIT 1`,
    [normalized]
  );
  let seq = 1;
  if (existing.rows?.length) {
    const m = (existing.rows[0].ofc_id as string).match(/_(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  const ofc_id = `MOD_OFC_${suffix}_${String(seq).padStart(3, "0")}`;

  const orderRes = await pool.query(
    `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM public.module_ofcs WHERE module_code = $1`,
    [normalized]
  );
  const order_index = parseInt(String(orderRes.rows[0]?.next_idx ?? 0), 10);

  const ins = await pool.query(
    `INSERT INTO public.module_ofcs (module_code, ofc_id, ofc_text, order_index, discipline_subtype_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [normalized, ofc_id, ofc_text, order_index, body.discipline_subtype_id]
  );
  const id = ins.rows[0]?.id as string;

  const url = (body.source_url != null && typeof body.source_url === "string") ? body.source_url.trim() : "";
  const label = (body.source_label != null && typeof body.source_label === "string") ? body.source_label.trim() : null;
  if (id && (url || label)) {
    await pool.query(
      `INSERT INTO public.module_ofc_sources (module_ofc_id, source_url, source_label) VALUES ($1, $2, $3)`,
      [id, url || "", label]
    );
  }

  return { ofc_id, id, order_index };
}
