/**
 * Stable hash over normalized plan schema for regression detection.
 * Excludes excerpts, locators, confidence, timestamps.
 */

import { createHash } from "crypto";
import type { PlanSchemaSnapshot } from "./types";

function normalizeForHash(snapshot: PlanSchemaSnapshot): string {
  const payload = snapshot.sections.map((sec) => ({
    section_ord: sec.section_ord,
    section_key: sec.section_key,
    section_title: sec.section_title,
    elements: sec.elements.map((el) => ({
      element_ord: el.element_ord,
      element_key: el.element_key,
      element_label: el.element_label,
      is_core: el.is_core,
    })),
  }));
  return JSON.stringify(payload);
}

export function planSchemaHash(snapshot: PlanSchemaSnapshot): string {
  return createHash("sha256").update(normalizeForHash(snapshot), "utf8").digest("hex");
}
