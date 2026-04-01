/**
 * Normalization failure regression: rules with forbidden/prescriptive language
 * (e.g. BAD-01 with "should") cause generateVOFCs to throw with message containing
 * "forbidden" or "normalization".
 */
import { describe, it, expect } from "vitest";
import { generateVOFCs } from "../generate";
import { MINIMAL_VOFC_RULES } from "../__fixtures__/rules_minimal";
import { epNoBackupShortTtiHighLoss } from "../__fixtures__/assessments";

const DUMMY_PATH = "";

describe("calibration normalization fail", () => {
  it("throws when rulesOverride includes BAD-01 and assessment triggers it", () => {
    const rules = MINIMAL_VOFC_RULES.filter(
      (r) => r.category === "ELECTRIC_POWER"
    );
    expect(rules.some((r) => r.vofc_id === "BAD-01")).toBe(true);
    expect(() => {
      generateVOFCs(epNoBackupShortTtiHighLoss, DUMMY_PATH, {
        rulesOverride: rules,
      }) as unknown;
    }).toThrow(/forbidden|normalization/i);
  });
});
