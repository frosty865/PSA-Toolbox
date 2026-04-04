import { describe, it, expect } from "vitest";
import { assertMAPCompliance } from "./map_guard";
import type { VOFCCollection } from "schema";

function collection(items: VOFCCollection["items"]): VOFCCollection {
  return {
    generated_at_iso: new Date().toISOString(),
    tool_version: "0.1.0",
    items: items ?? [],
  };
}

function vofc(overrides: Partial<VOFCCollection["items"][0]> = {}): VOFCCollection["items"][0] {
  return {
    vofc_id: "EP-01",
    category: "ELECTRIC_POWER",
    title: "No backup",
    vulnerability: "Backup was not identified.",
    impact: null,
    option_for_consideration: "Options may be evaluated.",
    base_severity: "HIGH",
    calibrated_severity: "HIGH",
    calibration_reason: null,
    applicability: "CONFIRMED",
    origin: "GENERATED",
    ...overrides,
  };
}

describe("assertMAPCompliance", () => {
  it("passes for valid collection with one VOFC", () => {
    expect(() => assertMAPCompliance(collection([vofc()]))).not.toThrow();
  });

  it("passes for empty collection", () => {
    expect(() => assertMAPCompliance(collection([]))).not.toThrow();
  });

  it("throws when category has more than 4 VOFCs", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      vofc({ vofc_id: `W-${i + 1}`, category: "WATER" })
    );
    expect(() => assertMAPCompliance(collection(items))).toThrow(/MAP compliance failed/);
    expect(() => assertMAPCompliance(collection(items))).toThrow(/max 4/);
  });

  it("throws when applicability is missing", () => {
    const c = collection([vofc({ applicability: "" as "CONFIRMED" })]);
    expect(() => assertMAPCompliance(c)).toThrow(/missing applicability/);
  });

  it("throws when applicability is invalid", () => {
    const c = collection([vofc({ applicability: "UNKNOWN" as "CONFIRMED" })]);
    expect(() => assertMAPCompliance(c)).toThrow(/invalid applicability/);
  });

  it("throws when base_severity is invalid", () => {
    const c = collection([vofc({ base_severity: "CRITICAL" as "HIGH", calibrated_severity: "HIGH" })]);
    expect(() => assertMAPCompliance(c)).toThrow(/invalid base_severity/);
  });

  it("throws when category is invalid", () => {
    const c = collection([vofc({ category: "INVALID_CAT" as "ELECTRIC_POWER" })]);
    expect(() => assertMAPCompliance(c)).toThrow(/invalid category/);
  });

  it("throws when forbidden language present (GENERATED)", () => {
    const c = collection([
      vofc({ origin: "GENERATED", option_for_consideration: "You must install backup." }),
    ]);
    expect(() => assertMAPCompliance(c)).toThrow(/forbidden language/);
    expect(() => assertMAPCompliance(c)).toThrow(/must/);
  });

  it("passes when SOURCE-origin contains directive verb", () => {
    const c = collection([
      vofc({ origin: "SOURCE", option_for_consideration: "Install backup per guidance." }),
    ]);
    expect(() => assertMAPCompliance(c)).not.toThrow();
  });

  it("aggregates multiple violations into one error", () => {
    const c = collection([
      vofc({
        applicability: "" as "CONFIRMED",
        base_severity: "CRITICAL" as "HIGH",
        calibrated_severity: "HIGH",
      }),
      vofc({ category: "BAD" as "ELECTRIC_POWER" }),
    ]);
    expect(() => assertMAPCompliance(c)).toThrow(/MAP compliance failed/);
    const err = new Error();
    try {
      assertMAPCompliance(c);
    } catch (e) {
      err.message = (e as Error).message;
    }
    expect(err.message).toMatch(/missing applicability/);
    expect(err.message).toMatch(/invalid base_severity/);
    expect(err.message).toMatch(/invalid category/);
  });
});
