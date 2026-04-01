/**
 * Unit test: load VOFC_Library.xlsx (legacy V # / OFC # format) and assert
 * parsing produces stable vofc_id, uniqueness, and known sheet format.
 */
import { describe, it, expect } from "vitest";
import { getVofcLibraryPath, loadVofcLibraryEntries } from "./library";

describe("VOFC library loader (legacy format)", () => {
  it("loads VOFC_Library.xlsx and produces records with vofc_id", async () => {
    const path = getVofcLibraryPath();
    const entries = await loadVofcLibraryEntries(path);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.vofc_id).toBeDefined();
      expect(typeof e.vofc_id).toBe("string");
      expect(e.vofc_id.trim()).toBe(e.vofc_id);
      expect(e.vulnerability.trim()).toBeTruthy();
      expect(e.option_for_consideration.trim()).toBeTruthy();
    }
  });

  it("enforces vofc_id uniqueness across all sheets", async () => {
    const path = getVofcLibraryPath();
    const entries = await loadVofcLibraryEntries(path);
    const ids = entries.map((e) => e.vofc_id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it("produces vofc_id like ENTRY_CONTROLS.V1.O1 for Entry Controls sheet", async () => {
    const path = getVofcLibraryPath();
    const entries = await loadVofcLibraryEntries(path);
    const entryControls = entries.filter(
      (e) => e.vofc_id.startsWith("ENTRY_CONTROLS.") || e.source_sheet === "Entry Controls"
    );
    expect(entryControls.length).toBeGreaterThan(0);
    const hasV1O1 = entryControls.some(
      (e) => e.vofc_id === "ENTRY_CONTROLS.V1.O1" || e.vofc_id.match(/^ENTRY_CONTROLS\.V\d+\.O\d+$/)
    );
    expect(hasV1O1).toBe(true);
  });
});
