/**
 * Hash stability: same normalized structure => same hash; excerpts/locators excluded.
 */

import { describe, it, expect } from "vitest";
import { planSchemaHash } from "../hash";
import type { PlanSchemaSnapshot } from "../types";

describe("plan_schema_hash_stability", () => {
  const base: PlanSchemaSnapshot = {
    module_code: "MODULE_ACTIVE_ASSAILANT_EMERGENCY_ACTION_PLAN",
    structure_source_registry_id: "00000000-0000-0000-0000-000000000001",
    derive_method: "TOC",
    confidence: "HIGH",
    sections: [
      {
        section_key: "1_purpose",
        section_title: "Purpose",
        section_ord: 1,
        elements: [
          {
            element_key: "scope",
            element_label: "Scope",
            element_ord: 1,
            is_core: false,
          },
        ],
      },
    ],
  };

  it("same structure yields same hash", () => {
    const h1 = planSchemaHash(base);
    const h2 = planSchemaHash({ ...base });
    expect(h1).toBe(h2);
  });

  it("different section_key yields different hash", () => {
    const h1 = planSchemaHash(base);
    const modified: PlanSchemaSnapshot = {
      ...base,
      sections: [
        {
          ...base.sections[0],
          section_key: "1_purposes",
        },
      ],
    };
    expect(planSchemaHash(modified)).not.toBe(h1);
  });

  it("adding source_excerpt does not change hash", () => {
    const h1 = planSchemaHash(base);
    const withExcerpt: PlanSchemaSnapshot = {
      ...base,
      sections: base.sections.map((s) => ({
        ...s,
        elements: s.elements.map((e) => ({ ...e, source_excerpt: "Some excerpt" })),
      })),
    };
    expect(planSchemaHash(withExcerpt)).toBe(h1);
  });
});
