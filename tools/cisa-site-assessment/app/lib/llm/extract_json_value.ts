/**
 * Extract the first complete JSON value (object or array) from raw text using balanced-brace/bracket scanning.
 * Resilient to: leading BOM, whitespace, labels ("Here is the JSON:"), markdown fences, trailing text.
 * Handles strings and escape sequences so "}" or "]" inside a string do not end the value.
 */

const BOM = "\uFEFF";

/**
 * Optional pre-pass: strip BOM, common leading labels, and markdown code fences.
 * The balanced scanner works without this; use to improve robustness.
 */
export function normalizeForJsonExtraction(raw: string): string {
  let s = (raw ?? "").trim();
  if (s.startsWith(BOM)) s = s.slice(BOM.length).trim();
  // Strip markdown fences (```json ... ``` or ``` ... ```)
  const fenceMatch = s.match(/^```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch?.[1] != null) s = fenceMatch[1].trim();
  // Strip common prefixes (case-insensitive, optional)
  const prefixRe = /^(?:here is the json|json:|output:)\s*:?\s*\n?/i;
  s = s.replace(prefixRe, "").trim();
  return s;
}

/**
 * Find the first complete JSON object or array by scanning from the first '{' or '['.
 * Tracks stack of expected closing tokens; respects string boundaries and escapes.
 * Returns the substring from start index through the matching closing brace/bracket, or null.
 */
export function extractFirstJsonValue(text: string): string | null {
  const raw = text ?? "";
  const normalized = normalizeForJsonExtraction(raw);
  const idxObj = normalized.indexOf("{");
  const idxArr = normalized.indexOf("[");

  let startIndex: number;
  let openChar: string;
  if (idxObj < 0 && idxArr < 0) return null;
  if (idxArr < 0) {
    startIndex = idxObj;
    openChar = "{";
  } else if (idxObj < 0) {
    startIndex = idxArr;
    openChar = "[";
  } else {
    startIndex = Math.min(idxObj, idxArr);
    openChar = normalized[startIndex];
  }

  const slice = normalized.slice(startIndex);
  const result = extractBalancedWithStack(slice, openChar);
  return result;
}

/**
 * From a string that starts with openChar ('{' or '['), scan until the matching closing char.
 * Uses a stack so nested {} and [] are handled correctly.
 */
function extractBalancedWithStack(raw: string, _openChar: string): string | null {
  const stack: string[] = [];

  let inString = false;
  let escapeNext = false;
  let quoteChar = "";

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === "\\") {
        escapeNext = true;
        continue;
      }
      if (ch === quoteChar) {
        inString = false;
        continue;
      }
      continue;
    }

    // JSON only uses double-quoted strings; single-quote must not toggle (e.g. "it's" in value)
    if (ch === '"') {
      inString = true;
      quoteChar = '"';
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (stack.length === 0) return null;
      const expected = stack.pop();
      if (ch !== expected) return null;
      if (stack.length === 0) return raw.slice(0, i + 1);
    }
  }

  return null;
}

/**
 * Debug helper: first N characters with char codes (exposes BOM, hidden spaces).
 */
export function debugFirstChars(raw: string, n = 40): string {
  const s = (raw ?? "").slice(0, n);
  return Array.from(s)
    .map((c) => `${c}(${c.charCodeAt(0)})`)
    .join(" ");
}

/**
 * Debug info for failed extraction (safe to include in API response).
 */
export function extractionDebugInfo(raw: string): {
  first40WithCodes: string;
  indexOfFirstBrace: number;
  indexOfFirstBracket: number;
  length: number;
} {
  const s = raw ?? "";
  return {
    first40WithCodes: debugFirstChars(s, 40),
    indexOfFirstBrace: s.indexOf("{"),
    indexOfFirstBracket: s.indexOf("["),
    length: s.length,
  };
}
