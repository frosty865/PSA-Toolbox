import { describe, it, expect } from "vitest";
import { evaluateTriggers } from "./evaluate_triggers";
import type { Assessment, CategoryCode } from "schema";
import type { TriggerConditions } from "./library";

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    meta: { tool_version: "0.1.0", template_version: "1", created_at_iso: new Date().toISOString() },
    asset: { asset_name: "Test", visit_date_iso: "2025-01-01" },
    categories: {},
    ...overrides,
  };
}

function electricPowerInput(overrides: Record<string, unknown> = {}) {
  return {
    requires_service: true,
    time_to_impact_hours: 12,
    loss_fraction_no_backup: 0.5,
    has_backup: false,
    backup_duration_hours: null,
    loss_fraction_with_backup: null,
    recovery_time_hours: 24,
    ...overrides,
  };
}

describe("evaluateTriggers", () => {
  it("single-condition match: has_backup=false → CONFIRMED", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ has_backup: false }),
      },
    });
    const result = evaluateTriggers(
      { has_backup: false } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(true);
    expect(result.applicability).toBe("CONFIRMED");
  });

  it("single-condition match: recovery_time_gte_hours=72 → CONFIRMED when only that trigger", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ recovery_time_hours: 96 }),
      },
    });
    const result = evaluateTriggers(
      { recovery_time_gte_hours: 72 } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(true);
    expect(result.applicability).toBe("CONFIRMED");
  });

  it("single-condition no match: has_backup=false but input has_backup=true", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ has_backup: true, backup_duration_hours: 24, loss_fraction_with_backup: 0.2 }),
      },
    });
    const result = evaluateTriggers(
      { has_backup: false } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(false);
  });

  it("multi-condition match: has_backup=false and requires_service=true", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ has_backup: false, requires_service: true }),
      },
    });
    const result = evaluateTriggers(
      { requires_service: true, has_backup: false } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(true);
    expect(result.applicability).toBe("CONFIRMED");
  });

  it("multi-condition match: mixed direct + threshold → POTENTIAL", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({
          has_backup: false,
          recovery_time_hours: 96,
        }),
      },
    });
    const result = evaluateTriggers(
      { has_backup: false, recovery_time_gte_hours: 72 } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(true);
    expect(result.applicability).toBe("POTENTIAL");
  });

  it("multi-condition: first failed condition returns matched=false immediately", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ has_backup: true, backup_duration_hours: 24, loss_fraction_with_backup: 0.2 }),
      },
    });
    const result = evaluateTriggers(
      { has_backup: false, recovery_time_gte_hours: 72 } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(false);
  });

  it("undefined trigger fields are ignored", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ has_backup: false }),
      },
    });
    const result = evaluateTriggers(
      { has_backup: false, requires_service: undefined } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(true);
  });

  it("requires_service=false: matched=false unless category is CRITICAL_PRODUCTS", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ requires_service: false }),
      },
    });
    const result = evaluateTriggers(
      { requires_service: false } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(false);
  });

  it("CRITICAL_PRODUCTS with requires_service=false still evaluates", () => {
    const a = assessment({
      categories: {
        CRITICAL_PRODUCTS: {
          ...electricPowerInput(),
          requires_service: false,
          critical_product_single_source: true,
          critical_product_no_alt_supplier: false,
        },
      },
    });
    const result = evaluateTriggers(
      { critical_product_single_source: true } as TriggerConditions,
      a,
      "CRITICAL_PRODUCTS" as CategoryCode
    );
    expect(result.matched).toBe(true);
    expect(result.applicability).toBe("CONFIRMED");
  });

  it("CRITICAL_PRODUCTS: time-based triggers are not evaluated", () => {
    const a = assessment({
      categories: {
        CRITICAL_PRODUCTS: {
          requires_service: true,
          time_to_impact_hours: 72,
          loss_fraction_no_backup: 0.2,
          has_backup: false,
          backup_duration_hours: null,
          loss_fraction_with_backup: null,
          recovery_time_hours: 24,
          critical_product_single_source: true,
          critical_product_no_alt_supplier: false,
        },
      },
    });
    const result = evaluateTriggers(
      { critical_product_single_source: true, recovery_time_gte_hours: 72 } as TriggerConditions,
      a,
      "CRITICAL_PRODUCTS" as CategoryCode
    );
    expect(result.matched).toBe(true);
  });

  it("missing category input returns matched=false", () => {
    const a = assessment({ categories: {} });
    const result = evaluateTriggers(
      { has_backup: false } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(false);
  });

  it("direct trigger not collected: has_backup undefined → no match (do not infer from uncollected data)", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ has_backup: undefined, has_backup_any: undefined }),
      },
    });
    const result = evaluateTriggers(
      { has_backup: false } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(false);
  });

  it("direct trigger not collected: requires_service undefined → no match", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: { ...electricPowerInput(), requires_service: undefined },
      },
    });
    const result = evaluateTriggers(
      { requires_service: true } as TriggerConditions,
      a,
      "ELECTRIC_POWER" as CategoryCode
    );
    expect(result.matched).toBe(false);
  });

  it("empty trigger_conditions: no match (resilience tool—only VOFCs for questions asked)", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ requires_service: true }),
      },
    });
    const result = evaluateTriggers({} as TriggerConditions, a, "ELECTRIC_POWER" as CategoryCode);
    expect(result.matched).toBe(false);
    expect(result.applicability).toBe("POTENTIAL");
  });

  it("empty trigger_conditions: no match when category missing", () => {
    const a = assessment({ categories: {} });
    const result = evaluateTriggers({} as TriggerConditions, a, "ELECTRIC_POWER" as CategoryCode);
    expect(result.matched).toBe(false);
  });

  it("empty trigger_conditions: no match when requires_service=false (non-CP)", () => {
    const a = assessment({
      categories: {
        ELECTRIC_POWER: electricPowerInput({ requires_service: false }),
      },
    });
    const result = evaluateTriggers({} as TriggerConditions, a, "ELECTRIC_POWER" as CategoryCode);
    expect(result.matched).toBe(false);
  });
});
