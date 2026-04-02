/**
 * Module OFC template library: discipline_subtype_id → ofc_text.
 * Authoritative, capability-level, subtype-bound. No document mining.
 * If no template for a subtype, API returns NO_OFC_TEMPLATE_FOR_SUBTYPE.
 */

import * as fs from "fs";
import * as path from "path";

type TemplateRow = { discipline_subtype_id: string; ofc_text: string };

let cache: Map<string, string> | null = null;

function load(): Map<string, string> {
  if (cache) return cache;
  const p = path.join(process.cwd(), "public", "doctrine", "module_ofc_templates_v1.json");
  const raw = fs.readFileSync(p, "utf-8");
  const arr = JSON.parse(raw) as TemplateRow[];
  cache = new Map();
  for (const t of arr) {
    if (t?.discipline_subtype_id && typeof t.ofc_text === "string" && t.ofc_text.trim())
      cache.set(t.discipline_subtype_id, t.ofc_text.trim());
  }
  return cache;
}

export function getOfcTemplate(discipline_subtype_id: string): string | null {
  return load().get(discipline_subtype_id) ?? null;
}

export function hasTemplate(discipline_subtype_id: string): boolean {
  return getOfcTemplate(discipline_subtype_id) != null;
}
