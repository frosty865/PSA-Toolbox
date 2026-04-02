/**
 * Unit tests for section_intents: resolveIntentElements returns correct seeds per section type.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveIntentElements } from "../section_intents";

describe("resolveIntentElements", () => {
  it("returns 2 seeds for TRAINING AND EXERCISES", () => {
    const seeds = resolveIntentElements("TRAINING AND EXERCISES");
    assert.strictEqual(seeds.length, 2);
    assert.ok(seeds.some((s) => s.element_title === "Training activities"));
    assert.ok(seeds.some((s) => s.element_title === "Exercises or drills"));
    seeds.forEach((s) => {
      assert.ok(s.observation.endsWith("not documented.") || s.observation.endsWith("not specified."));
    });
  });

  it("returns 4 seeds for evacuation/lockdown/shelter section including decision authority", () => {
    const seeds = resolveIntentElements("PROCEDURES FOR EVACUATION, LOCKDOWN, AND SHELTER-IN-PLACE");
    assert.strictEqual(seeds.length, 4);
    assert.ok(seeds.some((s) => s.element_title === "Decision authority" && s.observation.includes("not specified")));
    assert.ok(seeds.some((s) => s.element_title === "Evacuation procedures"));
    assert.ok(seeds.some((s) => s.element_title === "Lockdown procedures"));
    assert.ok(seeds.some((s) => s.element_title === "Shelter-in-place procedures"));
  });

  it("returns 1 seed fallback for unknown section title", () => {
    const seeds = resolveIntentElements("MISCELLANEOUS APPENDIX");
    assert.strictEqual(seeds.length, 1);
    assert.strictEqual(seeds[0].element_title, "MISCELLANEOUS APPENDIX");
    assert.ok(seeds[0].observation.endsWith("is not documented."));
  });

  it("returns applicability seed for scope section", () => {
    const seeds = resolveIntentElements("Applicability and Scope");
    assert.strictEqual(seeds.length, 1);
    assert.strictEqual(seeds[0].element_title, "Applicability and scope");
    assert.strictEqual(seeds[0].observation, "Applicability and scope are not documented.");
  });

  it("returns roles and points of contact for roles section", () => {
    const seeds = resolveIntentElements("Roles and Responsibilities");
    assert.strictEqual(seeds.length, 2);
    assert.ok(seeds.some((s) => s.element_title === "Roles and responsibilities"));
    assert.ok(seeds.some((s) => s.element_title === "Points of contact"));
  });
});
