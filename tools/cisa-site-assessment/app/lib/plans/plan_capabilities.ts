/**
 * PLAN capability: existence-based statement derived from TOC sections.
 * Doctrine: A PLAN capability asserts whether a facility has a documented, maintained,
 * and applicable plan component addressing a specific functional area. Answerable YES/NO/N/A.
 * One section → one capability (1:1). No cadence, implementation steps, or object-based content.
 */

/** Single vital element attached to a capability (bullet/subheading). Always present on capability; default []. */
export interface PlanVitalElement {
  id: string;
  text: string;
  locator_type: "bullet" | "heading" | "numbered" | "prompt" | "toc_subsection";
  locator: string;
  source_id?: string;
  source_label?: string | null;
}

/** @deprecated Use PlanVitalElement for new code. Kept for backward compat (vital_title). */
export interface PlanCapabilityVital {
  vital_title: string;
  locator_type: "toc_subsection" | "heading" | "template_bullet" | "bullet" | "numbered" | "prompt";
  locator: string;
  marker?: string;
  parent_locator?: string;
}

export interface PlanCapability {
  id: string;
  text: string;
  source_id?: string;
  locator_type: "section";
  locator: string;
  capability_title: string;
  capability_statement: string;
  source_label?: string | null;
  /** Vital elements (bullets/subheadings) for this section. Never omit; use [] when none. */
  vital_elements: PlanVitalElement[];
  /** Derived; same as vital_elements.length. */
  vital_elements_count: number;
}

/**
 * Light normalization for capability text: trim, collapse whitespace, lowercase.
 * No paraphrase beyond grammatical normalization.
 */
function normalizeSectionForCapability(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Build one capability statement per section using a fixed template.
 * Template: "The facility has a documented Emergency Action Plan section addressing: <normalized section title>."
 * 1:1 mapping; deterministic and reproducible.
 */
export function buildPlanCapabilitiesFromSections(
  sections: string[],
  options?: { topSourceId?: string; topSourceLabel?: string }
): PlanCapability[] {
  const capabilities: PlanCapability[] = [];
  const source_id = options?.topSourceId ?? options?.topSourceLabel;

  for (let i = 0; i < sections.length; i++) {
    const exactTitle = (sections[i] ?? "").trim();
    if (!exactTitle) continue;
    const normalized = normalizeSectionForCapability(exactTitle);
    if (!normalized) continue;

    const n = capabilities.length + 1;
    const id = `PLAN_CAP_${String(n).padStart(2, "0")}`;
    const text = `The facility has a documented Emergency Action Plan section addressing: ${normalized}.`;

    capabilities.push({
      id,
      text,
      ...(source_id ? { source_id } : {}),
      locator_type: "section",
      locator: exactTitle,
      capability_title: exactTitle,
      capability_statement: text,
      source_label: options?.topSourceLabel ?? null,
      vital_elements: [],
      vital_elements_count: 0,
    });
  }

  return capabilities;
}

/** TocSection from toc_parser groupTocBySection. */
export interface TocSectionForCapability {
  key: string;
  title: string;
  vitals: Array<{ key: string; title: string }>;
}

/** Vital from vital_elements_extractor (multi-detector) or TOC Level-2. */
export type VitalElementFromBody = {
  title: string;
  kind?: "bullet" | "numbered" | "prompt" | "subheading";
  locator_type: "heading" | "template_bullet" | "bullet" | "numbered" | "prompt";
  locator: string;
  marker?: string;
};

/**
 * Build plan capabilities from grouped TOC. One capability per section. vital_elements come from vitalsPerSection (body-derived) when provided, else from TOC Level-2 (sec.vitals).
 */
export function buildPlanCapabilitiesFromToc(
  tocGrouped: { sections: TocSectionForCapability[] },
  options?: {
    topSourceId?: string;
    topSourceLabel?: string;
    /** When set, use these body-extracted vitals per section (by index) instead of TOC Level-2. */
    vitalsPerSection?: VitalElementFromBody[][];
  }
): PlanCapability[] {
  const capabilities: PlanCapability[] = [];
  const source_id = options?.topSourceId ?? options?.topSourceLabel;
  const vitalsPerSection = options?.vitalsPerSection ?? null;

  for (let i = 0; i < tocGrouped.sections.length; i++) {
    const sec = tocGrouped.sections[i];
    const exactTitle = (sec?.title ?? "").trim();
    if (!exactTitle) continue;
    const normalized = normalizeSectionForCapability(exactTitle);
    if (!normalized) continue;

    const n = capabilities.length + 1;
    const id = `PLAN_CAP_${String(n).padStart(2, "0")}`;
    const text = `The facility has a documented Emergency Action Plan section addressing: ${normalized}.`;

    let vital_elements: PlanVitalElement[];
    if (vitalsPerSection != null && vitalsPerSection[i] != null && vitalsPerSection[i].length > 0) {
      vital_elements = vitalsPerSection[i].map((v, idx) => ({
        id: `${id}_VE_${String(idx + 1).padStart(2, "0")}`,
        text: (v as { title?: string; text?: string }).title ?? (v as { title?: string; text?: string }).text ?? v.locator ?? "",
        locator_type: (v.locator_type === "template_bullet" ? "bullet" : v.locator_type) as PlanVitalElement["locator_type"],
        locator: v.locator ?? (v as { title?: string }).title ?? "",
        source_id: typeof source_id === "string" ? source_id : undefined,
        source_label: options?.topSourceLabel ?? null,
      }));
    } else {
      vital_elements = (sec.vitals ?? []).map((v, idx) => ({
        id: `${id}_VE_${String(idx + 1).padStart(2, "0")}`,
        text: v.title,
        locator_type: "toc_subsection" as const,
        locator: `${v.key} ${v.title}`,
        source_id: typeof source_id === "string" ? source_id : undefined,
        source_label: options?.topSourceLabel ?? null,
      }));
    }

    const vital_elements_count = vital_elements.length;

    capabilities.push({
      id,
      text,
      ...(source_id ? { source_id } : {}),
      locator_type: "section",
      locator: exactTitle,
      capability_title: exactTitle,
      capability_statement: text,
      source_label: options?.topSourceLabel ?? null,
      vital_elements,
      vital_elements_count,
    });
  }

  return capabilities;
}
