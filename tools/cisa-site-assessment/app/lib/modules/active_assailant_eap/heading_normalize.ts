/**
 * Deterministic cleanup of headings/sublabels after parsing Ollama output.
 * Removes dot leaders and trailing page numbers; normalizes spacing.
 */

export function normalizeHeadingTitle(s: string): string {
  let t = (s || "").trim();

  // Remove dot leaders and trailing page numbers: "TITLE...........13" -> "TITLE"
  t = t.replace(/\.+\s*\d+\s*$/g, "").trim();

  t = t.replace(/\s+/g, " ");

  return t;
}

export function normalizeSublabel(s: string): string {
  let t = (s || "").trim();
  t = t.replace(/\.+\s*\d+\s*$/g, "").trim();
  t = t.replace(/\s+/g, " ");
  return t;
}
