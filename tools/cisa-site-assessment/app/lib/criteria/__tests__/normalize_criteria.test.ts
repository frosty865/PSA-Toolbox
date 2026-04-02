/**
 * Unit tests for criteria normalizer (What/How -> existence-based).
 */

import { normalizeOneCriterion, normalizeCriteriaList } from "../normalize_criteria";

describe("normalizeOneCriterion", () => {
  it('rewrites "What is the purpose of X?" to existence form starting with "Is there" and ending with "?"', () => {
    const input = "What is the purpose of network segmentation for chargers?";
    const { out, changed } = normalizeOneCriterion(input);
    expect(changed).toBe(true);
    expect(out.startsWith("Is there")).toBe(true);
    expect(out.endsWith("?")).toBe(true);
    expect(/Is there a defined and documented purpose for/.test(out)).toBe(true);
    expect(out).toContain("network segmentation for chargers");
  });

  it('rewrites "How do you secure X?" to "Is there an established capability to ..."', () => {
    const input = "How do you secure charger communications?";
    const { out, changed } = normalizeOneCriterion(input);
    expect(changed).toBe(true);
    expect(out).toBe("Is there an established capability to secure charger communications?");
  });

  it("leaves already-valid criteria unchanged", () => {
    const input =
      "Is EV charging equipment inspected and maintained under a documented process?";
    const { out, changed } = normalizeOneCriterion(input);
    expect(changed).toBe(false);
    expect(out).toBe(input);
  });

  it("ensures output ends with ? when input does not", () => {
    const input = "Is there a fire extinguisher nearby";
    const { out, changed } = normalizeOneCriterion(input);
    expect(out.endsWith("?")).toBe(true);
    expect(out).toBe(input + "?");
    expect(changed).toBe(false);
  });

  it("collapses internal whitespace and trims", () => {
    const input = "  Is   there   a   process?  ";
    const { out, changed } = normalizeOneCriterion(input);
    expect(out).toBe("Is there a process?");
    expect(changed).toBe(false);
  });

  it("rewrites What is the role of X to existence form", () => {
    const input = "What is the role of the network switch in charger communications?";
    const { out, changed } = normalizeOneCriterion(input);
    expect(changed).toBe(true);
    expect(out.startsWith("Is there a defined and documented role for")).toBe(true);
    expect(out.endsWith("?")).toBe(true);
  });
});

describe("normalizeCriteriaList", () => {
  it("returns normalized list and rewrites array", () => {
    const criteria = [
      "What is the purpose of network segmentation for chargers?",
      "Is EV charging equipment inspected and maintained under a documented process?",
      "How do you secure charger communications?",
    ];
    const { normalized, rewrites } = normalizeCriteriaList(criteria);
    expect(normalized).toHaveLength(3);
    expect(normalized[0].startsWith("Is there")).toBe(true);
    expect(normalized[0].endsWith("?")).toBe(true);
    expect(normalized[1]).toBe(
      "Is EV charging equipment inspected and maintained under a documented process?"
    );
    expect(normalized[2]).toBe(
      "Is there an established capability to secure charger communications?"
    );
    expect(rewrites).toHaveLength(2);
    expect(rewrites[0].from).toContain("What is the purpose");
    expect(rewrites[0].to.startsWith("Is there")).toBe(true);
    expect(rewrites[1].from).toContain("How do you secure");
    expect(rewrites[1].to).toBe(
      "Is there an established capability to secure charger communications?"
    );
  });

  it("is deterministic for same input", () => {
    const input = "What is the purpose of network segmentation for chargers?";
    const a = normalizeCriteriaList([input]);
    const b = normalizeCriteriaList([input]);
    expect(a.normalized[0]).toBe(b.normalized[0]);
    expect(a.rewrites).toEqual(b.rewrites);
  });
});
