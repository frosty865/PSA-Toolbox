import { describe, it, expect } from "vitest";
import { stableStringify } from "./stableStringify";

describe("stableStringify", () => {
  it("sorts object keys recursively", () => {
    const obj = { z: 1, a: 2, m: 3 };
    expect(stableStringify(obj)).toBe(
      '{\n  "a": 2,\n  "m": 3,\n  "z": 1\n}\n'
    );
  });

  it("preserves array order", () => {
    const obj = { arr: [3, 1, 2] };
    const out = stableStringify(obj);
    expect(out).toContain('"arr":');
    const parsed = JSON.parse(out) as { arr: number[] };
    expect(parsed.arr).toEqual([3, 1, 2]);
    expect(out.endsWith("\n")).toBe(true);
  });

  it("pretty-prints with 2-space indentation", () => {
    const obj = { a: { b: 1 } };
    expect(stableStringify(obj)).toBe(
      '{\n  "a": {\n    "b": 1\n  }\n}\n'
    );
  });

  it("ensures newline at end of output", () => {
    const obj = { x: 1 };
    const out = stableStringify(obj);
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toBe('{\n  "x": 1\n}\n');
  });

  it("handles null and primitives", () => {
    expect(stableStringify(null)).toBe("null\n");
    expect(stableStringify(42)).toBe("42\n");
    expect(stableStringify("hi")).toBe('"hi"\n');
    expect(stableStringify(true)).toBe("true\n");
  });

  it("nested objects have sorted keys", () => {
    const obj = { outer: { z: 0, a: 1 }, first: 2 };
    expect(stableStringify(obj)).toBe(
      '{\n  "first": 2,\n  "outer": {\n    "a": 1,\n    "z": 0\n  }\n}\n'
    );
  });
});
