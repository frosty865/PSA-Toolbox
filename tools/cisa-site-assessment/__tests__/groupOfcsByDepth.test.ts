import { groupOfcsByDepth } from "@/lib/groupOfcsByDepth";

/**
 * Regression test for OFC grouping logic.
 * 
 * This test ensures the separation rules for baseline, baseline depth,
 * sector depth, and subsector depth OFCs remain correct.
 * 
 * If this test fails, the OFC rendering UI will break.
 */
describe("groupOfcsByDepth", () => {
  it("correctly groups baseline, baseline depth, sector depth, and subsector depth OFCs", () => {
    const ofcs = [
      { parent_required_element_id: null },
      { parent_required_element_id: "p1", is_sector_depth: false },
      { parent_required_element_id: "p1", is_sector_depth: true, sector_id: "healthcare" },
      { parent_required_element_id: "p1", is_sector_depth: true, sector_id: "healthcare", subsector_id: "hospitals" },
    ];

    const result = groupOfcsByDepth(ofcs);

    expect(result.baseline).toHaveLength(1);
    expect(result.baselineDepth).toHaveLength(1);
    expect(result.sectorDepth).toHaveLength(1);
    expect(result.subsectorDepth).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = groupOfcsByDepth([]);
    
    expect(result.baseline).toHaveLength(0);
    expect(result.baselineDepth).toHaveLength(0);
    expect(result.sectorDepth).toHaveLength(0);
    expect(result.subsectorDepth).toHaveLength(0);
  });

  it("correctly identifies baseline OFCs (no parent)", () => {
    const ofcs = [
      { parent_required_element_id: null },
      { parent_required_element_id: undefined },
    ];

    const result = groupOfcsByDepth(ofcs);

    expect(result.baseline).toHaveLength(2);
    expect(result.baselineDepth).toHaveLength(0);
    expect(result.sectorDepth).toHaveLength(0);
    expect(result.subsectorDepth).toHaveLength(0);
  });

  it("correctly identifies baseline depth OFCs (parent but not sector depth)", () => {
    const ofcs = [
      { parent_required_element_id: "p1", is_sector_depth: false },
      { parent_required_element_id: "p2", is_sector_depth: undefined },
    ];

    const result = groupOfcsByDepth(ofcs);

    expect(result.baseline).toHaveLength(0);
    expect(result.baselineDepth).toHaveLength(2);
    expect(result.sectorDepth).toHaveLength(0);
    expect(result.subsectorDepth).toHaveLength(0);
  });

  it("correctly identifies sector depth OFCs (parent, sector depth, no subsector)", () => {
    const ofcs = [
      { parent_required_element_id: "p1", is_sector_depth: true, sector_id: "healthcare" },
      { parent_required_element_id: "p2", is_sector_depth: true, sector_id: "transportation" },
    ];

    const result = groupOfcsByDepth(ofcs);

    expect(result.baseline).toHaveLength(0);
    expect(result.baselineDepth).toHaveLength(0);
    expect(result.sectorDepth).toHaveLength(2);
    expect(result.subsectorDepth).toHaveLength(0);
  });

  it("correctly identifies subsector depth OFCs (parent with subsector_id)", () => {
    const ofcs = [
      { parent_required_element_id: "p1", is_sector_depth: true, sector_id: "healthcare", subsector_id: "hospitals" },
      { parent_required_element_id: "p2", subsector_id: "airports" },
    ];

    const result = groupOfcsByDepth(ofcs);

    expect(result.baseline).toHaveLength(0);
    expect(result.baselineDepth).toHaveLength(0);
    expect(result.sectorDepth).toHaveLength(0);
    expect(result.subsectorDepth).toHaveLength(2);
  });
});

