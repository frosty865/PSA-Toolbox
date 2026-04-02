/**
 * Plan section checklist: build items from extracted headings and validate count.
 * Used after Ollama plan extract or TOC-derived scaffold; persist checklist_items in module output.
 */

import { normalizeHeadingTitle } from "./headings_normalize";

export type PlanElement = { key: string; title: string; subelements?: string[] };
export type PlanChecklistItem = { id: string; text: string; subitems?: string[] };

export type PlanCapability = {
  id: string;
  text: string;
  source_id?: string;
  locator_type: "section";
  locator: string;
};

/**
 * Build checklist items from an ordered list of TOC section titles (authoritative scaffold).
 * Use when extractTocNumberedSections() returns >= 8 items so the LLM cannot omit sections.
 * Normalizes each title (strip dot leaders and page numbers) before building items.
 */
export function buildPlanChecklistFromTocTitles(titles: string[]): PlanChecklistItem[] {
  const items: PlanChecklistItem[] = [];
  for (let i = 0; i < titles.length; i++) {
    const raw = (titles[i] ?? "").trim();
    if (!raw) continue;
    const title = normalizeHeadingTitle(raw);
    if (!title) continue;
    const n = items.length + 1;
    items.push({
      id: `SEC_${String(n).padStart(2, "0")}`,
      text: `The plan includes: ${title}.`,
      subitems: undefined,
    });
  }
  return items;
}

/**
 * Build checklist items from extracted plan elements (TOC/headings).
 * Each item: "The plan includes: <title>."
 */
export function buildPlanChecklist(elements: PlanElement[]): PlanChecklistItem[] {
  const items: PlanChecklistItem[] = [];
  let n = 0;

  for (const el of elements || []) {
    const title = normalizeHeadingTitle(el.title ?? "");
    if (!title) continue;
    n += 1;

    items.push({
      id: el.key && /^[A-Za-z0-9_]+$/.test(el.key) ? el.key : `SEC_${String(n).padStart(2, "0")}`,
      text: `The plan includes: ${title}.`,
      subitems: (el.subelements ?? []).map((s) => normalizeHeadingTitle(s)).filter(Boolean),
    });
  }

  return items;
}

export function buildPlanCapabilitiesFromSections(
  sectionTitles: string[],
  topSourceLabel: string | undefined
): PlanCapability[] {
  const capabilities: PlanCapability[] = [];
  for (let i = 0; i < sectionTitles.length; i++) {
    const title = (sectionTitles[i] ?? "").trim();
    if (!title) continue;

    const normalizedTitle = title.toLowerCase();
    let capabilityText = "";

    // Special handling for "PROCEDURES FOR EVACUATION..." example
    if (normalizedTitle.includes("procedures for evacuation")) {
      capabilityText = `The facility has documented procedures for evacuation, lockdown, and shelter-in-place as part of the Emergency Action Plan.`;
    } else {
      capabilityText = `The facility has a documented Emergency Action Plan section addressing: ${normalizedTitle}.`;
    }

    capabilities.push({
      id: `CAP_${String(i + 1).padStart(2, "0")}`,
      text: capabilityText,
      source_id: topSourceLabel,
      locator_type: "section",
      locator: title, // Use original title as locator
    });
  }
  return capabilities;
}


/** Minimum sections required for a valid plan checklist (hard validation). */
export const MIN_CHECKLIST_ITEMS = 6;

/**
 * Throw if checklist has fewer than MIN_CHECKLIST_ITEMS items.
 * Do not allow gate-only success without a real section list.
 */
export function assertChecklistLooksValid(checklist: PlanChecklistItem[]): void {
  if (!checklist || checklist.length < MIN_CHECKLIST_ITEMS) {
    const err = new Error(
      `PLAN_CHECKLIST_EXTRACTION_FAILED: too few sections (${checklist?.length ?? 0}, minimum ${MIN_CHECKLIST_ITEMS} required).`
    ) as Error & { failure_reason: string; counts?: { elements: number }; hint?: string };
    err.failure_reason = "PLAN_CHECKLIST_EXTRACTION_FAILED";
    err.counts = { elements: checklist?.length ?? 0 };
    err.hint =
      "No TOC/headings detected in chunk set. Ensure sources include a table of contents or numbered section headings.";
    throw err;
  }
}
