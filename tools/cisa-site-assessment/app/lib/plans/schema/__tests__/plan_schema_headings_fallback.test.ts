/**
 * Golden tests: headings fallback — derive_method HEADINGS, __core element per section, anti-drift.
 */

import { describe, it, expect } from "vitest";
import {
  extractNumberedHeadings,
  applyAntiDrift,
  headingsToSnapshot,
  type PageLines,
} from "../headings_parser";

describe("plan_schema_headings_fallback", () => {
  const moduleCode = "MODULE_ACTIVE_ASSAILANT_EMERGENCY_ACTION_PLAN";
  const structureSourceId = "00000000-0000-0000-0000-000000000001";

  it("derive_method HEADINGS and each section has exactly one __core element with is_core true", () => {
    const pages: PageLines[] = [
      {
        page: 1,
        lines: [
          "1. Purpose",
          "2. Applicability and Scope",
          "3. Roles and Responsibilities",
          "4. Prevention",
          "5. Protection",
          "6. Response",
          "7. Recovery",
          "8. Testing and Training",
          "9. Plan Maintenance",
          "10. References",
        ],
      },
    ];
    const candidates = extractNumberedHeadings(pages);
    const drifted = applyAntiDrift(candidates);
    const snapshot = headingsToSnapshot({
      headings: drifted,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    expect(snapshot.derive_method).toBe("HEADINGS");
    for (const sec of snapshot.sections) {
      expect(sec.elements.length).toBe(1);
      expect(sec.elements[0].element_key).toContain("__core");
      expect(sec.elements[0].is_core).toBe(true);
    }
  });

  it("anti-drift: excess headings capped and ordered", () => {
    const lines: string[] = [];
    for (let i = 1; i <= 20; i++) {
      lines.push(`${i}. Section ${i}`);
    }
    const pages: PageLines[] = [{ page: 1, lines }];
    const candidates = extractNumberedHeadings(pages);
    const drifted = applyAntiDrift(candidates);
    expect(drifted.length).toBeLessThanOrEqual(12);
    const snapshot = headingsToSnapshot({
      headings: drifted,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    expect(snapshot.sections.length).toBeLessThanOrEqual(12);
    if (snapshot.sections.length >= 8 && snapshot.sections.length <= 12) {
      expect(snapshot.confidence).toBe("MEDIUM");
    }
  });

  it("elementsTotal > 0 (no section without element)", () => {
    const pages: PageLines[] = [{ page: 1, lines: ["1. Purpose", "2. Scope"] }];
    const candidates = extractNumberedHeadings(pages);
    const snapshot = headingsToSnapshot({
      headings: candidates,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    const total = snapshot.sections.reduce((sum, s) => sum + s.elements.length, 0);
    expect(total).toBeGreaterThan(0);
    expect(snapshot.sections.length).toBe(2);
  });
});
