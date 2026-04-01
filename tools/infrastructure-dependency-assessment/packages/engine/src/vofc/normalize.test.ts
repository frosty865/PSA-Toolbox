import { describe, it, expect } from "vitest";
import { normalizeVOFC } from "./normalize";
import type { VOFC } from "schema";

function vofc(overrides: Partial<VOFC> = {}): VOFC {
  return {
    vofc_id: "EP-01",
    category: "ELECTRIC_POWER",
    title: "No backup power",
    vulnerability: "Backup was not identified.",
    impact: null,
    option_for_consideration: "Backup options may be evaluated.",
    base_severity: "HIGH",
    calibrated_severity: "HIGH",
    calibration_reason: null,
    applicability: "CONFIRMED",
    origin: "GENERATED",
    ...overrides,
  };
}

describe("normalizeVOFC", () => {
  it("valid neutral VOFC passes and is trimmed/normalized", () => {
    const input = vofc({
      vulnerability: "  Dependency is not documented.  ",
      option_for_consideration: "Redundancy could be evaluated.",
    });
    const result = normalizeVOFC(input);
    expect(result.vulnerability).toBe("Dependency is not documented.");
    expect(result.option_for_consideration).toBe("Redundancy could be evaluated.");
    expect(result.title).toBe("No backup power");
  });

  it("collapses double spaces and normalizes punctuation", () => {
    const input = vofc({
      vulnerability: "Single  source   is  not  documented.",
      option_for_consideration: "Options  may  be  considered.",
    });
    const result = normalizeVOFC(input);
    expect(result.vulnerability).toBe("Single source is not documented.");
    expect(result.option_for_consideration).toBe("Options may be considered.");
  });

  it("auto-fixes 'should consider' to 'may consider'", () => {
    const input = vofc({
      option_for_consideration: "Backup should consider alternative sources.",
    });
    const result = normalizeVOFC(input);
    expect(result.option_for_consideration).toBe(
      "Backup may consider alternative sources."
    );
  });

  it("auto-fixes 'recommended' to 'identified as an option for consideration'", () => {
    const input = vofc({
      option_for_consideration: "Redundancy was recommended in the review.",
    });
    const result = normalizeVOFC(input);
    expect(result.option_for_consideration).toContain(
      "identified as an option for consideration"
    );
    expect(result.option_for_consideration).not.toMatch(/\brecommended\b/i);
  });

  it("prescriptive VOFC fails: forbidden 'must'", () => {
    const input = vofc({
      option_for_consideration: "Backup must be implemented.",
    });
    expect(() => normalizeVOFC(input)).toThrow(
      /forbidden language.*must/i
    );
  });

  it("prescriptive VOFC fails: forbidden 'should' (not auto-fixed)", () => {
    const input = vofc({
      vulnerability: "Backup should be documented.",
    });
    expect(() => normalizeVOFC(input)).toThrow(
      /forbidden language.*should/i
    );
  });

  it("prescriptive VOFC fails: forbidden 'cost'", () => {
    const input = vofc({
      option_for_consideration: "Cost of redundancy may be evaluated.",
    });
    expect(() => normalizeVOFC(input)).toThrow(
      /forbidden language.*cost/i
    );
  });

  it("prescriptive VOFC fails: forbidden 'vendor'", () => {
    const input = vofc({
      title: "Vendor dependency",
      vulnerability: "Single vendor is not documented.",
    });
    expect(() => normalizeVOFC(input)).toThrow(
      /forbidden language.*vendor/i
    );
  });

  it("vulnerability with conditional 'may consider' fails", () => {
    const input = vofc({
      vulnerability: "Backup may consider alternative supply.",
      option_for_consideration: "Options could be evaluated.",
    });
    expect(() => normalizeVOFC(input)).toThrow(
      /vulnerability must be factual/i
    );
  });

  it("does not modify VOFC meaning: ids and metadata unchanged", () => {
    const input = vofc({
      vofc_id: "CP-02",
      category: "CRITICAL_PRODUCTS",
      base_severity: "LOW",
      calibrated_severity: "LOW",
      applicability: "POTENTIAL",
      source_ref: "lib-v1",
    });
    const result = normalizeVOFC(input);
    expect(result.vofc_id).toBe("CP-02");
    expect(result.category).toBe("CRITICAL_PRODUCTS");
    expect(result.base_severity).toBe("LOW");
    expect(result.calibrated_severity).toBe("LOW");
    expect(result.applicability).toBe("POTENTIAL");
    expect(result.source_ref).toBe("lib-v1");
  });

  it("normalizes impact when present", () => {
    const input = vofc({
      impact: "  Service  interruption  possible.  ",
    });
    const result = normalizeVOFC(input);
    expect(result.impact).toBe("Service interruption possible.");
  });

  it("SOURCE-origin: sanitizes text but does not apply forbidden-language check", () => {
    const input = vofc({
      origin: "SOURCE",
      option_for_consideration: "  Install backup generator per agency guidance.  ",
    });
    const result = normalizeVOFC(input);
    expect(result.option_for_consideration).toBe("Install backup generator per agency guidance.");
    expect(result.origin).toBe("SOURCE");
  });
});
