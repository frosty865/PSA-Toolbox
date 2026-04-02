/**
 * Normalize locator strings for citations. Never outputs "?".
 * Used by chunk export so packets get concrete page/range values.
 */

export type LocatorType = "page" | "row" | "other";

export interface NormalizedLocator {
  locator_type: LocatorType;
  locator: string;
}

/**
 * Parse page-like raw strings into a single page or range.
 * Accepts: "p.14", "14", "14-15", "pp. 14-15", "p.14-15".
 * Returns null if unparseable (so caller can count as missing).
 */
export function normalizeLocator(params: {
  locator_type: string;
  raw: string | number | null | undefined;
}): NormalizedLocator | null {
  const { locator_type, raw } = params;
  const _type = (String(locator_type || "page").toLowerCase().replace("pdf_page", "page") || "page") as LocatorType;
  void _type;
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "" || s === "?" || s.toLowerCase() === "p.?") return null;

  // Already a number or simple range
  const simpleNum = /^\d+$/.exec(s);
  if (simpleNum) return { locator_type: "page", locator: simpleNum[0] };

  const simpleRange = /^(\d+)\s*-\s*(\d+)$/.exec(s);
  if (simpleRange) {
    const a = parseInt(simpleRange[1], 10);
    const b = parseInt(simpleRange[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && a <= b)
      return { locator_type: "page", locator: `${a}-${b}` };
    return null;
  }

  // p.14, p. 14, pp.14-15, pp. 14-15, p.14-15
  const prefixed = /^(?:p\.?|pp\.?)\s*(\d+)(?:\s*-\s*(\d+))?$/i.exec(s);
  if (prefixed) {
    const start = parseInt(prefixed[1], 10);
    if (!Number.isFinite(start)) return null;
    const end = prefixed[2] ? parseInt(prefixed[2], 10) : null;
    if (end != null) {
      if (Number.isFinite(end) && start <= end) return { locator_type: "page", locator: `${start}-${end}` };
      return null;
    }
    return { locator_type: "page", locator: String(start) };
  }

  // Fallback: any string that looks like digits (with optional range)
  const anyPage = /(\d+)(?:\s*-\s*(\d+))?/.exec(s);
  if (anyPage) {
    const start = parseInt(anyPage[1], 10);
    if (!Number.isFinite(start)) return null;
    const end = anyPage[2] ? parseInt(anyPage[2], 10) : null;
    if (end != null && Number.isFinite(end) && start <= end)
      return { locator_type: "page", locator: `${start}-${end}` };
    return { locator_type: "page", locator: String(start) };
  }

  return null;
}

/**
 * Normalize from DB locator JSON (e.g. { type, page_start, page_end, page }).
 * Prefer page_start/page_end then page then fallbackRaw.
 */
export function normalizeLocatorFromJson(params: {
  locatorJson: { type?: string; page?: number; page_start?: number; page_end?: number } | null | undefined;
  fallbackRaw?: string | number | null;
}): NormalizedLocator | null {
  const { locatorJson, fallbackRaw } = params;
  if (locatorJson && typeof locatorJson === "object") {
    const _type = (String(locatorJson.type || "page").toLowerCase().replace("pdf_page", "page") || "page") as LocatorType;
    void _type;
    const start = locatorJson.page_start ?? locatorJson.page;
    const end = locatorJson.page_end;
    if (start != null && Number.isFinite(start)) {
      if (end != null && Number.isFinite(end) && start <= end)
        return { locator_type: "page", locator: `${start}-${end}` };
      return { locator_type: "page", locator: String(start) };
    }
  }
  return normalizeLocator({ locator_type: "page", raw: fallbackRaw ?? null });
}
