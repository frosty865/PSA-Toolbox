import { describe, it, expect } from "vitest";
import { generateVOFCsFromEntries } from "./generate";
import type { Assessment } from "schema";
import type { InternalVofcEntry } from "./library";

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    meta: { tool_version: "0.1.0", template_version: "1", created_at_iso: new Date().toISOString() },
    asset: { asset_name: "Test", visit_date_iso: "2025-01-01" },
    categories: {},
    ...overrides,
  };
}

function entry(e: Partial<InternalVofcEntry> & { vofc_id: string; category: InternalVofcEntry["category"]; vulnerability: string; option_for_consideration: string }): InternalVofcEntry {
  return {
    title: "",
    impact: null,
    severity: "MODERATE",
    applicability: "POTENTIAL",
    trigger_conditions: {},
    origin: "SOURCE",
    ...e,
  };
}

describe("generateVOFCs", () => {
  it("Electric Power with no backup: includes VOFC when has_backup=false matches", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-01",
        category: "ELECTRIC_POWER",
        title: "No backup power",
        vulnerability: "Facility relies on single source.",
        option_for_consideration: "Consider backup options.",
        severity: "HIGH",
        applicability: "CONFIRMED",
        trigger_conditions: { requires_service: true, has_backup: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vofc_id).toBe("EP-01");
    expect(result.items[0].category).toBe("ELECTRIC_POWER");
    expect(result.items[0].applicability).toBe("CONFIRMED");
  });

  it("Electric Power with no backup: excludes VOFC when has_backup does not match", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: true,
          backup_duration_hours: 24,
          loss_fraction_with_backup: 0.2,
          recovery_time_hours: 24,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-01",
        category: "ELECTRIC_POWER",
        title: "No backup",
        vulnerability: "No backup.",
        option_for_consideration: "Consider backup.",
        trigger_conditions: { has_backup: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(0);
  });

  it("Water with long recovery: includes VOFC when recovery_time_gte_hours matches", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 6,
          loss_fraction_no_backup: 0.4,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 72,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "W-01",
        category: "WATER",
        title: "Long recovery",
        vulnerability: "Recovery time is extended.",
        option_for_consideration: "Review recovery plans.",
        severity: "MODERATE",
        applicability: "POTENTIAL",
        trigger_conditions: { recovery_time_gte_hours: 48 },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vofc_id).toBe("W-01");
    expect(result.items[0].category).toBe("WATER");
    expect(result.items[0].applicability).toBe("CONFIRMED");
  });

  it("Water with short recovery: excludes VOFC when recovery_time_gte_hours not met", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 6,
          loss_fraction_no_backup: 0.4,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "W-01",
        category: "WATER",
        title: "Long recovery",
        vulnerability: "Recovery extended.",
        option_for_consideration: "Review plans.",
        trigger_conditions: { recovery_time_gte_hours: 48 },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(0);
  });

  it("Critical Products single-source dependency: includes VOFC when critical_product_single_source matches", () => {
    const a = assessment({
      categories: {
        CRITICAL_PRODUCTS: {
          requires_service: true,
          time_to_impact_hours: 0,
          loss_fraction_no_backup: 0.3,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
          critical_product_single_source: true,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "CP-03",
        category: "CRITICAL_PRODUCTS",
        title: "Single source dependency",
        vulnerability: "Critical product has single source.",
        option_for_consideration: "Consider diversifying supply.",
        severity: "HIGH",
        applicability: "CONFIRMED",
        trigger_conditions: { critical_product_single_source: true },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vofc_id).toBe("CP-03");
    expect(result.items[0].category).toBe("CRITICAL_PRODUCTS");
  });

  it("requires_service=false and category !== CRITICAL_PRODUCTS: does not generate for that category", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: false,
          time_to_impact_hours: 0,
          loss_fraction_no_backup: 0,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 0,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-02",
        category: "ELECTRIC_POWER",
        title: "Any",
        vulnerability: "Vuln.",
        option_for_consideration: "Option.",
        trigger_conditions: { requires_service: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(0);
  });

  it("deduplicates by vofc_id (first match wins)", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 0,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 48,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({ vofc_id: "W-A", category: "WATER", vulnerability: "V1", option_for_consideration: "O1", severity: "LOW", trigger_conditions: { has_backup: false } }),
      entry({ vofc_id: "W-A", category: "WATER", vulnerability: "V2", option_for_consideration: "O2", severity: "HIGH", trigger_conditions: { has_backup: false } }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vofc_id).toBe("W-A");
    expect(result.items[0].base_severity).toBe("LOW");
  });

  it("caps at 4 VOFCs per category (drops lowest priority)", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 0,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    });
    const lib = (id: string, severity: "HIGH" | "MODERATE" | "LOW") =>
      entry({
        vofc_id: id,
        category: "WATER",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "Options may be evaluated.",
        severity,
        trigger_conditions: { has_backup: false },
      });
    const library: InternalVofcEntry[] = [
      lib("W-1", "HIGH"),
      lib("W-2", "HIGH"),
      lib("W-3", "MODERATE"),
      lib("W-4", "MODERATE"),
      lib("W-5", "LOW"),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(4);
    const ids = result.items.map((i) => i.vofc_id).sort();
    expect(ids).toEqual(["W-1", "W-2", "W-3", "W-4"]);
    expect(result.items.find((i) => i.vofc_id === "W-5")).toBeUndefined();
  });

  it("MAP ordering: CONFIRMED outranks POTENTIAL when severity is equal", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 96,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-P",
        category: "ELECTRIC_POWER",
        title: "Potential",
        vulnerability: "Recovery time is extended.",
        option_for_consideration: "Plans may be reviewed.",
        severity: "MODERATE",
        trigger_conditions: { has_backup: false, recovery_time_gte_hours: 72 },
      }),
      entry({
        vofc_id: "EP-C",
        category: "ELECTRIC_POWER",
        title: "Confirmed",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "Backup may be evaluated.",
        severity: "MODERATE",
        trigger_conditions: { has_backup: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].vofc_id).toBe("EP-C");
    expect(result.items[0].applicability).toBe("CONFIRMED");
    expect(result.items[1].vofc_id).toBe("EP-P");
    expect(result.items[1].applicability).toBe("POTENTIAL");
  });

  it("fails generation when VOFC text fails normalization", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-01",
        category: "ELECTRIC_POWER",
        title: "No backup",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "You must install a backup.",
        severity: "HIGH",
        trigger_conditions: { has_backup: false },
        origin: "GENERATED",
      }),
    ];
    expect(() => generateVOFCsFromEntries(a, library)).toThrow(/normalization failed|forbidden language/i);
  });

  it("excludes out-of-scope entries (e.g. access control) so review is only by assessment observations", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 12,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-AC",
        category: "ELECTRIC_POWER",
        title: "Access control",
        vulnerability: "The facility has limited or no access control policies/procedures for employees.",
        option_for_consideration: "Install access control systems.",
        severity: "HIGH",
        trigger_conditions: { has_backup: false },
      }),
      entry({
        vofc_id: "EP-BU",
        category: "ELECTRIC_POWER",
        title: "No backup",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "Evaluate backup options.",
        severity: "MODERATE",
        trigger_conditions: { has_backup: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vofc_id).toBe("EP-BU");
    expect(result.items[0].vulnerability).toBe("Backup was not identified.");
  });

  it("MAP ordering: calibrated_severity wins first; CONFIRMED before POTENTIAL when tied", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 6,
          loss_fraction_no_backup: 0.5,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 96,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "W-HP",
        category: "WATER",
        title: "High potential",
        vulnerability: "Recovery time is extended.",
        option_for_consideration: "Plans may be reviewed.",
        severity: "HIGH",
        trigger_conditions: { has_backup: false, recovery_time_gte_hours: 72 },
      }),
      entry({
        vofc_id: "W-MC",
        category: "WATER",
        title: "Moderate confirmed",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "Backup may be evaluated.",
        severity: "MODERATE",
        trigger_conditions: { has_backup: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].base_severity).toBe("MODERATE");
    expect(result.items[0].calibrated_severity).toBe("HIGH");
    expect(result.items[0].vofc_id).toBe("W-MC");
    expect(result.items[0].applicability).toBe("CONFIRMED");
    expect(result.items[1].vofc_id).toBe("W-HP");
    expect(result.items[1].calibrated_severity).toBe("HIGH");
  });

  it("calibration: escalation when no backup + short time-to-impact", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: {
          requires_service: true,
          time_to_impact_hours: 2,
          loss_fraction_no_backup: 0.6,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 48,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "EP-01",
        category: "ELECTRIC_POWER",
        title: "No backup",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "Options may be evaluated.",
        severity: "LOW",
        trigger_conditions: { has_backup: false },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].base_severity).toBe("LOW");
    expect(result.items[0].calibrated_severity).toBe("HIGH");
    expect(result.items[0].calibration_reason).toContain("Escalated");
  });

  it("calibration: no downgrade by default when band lower than base", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 24,
          loss_fraction_no_backup: 0.1,
          has_backup: true,
          backup_duration_hours: 24,
          loss_fraction_with_backup: 0.05,
          recovery_time_hours: 12,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "W-01",
        category: "WATER",
        title: "Long recovery",
        vulnerability: "Recovery time is extended.",
        option_for_consideration: "Plans may be reviewed.",
        severity: "HIGH",
        trigger_conditions: { recovery_time_gte_hours: 8 },
      }),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].base_severity).toBe("HIGH");
    expect(result.items[0].calibrated_severity).toBe("HIGH");
    expect(result.items[0].calibration_reason).toBeNull();
  });

  it("calibration: downgrade only when VOFC_ALLOW_DOWNGRADE=1", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 24,
          loss_fraction_no_backup: 0.1,
          has_backup: true,
          backup_duration_hours: 24,
          loss_fraction_with_backup: 0.05,
          recovery_time_hours: 12,
        },
      },
    });
    const library: InternalVofcEntry[] = [
      entry({
        vofc_id: "W-01",
        category: "WATER",
        title: "Long recovery",
        vulnerability: "Recovery time is extended.",
        option_for_consideration: "Plans may be reviewed.",
        severity: "HIGH",
        trigger_conditions: { recovery_time_gte_hours: 8 },
      }),
    ];
    const prev = process.env.VOFC_ALLOW_DOWNGRADE;
    process.env.VOFC_ALLOW_DOWNGRADE = "1";
    try {
      const result = generateVOFCsFromEntries(a, library);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].base_severity).toBe("HIGH");
      expect(result.items[0].calibrated_severity).toBe("LOW");
      expect(result.items[0].calibration_reason).toContain("Adjusted downward");
    } finally {
      if (prev !== undefined) process.env.VOFC_ALLOW_DOWNGRADE = prev;
      else delete process.env.VOFC_ALLOW_DOWNGRADE;
    }
  });

  it("cap applies after calibration sort", () => {
    const a = assessment({
      categories: {
        WATER: {
          requires_service: true,
          time_to_impact_hours: 2,
          loss_fraction_no_backup: 0.6,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 96,
        },
      },
    });
    const lib = (id: string, baseSev: "HIGH" | "MODERATE" | "LOW") =>
      entry({
        vofc_id: id,
        category: "WATER",
        vulnerability: "Backup was not identified.",
        option_for_consideration: "Options may be evaluated.",
        severity: baseSev,
        trigger_conditions: { has_backup: false },
      });
    const library: InternalVofcEntry[] = [
      lib("W-1", "HIGH"),
      lib("W-2", "HIGH"),
      lib("W-3", "MODERATE"),
      lib("W-4", "MODERATE"),
      lib("W-5", "LOW"),
    ];
    const result = generateVOFCsFromEntries(a, library);
    expect(result.items).toHaveLength(4);
    const ids = result.items.map((i) => i.vofc_id).sort();
    expect(ids).toEqual(["W-1", "W-2", "W-3", "W-4"]);
  });
});
