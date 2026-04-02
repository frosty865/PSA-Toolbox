/**
 * Canonical types for schema-first plan pipeline (TOC-preferred, stored schema).
 */

export type PlanDeriveMethod = "TOC" | "HEADINGS" | "LEGACY";
export type PlanConfidence = "HIGH" | "MEDIUM" | "LOW";

export type PlanSourceLocator = {
  locator_type: "pdf_page" | "pdf_outline" | "unknown";
  locator: string | null;
  page_range: string | null;
};

export type PlanSchemaElement = {
  element_key: string;
  element_label: string;
  element_ord: number;
  is_core: boolean;
  source_excerpt?: string | null;
  source_locator?: PlanSourceLocator | null;
};

export type PlanSchemaSection = {
  section_key: string;
  section_title: string;
  section_ord: number;
  source_locator?: PlanSourceLocator | null;
  elements: PlanSchemaElement[];
};

export type PlanSchemaSnapshot = {
  module_code: string;
  structure_source_registry_id: string;
  derive_method: PlanDeriveMethod;
  confidence: PlanConfidence;
  sections: PlanSchemaSection[];
};
