/**
 * EAP element post-process: enforce 2-field structure, remove duplicate echo lines,
 * strip rationale that duplicates element text. Use after element generation (Ollama or templates).
 */

export type EapElement = {
  element_text: string;
  rationale: string;
  citations?: unknown[];
};

function norm(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[.]+$/g, "")
    .replace(/\s+/g, " ");
}

/** Default rationale when provided one is empty, too short, or echoes element text. */
export const EAP_ELEMENT_FALLBACK_RATIONALE = "Supports plan activation and coordinated response actions.";

/**
 * Normalize elements: ensure element_text and rationale end with period;
 * if rationale duplicates element text or is too short, replace with fallback.
 * Preserves input length (empty element_text gets placeholder) so indices match when mapping back to items.
 */
export function postprocessEapElements(elements: EapElement[]): EapElement[] {
  const out: EapElement[] = [];
  for (const el of elements || []) {
    const et = (el.element_text || "").trim().replace(/\.+$/g, "");
    let ra = (el.rationale || "").trim().replace(/\.+$/g, "");

    if (!et) {
      out.push({
        ...el,
        element_text: "Required element.",
        rationale: EAP_ELEMENT_FALLBACK_RATIONALE.endsWith(".") ? EAP_ELEMENT_FALLBACK_RATIONALE : `${EAP_ELEMENT_FALLBACK_RATIONALE}.`,
        citations: el.citations,
      });
      continue;
    }

    if (norm(ra) === norm(et) || ra.length < 8) {
      ra = EAP_ELEMENT_FALLBACK_RATIONALE;
    }

    out.push({
      ...el,
      element_text: et.endsWith(".") ? et : et + ".",
      rationale: ra.endsWith(".") ? ra : ra + ".",
      citations: el.citations,
    });
  }
  return out;
}

/**
 * Map checklist-style items (text, rationale) to EapElement and back.
 * Use when wiring into PLAN generator items.
 */
export function itemsToEapElements(
  items: Array<{ text?: string; rationale?: string }>
): EapElement[] {
  return items.map((i) => ({
    element_text: (i.text ?? "").trim(),
    rationale: (i.rationale ?? "").trim(),
  }));
}

export function eapElementsToItems(
  elements: EapElement[]
): Array<{ text: string; rationale: string }> {
  return elements.map((e) => ({
    text: e.element_text,
    rationale: e.rationale,
  }));
}
