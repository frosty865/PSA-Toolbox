/**
 * Normalize headings after parsing Ollama output: strip dot leaders and page numbers.
 * Apply to every element.title and each subelement string.
 */

export function stripDotLeadersAndPage(s: string): string {
  let t = (s || "").trim();
  // "TITLE.............13" -> "TITLE"
  t = t.replace(/\.+\s*\d+\s*$/g, "").trim();
  // remove trailing standalone page numbers
  t = t.replace(/\s+\d+\s*$/g, "").trim();
  t = t.replace(/\s+/g, " ");
  return t;
}

export function normalizeHeadingTitle(s: string): string {
  return stripDotLeadersAndPage(s);
}
