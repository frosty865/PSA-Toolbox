/**
 * Downgrade-mode regression: when VOFC_ALLOW_DOWNGRADE=1, base HIGH can be
 * calibrated down to LOW when operational band is LOW; reason reflects downward adjustment.
 */
import type { Assessment, VOFCCollection } from "schema";
import { describe, it, expect } from "vitest";
import { generateVOFCs } from "../generate";
import type { InjectedRule } from "../generate";
import { assessment } from "../__fixtures__/assessments/base";

const DUMMY_PATH = "";

function generateWithRules(a: Assessment, rules: InjectedRule[]): VOFCCollection {
  return generateVOFCs(a, DUMMY_PATH, { rulesOverride: rules }) as VOFCCollection;
}

describe("calibration downgrade mode", () => {
  it("calibrated stays HIGH when band is LOW and VOFC_ALLOW_DOWNGRADE is not set", () => {
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
    const rules: InjectedRule[] = [
      {
        vofc_id: "EP-99",
        category: "WATER",
        trigger_conditions: { recovery_time_gte_hours: 8 },
        title: "Mild recovery",
        vulnerability: "Recovery time is extended.",
        impact: null,
        option_for_consideration: "Plans may be reviewed.",
        base_severity: "HIGH",
      },
    ];
    const prev = process.env.VOFC_ALLOW_DOWNGRADE;
    delete process.env.VOFC_ALLOW_DOWNGRADE;
    try {
      const collection = generateWithRules(a, rules);
      expect(collection.items).toHaveLength(1);
      expect(collection.items[0].base_severity).toBe("HIGH");
      expect(collection.items[0].calibrated_severity).toBe("HIGH");
      expect(collection.items[0].calibration_reason).toBeNull();
    } finally {
      if (prev !== undefined) process.env.VOFC_ALLOW_DOWNGRADE = prev;
    }
  });

  it("calibrated becomes LOW with reason when VOFC_ALLOW_DOWNGRADE=1 and band is LOW", () => {
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
    const rules: InjectedRule[] = [
      {
        vofc_id: "EP-99",
        category: "WATER",
        trigger_conditions: { recovery_time_gte_hours: 8 },
        title: "Mild recovery",
        vulnerability: "Recovery time is extended.",
        impact: null,
        option_for_consideration: "Plans may be reviewed.",
        base_severity: "HIGH",
      },
    ];
    const prev = process.env.VOFC_ALLOW_DOWNGRADE;
    process.env.VOFC_ALLOW_DOWNGRADE = "1";
    try {
      const collection = generateWithRules(a, rules);
      expect(collection.items).toHaveLength(1);
      expect(collection.items[0].base_severity).toBe("HIGH");
      expect(collection.items[0].calibrated_severity).toBe("LOW");
      expect(collection.items[0].calibration_reason).not.toBeNull();
      expect(collection.items[0].calibration_reason).toContain("downward");
    } finally {
      if (prev !== undefined) process.env.VOFC_ALLOW_DOWNGRADE = prev;
      else delete process.env.VOFC_ALLOW_DOWNGRADE;
    }
  });
});
