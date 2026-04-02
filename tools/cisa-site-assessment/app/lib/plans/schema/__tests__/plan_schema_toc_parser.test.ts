/**
 * Golden tests: TOC outline → PlanSchemaSnapshot (10 sections, subordinates, derive_method TOC, stable hash).
 */

import { describe, it, expect } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { outlineToSnapshot, isTocUsable, type TocOutlineEntry } from "../toc_parser";
import { planSchemaHash } from "../hash";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "cisa_active_assailant_toc_outline.json");

describe("plan_schema_toc_parser", () => {
  const moduleCode = "MODULE_ACTIVE_ASSAILANT_EMERGENCY_ACTION_PLAN";
  const structureSourceId = "00000000-0000-0000-0000-000000000001";

  it("produces exactly 10 sections from golden fixture", () => {
    const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { toc: TocOutlineEntry[] };
    const { snapshot } = outlineToSnapshot({
      toc: fixture.toc,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    expect(snapshot.sections.length).toBe(10);
    expect(snapshot.derive_method).toBe("TOC");
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(snapshot.confidence);
  });

  it("section_key starts with ord and section_title is non-empty stripped of numbering", () => {
    const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { toc: TocOutlineEntry[] };
    const { snapshot } = outlineToSnapshot({
      toc: fixture.toc,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    for (let i = 0; i < snapshot.sections.length; i++) {
      const sec = snapshot.sections[i];
      expect(sec.section_ord).toBe(i + 1);
      expect(sec.section_key).toMatch(new RegExp(`^${i + 1}_`));
      expect(sec.section_title.length).toBeGreaterThan(0);
    }
  });

  it("subordinate entries attach to correct parent; sections with no children get __core element", () => {
    const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { toc: TocOutlineEntry[] };
    const { snapshot } = outlineToSnapshot({
      toc: fixture.toc,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    let totalElements = 0;
    for (const sec of snapshot.sections) {
      expect(sec.elements.length).toBeGreaterThanOrEqual(1);
      totalElements += sec.elements.length;
      if (sec.elements.length === 1 && sec.elements[0].element_key.endsWith("__core")) {
        expect(sec.elements[0].is_core).toBe(true);
      }
    }
    expect(totalElements).toBeGreaterThan(10);
  });

  it("derive_method is TOC and schema_hash is stable for same input", () => {
    const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { toc: TocOutlineEntry[] };
    const { snapshot } = outlineToSnapshot({
      toc: fixture.toc,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    expect(snapshot.derive_method).toBe("TOC");
    const hash1 = planSchemaHash(snapshot);
    const hash2 = planSchemaHash(snapshot);
    expect(hash1).toBe(hash2);
    const { snapshot: snapshot2 } = outlineToSnapshot({
      toc: fixture.toc,
      module_code: moduleCode,
      structure_source_registry_id: structureSourceId,
    });
    expect(planSchemaHash(snapshot2)).toBe(hash1);
  });

  it("isTocUsable: at least 8 level-1 and at least one subordinate", () => {
    const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { toc: TocOutlineEntry[] };
    expect(isTocUsable(fixture.toc)).toBe(true);
    expect(isTocUsable([])).toBe(false);
    expect(isTocUsable([{ level: 1, title: "Only one", page: 1 }])).toBe(false);
  });
});
