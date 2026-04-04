/**
 * VOFC calibration regression: golden snapshots over deterministic fixtures.
 * Fails on drift in trigger matching, applicability, normalization, calibration, ordering, cap.
 */
import type { Assessment, VOFCCollection } from "schema";
import { describe, it, expect } from "vitest";
import { generateVOFCs } from "../generate";
import type { InjectedRule } from "../generate";
import { stableStringify } from "../../testutils/stableStringify";
import { freezeCollectionMeta } from "../../testutils/freezeMeta";
import { MINIMAL_VOFC_RULES, MINIMAL_VOFC_RULES_WITH_EP_EXTRA } from "../__fixtures__/rules_minimal";
import { MAX_VOFC_PER_CATEGORY } from "../map_doctrine";
import {
  epNoBackupShortTtiHighLoss,
  waterLongRecovery,
  commBackupShortDuration,
  criticalProductsSingleSource,
  capFourPerCategory,
  requiresServiceFalseSkip,
} from "../__fixtures__/assessments";

const DUMMY_PATH = "";

function generateWithRules(assessment: Assessment, rules: InjectedRule[]): VOFCCollection {
  return generateVOFCs(assessment, DUMMY_PATH, { rulesOverride: rules }) as VOFCCollection;
}

function assertCalibrationIntegrity(collection: { items: Array<{ vofc_id: string; base_severity: string; calibrated_severity: string; calibration_reason: string | null; category: string }> }) {
  for (const v of collection.items) {
    if (v.calibrated_severity !== v.base_severity && v.calibration_reason == null) {
      throw new Error(`vofc_id=${v.vofc_id}: calibrated !== base but null calibration_reason`);
    }
    if (v.calibrated_severity === v.base_severity && v.calibration_reason != null) {
      throw new Error(`vofc_id=${v.vofc_id}: base === calibrated but non-null calibration_reason`);
    }
  }
  const byCategory = new Map<string, number>();
  for (const v of collection.items) {
    byCategory.set(v.category, (byCategory.get(v.category) ?? 0) + 1);
  }
  for (const [cat, count] of byCategory) {
    if (count > MAX_VOFC_PER_CATEGORY) {
      throw new Error(`Category ${cat} has ${count} items, cap is ${MAX_VOFC_PER_CATEGORY}`);
    }
  }
}

describe("calibration regression", () => {
  it("ep_no_backup_short_tti_high_loss: EP-01/02/03 matched, calibration and ordering", () => {
    const collection = generateWithRules(
      epNoBackupShortTtiHighLoss,
      MINIMAL_VOFC_RULES.filter((r) => r.category === "ELECTRIC_POWER" && r.vofc_id !== "BAD-01")
    );
    const frozen = freezeCollectionMeta(collection);
    assertCalibrationIntegrity(frozen);
    expect(stableStringify(frozen)).toMatchSnapshot();
  });

  it("water_long_recovery: W-01 escalated to HIGH", () => {
    const collection = generateWithRules(waterLongRecovery, MINIMAL_VOFC_RULES.filter((r) => r.category === "WATER"));
    const frozen = freezeCollectionMeta(collection);
    assertCalibrationIntegrity(frozen);
    expect(stableStringify(frozen)).toMatchSnapshot();
  });

  it("comm_backup_short_duration: COM-01 matched", () => {
    const collection = generateWithRules(commBackupShortDuration, MINIMAL_VOFC_RULES.filter((r) => r.category === "COMMUNICATIONS"));
    const frozen = freezeCollectionMeta(collection);
    assertCalibrationIntegrity(frozen);
    expect(stableStringify(frozen)).toMatchSnapshot();
  });

  it("critical_products_single_source: CP-01 matched", () => {
    const collection = generateWithRules(criticalProductsSingleSource, MINIMAL_VOFC_RULES.filter((r) => r.category === "CRITICAL_PRODUCTS"));
    const frozen = freezeCollectionMeta(collection);
    assertCalibrationIntegrity(frozen);
    expect(stableStringify(frozen)).toMatchSnapshot();
  });

  it("cap_four_per_category: exactly 4 for ELECTRIC_POWER", () => {
    const collection = generateWithRules(capFourPerCategory, MINIMAL_VOFC_RULES_WITH_EP_EXTRA);
    const frozen = freezeCollectionMeta(collection);
    assertCalibrationIntegrity(frozen);
    const ep = frozen.items.filter((i) => i.category === "ELECTRIC_POWER");
    expect(ep).toHaveLength(MAX_VOFC_PER_CATEGORY);
    expect(stableStringify(frozen)).toMatchSnapshot();
  });

  it("requires_service_false_skip: no VOFCs for ELECTRIC_POWER", () => {
    const collection = generateWithRules(requiresServiceFalseSkip, MINIMAL_VOFC_RULES.filter((r) => r.category === "ELECTRIC_POWER"));
    const frozen = freezeCollectionMeta(collection);
    expect(frozen.items).toHaveLength(0);
    expect(stableStringify(frozen)).toMatchSnapshot();
  });
});
