/**
 * Robust extraction of first complete JSON value from child_process stdout.
 * Strips BOM, code fences, ANSI, control chars; finds balanced braces/brackets.
 */

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function stripCodeFences(s: string): string {
  const fenceStart = s.indexOf("```");
  if (fenceStart === -1) return s;
  const lastFence = s.lastIndexOf("```");
  if (lastFence !== fenceStart) {
    const inner = s.slice(fenceStart + 3, lastFence);
    const nl = inner.indexOf("\n");
    if (nl !== -1) {
      const firstLine = inner.slice(0, nl).trim().toLowerCase();
      if (firstLine === "json" || firstLine === "application/json") return inner.slice(nl + 1);
    }
    return inner;
  }
  return s;
}

function stripControlChars(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d) {
      out += s[i];
      continue;
    }
    if (c < 0x20) continue;
    out += s[i];
  }
  return out;
}

/**
 * Extract first complete JSON object or array from raw string (balanced braces).
 */
export function extractFirstJsonValue(raw: string): { jsonText: string; start: number; end: number } {
  const cleaned = stripControlChars(stripCodeFences(stripBom(raw)).replace(ANSI_RE, "")).trim();

  const iObj = cleaned.indexOf("{");
  const iArr = cleaned.indexOf("[");
  let start = -1;
  let mode: "obj" | "arr" | null = null;

  if (iObj !== -1 && (iArr === -1 || iObj < iArr)) {
    start = iObj;
    mode = "obj";
  } else if (iArr !== -1) {
    start = iArr;
    mode = "arr";
  }

  if (start === -1 || !mode) {
    throw new Error("No JSON start token found ('{' or '[').");
  }

  let depth = 0;
  let inStr = false;
  let esc = false;
  const openCh = mode === "obj" ? "{" : "[";
  const closeCh = mode === "obj" ? "}" : "]";

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }

    if (ch === '"') {
      inStr = true;
      continue;
    }

    if (ch === openCh) depth++;
    if (ch === closeCh) depth--;

    if (depth === 0) {
      const end = i + 1;
      return { jsonText: cleaned.slice(start, end), start, end };
    }
  }

  throw new Error("Unbalanced JSON braces/brackets; could not find end token.");
}

function previewVisible(s: string, n: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/**
 * Parse JSON string and surface parse error with position + snippet for debugging.
 * Use after extractFirstJsonValue when you need to see exactly where JSON is invalid.
 */
export function parseJsonWithContext<T>(jsonText: string): { ok: true; value: T } | { ok: false; error: Error; debug: Record<string, unknown> } {
  try {
    return { ok: true as const, value: JSON.parse(jsonText) as T };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    const msg = err.message ? String(err.message) : String(e);
    const m = msg.match(/position\s+(\d+)/i);
    const pos = m ? Number(m[1]) : null;

    let around: { start: number; end: number; snippet: string } | null = null;
    if (pos !== null && Number.isFinite(pos)) {
      const start = Math.max(0, pos - 120);
      const end = Math.min(jsonText.length, pos + 120);
      around = { start, end, snippet: jsonText.slice(start, end) };
    }

    return {
      ok: false as const,
      error: err instanceof Error ? err : new Error(String(err)),
      debug: {
        message: msg,
        position: pos,
        around,
        length: jsonText.length,
        startsWith: jsonText.slice(0, 40),
        endsWith: jsonText.slice(-40),
      },
    };
  }
}

/**
 * Parse raw stdout into JSON; returns ok + value or ok false with error and debug.
 */
export function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: Error; debug: Record<string, unknown> } {
  try {
    const { jsonText } = extractFirstJsonValue(raw);
    const parsed = parseJsonWithContext<T>(jsonText);
    if (!parsed.ok) return parsed;
    return { ok: true, value: parsed.value };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    const str = raw ?? "";
    const debug: Record<string, unknown> = {
      length: str.length,
      first120: previewVisible(str, 120),
      indexOfFirstBrace: str.indexOf("{"),
      indexOfFirstBracket: str.indexOf("["),
      indexOfLastBrace: str.lastIndexOf("}"),
      indexOfLastBracket: str.lastIndexOf("]"),
    };
    return { ok: false, error: err, debug };
  }
}
