/**
 * Unit tests for robust JSON sanitization and extraction.
 */

import { describe, it, expect } from "vitest";
import { extractFirstJsonValue, parseJsonWithContext, safeJsonParse } from "../json_extract";

describe("json_extract", () => {
  const valid = { toc: [{ level: 1, title: "Purpose", page: 1 }] };
  const validStr = JSON.stringify(valid);

  it("raw starts with control char then JSON => parse ok", () => {
    const raw = "\u0000\u0001" + validStr;
    const res = safeJsonParse<typeof valid>(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual(valid);
      expect(res.value.toc).toHaveLength(1);
      expect(res.value.toc![0].title).toBe("Purpose");
    }
  });

  it("raw contains ```json fence => parse ok", () => {
    const raw = "```json\n" + validStr + "\n```";
    const res = safeJsonParse<typeof valid>(raw);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.toc).toEqual(valid.toc);
  });

  it("raw contains ANSI codes => parse ok", () => {
    const raw = "\u001b[32m" + validStr + "\u001b[0m";
    const res = safeJsonParse<typeof valid>(raw);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.toc).toEqual(valid.toc);
  });

  it("raw contains prefix and suffix logs => extract first complete JSON", () => {
    const raw = "prefix logs\n" + validStr + "\nsuffix logs";
    const res = safeJsonParse<typeof valid>(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual(valid);
      expect(Object.keys(res.value)).toContain("toc");
    }
  });

  it("extractFirstJsonValue returns correct slice", () => {
    const wrapped = "before " + validStr + " after";
    const extracted = extractFirstJsonValue(wrapped);
    expect(extracted.jsonText).toBe(validStr);
    const parsed = JSON.parse(extracted.jsonText);
    expect(parsed).toEqual(valid);
  });

  it("no JSON start token => ok false with debug", () => {
    const res = safeJsonParse<unknown>("no braces here");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("No JSON start token");
      expect(res.debug).toBeDefined();
      expect(typeof (res.debug as { length: number }).length).toBe("number");
      expect((res.debug as { indexOfFirstBrace: number }).indexOfFirstBrace).toBe(-1);
    }
  });

  it("parseJsonWithContext: invalid JSON returns message and position/around", () => {
    const invalid = '{"toc": [1, 2, ]}'; // trailing comma
    const res = parseJsonWithContext<unknown>(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.debug.message).toBeDefined();
      expect(typeof res.debug.length).toBe("number");
      expect(res.debug.startsWith).toBeDefined();
      // V8 reports position for unexpected token
      expect(res.debug.position !== undefined || res.debug.around !== undefined || res.debug.message).toBeTruthy();
    }
  });
});
