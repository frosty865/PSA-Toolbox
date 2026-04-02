/**
 * Robust JSON extraction from model output (prose, markdown, or strict JSON).
 * Use when the model may return text before/after the JSON object.
 * Delegates to extractFirstJsonValue for balanced brace/bracket scanning (handles nested [] and {}).
 */

import { extractFirstJsonValue } from "./extract_json_value";

/**
 * @deprecated Use extractFirstJsonValue from extract_json_value.ts (stack-based, handles nested [] and {}).
 */
export function extractFirstJsonObject(raw: string): string | null {
  return extractFirstJsonValue(raw);
}

/**
 * If the string contains a markdown fenced code block (```json ... ``` or ``` ... ```), return the inner content.
 * Otherwise return the original string.
 */
export function unwrapMarkdownCodeBlock(raw: string): string {
  const match = raw.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (match?.[1] != null) return match[1].trim();
  return raw;
}

/**
 * Parse raw model output: try direct parse, then extract first balanced JSON (object or array) via extractFirstJsonValue.
 * Accepts top-level arrays and objects. Resilient to BOM, leading labels, markdown fences.
 * @throws Error if no valid JSON object or array found.
 */
export function parseJsonWithExtraction<T = unknown>(raw: string): T {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) throw new Error("No JSON object or array found in model output");

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // extract first balanced JSON value (handles nested {} and [], BOM, fences, prefixes)
  }

  const first = extractFirstJsonValue(trimmed);
  if (!first) throw new Error("No JSON object or array found in model output");
  try {
    return JSON.parse(first) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No JSON object or array found in model output: ${msg}`);
  }
}
