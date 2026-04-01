import { describe, it, expect } from "vitest";
import { assertExportReady, REQUIRED_ANCHORS } from "./export_guard";
import { buildSummary } from "../summary";
import { generateVOFCsFromEntries } from "../vofc/generate";
import type { Assessment } from "schema";
import type { InternalVofcEntry } from "../vofc/library";
import { assessment } from "../vofc/__fixtures__/assessments/base";

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

describe("assertExportReady", () => {
  it("passes when assessment has all 6 categories, summary has 6 rows, vofcs valid, anchors provided", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: { requires_service: true, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        COMMUNICATIONS: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        INFORMATION_TECHNOLOGY: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        WATER: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        WASTEWATER: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        CRITICAL_PRODUCTS: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
      },
    });
    const summary = buildSummary(a);
    const vofcs = generateVOFCsFromEntries(a, [entry({ vofc_id: "X", category: "ELECTRIC_POWER", vulnerability: "V", option_for_consideration: "O" })]);
    expect(() => assertExportReady({ assessment: a, summary, vofcs, requiredAnchors: [...REQUIRED_ANCHORS] })).not.toThrow();
  });

  it("throws when summary has fewer than 6 rows", () => {
    const a = assessment({ categories: { ELECTRIC_POWER: { requires_service: true, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 } } });
    const summary = buildSummary(a);
    const vofcs = generateVOFCsFromEntries(a, []);
    expect(() => assertExportReady({ assessment: a, summary, vofcs, requiredAnchors: [...REQUIRED_ANCHORS] })).toThrow(/Summary must have exactly one row per supported category/);
  });

  it("throws when requiredAnchors is empty", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: { requires_service: true, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        COMMUNICATIONS: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        INFORMATION_TECHNOLOGY: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        WATER: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        WASTEWATER: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
        CRITICAL_PRODUCTS: { requires_service: false, time_to_impact_hours: 0, loss_fraction_no_backup: 0, has_backup: false, backup_duration_hours: null, loss_fraction_with_backup: null, recovery_time_hours: 0 },
      },
    });
    const summary = buildSummary(a);
    const vofcs = generateVOFCsFromEntries(a, []);
    expect(() => assertExportReady({ assessment: a, summary, vofcs, requiredAnchors: [] })).toThrow(/requiredAnchors must be non-empty/);
  });
});
