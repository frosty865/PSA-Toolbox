/**
 * Unit tests for extractFirstJsonValue: balanced scanner, BOM, labels, markdown fences, braces in strings.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractFirstJsonValue,
  normalizeForJsonExtraction,
  debugFirstChars,
  extractionDebugInfo,
} from "../extract_json_value";

describe("extractFirstJsonValue", () => {
  it("extracts pure JSON object", () => {
    const raw = '{"a":1,"b":2}';
    const out = extractFirstJsonValue(raw);
    assert.strictEqual(out, raw);
    assert.deepStrictEqual(JSON.parse(out!), { a: 1, b: 2 });
  });

  it("extracts pure JSON array", () => {
    const raw = '[1,2,3]';
    const out = extractFirstJsonValue(raw);
    assert.strictEqual(out, raw);
    assert.deepStrictEqual(JSON.parse(out!), [1, 2, 3]);
  });

  it('extracts JSON after "Here is JSON:\\n{...}\\nThanks"', () => {
    const json = '{"items":[{"x":1}]}';
    const raw = "Here is the JSON:\n" + json + "\nThanks.";
    const out = extractFirstJsonValue(raw);
    assert.strictEqual(out, json);
    assert.deepStrictEqual(JSON.parse(out!), JSON.parse(json));
  });

  it('extracts JSON from "```json\\n{...}\\n```"', () => {
    const json = '{"items":[{"ofc":"x"}]}';
    const raw = "```json\n" + json + "\n```";
    const out = extractFirstJsonValue(raw);
    assert.strictEqual(out, json);
    assert.deepStrictEqual(JSON.parse(out!), JSON.parse(json));
  });

  it("extracts JSON with leading BOM (U+FEFF)", () => {
    const json = '{"items":[]}';
    const raw = "\uFEFF" + json;
    const out = extractFirstJsonValue(raw);
    assert.strictEqual(out, json);
    assert.deepStrictEqual(JSON.parse(out!), { items: [] });
  });

  it("JSON with braces inside strings is extracted correctly", () => {
    const json = '{"msg":"hello { world } and [ brackets ]"}';
    const out = extractFirstJsonValue(json);
    assert.strictEqual(out, json);
    assert.strictEqual(JSON.parse(out!).msg, "hello { world } and [ brackets ]");
  });

  it("nested object and array: full value extracted", () => {
    const json = '{"items":[{"a":1},{"b":2}]}';
    const out = extractFirstJsonValue(json);
    assert.strictEqual(out, json);
    const parsed = JSON.parse(out!);
    assert.strictEqual(parsed.items.length, 2);
    assert.strictEqual(parsed.items[0].a, 1);
    assert.strictEqual(parsed.items[1].b, 2);
  });

  it("returns null for empty string", () => {
    assert.strictEqual(extractFirstJsonValue(""), null);
    assert.strictEqual(extractFirstJsonValue("   "), null);
  });

  it("returns null when no brace or bracket", () => {
    assert.strictEqual(extractFirstJsonValue("no json here"), null);
    assert.strictEqual(extractFirstJsonValue("text only"), null);
  });

  it("extracts first value when both { and [ exist; takes earliest", () => {
    const raw = ' [1,2] {"a":1} ';
    const out = extractFirstJsonValue(raw);
    assert.strictEqual(out, "[1,2]");
    assert.deepStrictEqual(JSON.parse(out!), [1, 2]);
  });

  it("multiline JSON starting with { and items array (plan derive regression)", () => {
    const raw = `{
  "items": [
    { "element_key": "x", "ofc": "y", "impact": "z", "evidence_terms": null }
  ]
}`;
    assert.doesNotThrow(() => JSON.parse(raw), "raw must be valid JSON");
    const extracted = extractFirstJsonValue(raw);
    assert.ok(extracted !== null, "extractor must return non-null for clean JSON starting at 0");
    const parsed = JSON.parse(extracted!);
    assert.ok(Array.isArray(parsed.items));
    assert.strictEqual(parsed.items.length, 1);
    assert.strictEqual(parsed.items[0].element_key, "x");
    assert.strictEqual(parsed.items[0].ofc, "y");
  });
});

describe("normalizeForJsonExtraction", () => {
  it("strips BOM", () => {
    assert.strictEqual(normalizeForJsonExtraction("\uFEFF  { }  "), "{ }");
  });
  it("strips ```json ... ``` fence", () => {
    const inner = '{"x":1}';
    assert.ok(normalizeForJsonExtraction("```json\n" + inner + "\n```").includes(inner));
  });
  it("strips Here is the json prefix", () => {
    const s = normalizeForJsonExtraction("Here is the JSON:\n{\"a\":1}");
    assert.ok(s.startsWith("{"));
  });
});

describe("debugFirstChars", () => {
  it("returns first N chars with char codes", () => {
    const s = "ab";
    const out = debugFirstChars(s, 5);
    assert.ok(out.includes("a(97)"));
    assert.ok(out.includes("b(98)"));
  });
  it("exposes BOM code 65279", () => {
    const out = debugFirstChars("\uFEFF{", 5);
    assert.ok(out.includes("65279"));
  });
});

describe("extractionDebugInfo", () => {
  it("returns first40WithCodes, indexOfFirstBrace, indexOfFirstBracket, length", () => {
    const raw = "  { \"x\": 1 }";
    const info = extractionDebugInfo(raw);
    assert.strictEqual(typeof info.first40WithCodes, "string");
    assert.strictEqual(info.indexOfFirstBrace, 2);
    assert.strictEqual(info.indexOfFirstBracket, -1);
    assert.strictEqual(info.length, raw.length);
  });
});
