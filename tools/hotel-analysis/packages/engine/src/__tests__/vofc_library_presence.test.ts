/**
 * Smoke test: VOFC library file must exist and be non-empty.
 * Uses the same path resolution as runtime (getVofcLibraryPath).
 * CI/gate fails immediately if the VOFC library is missing.
 */
import * as fs from "fs";
import { describe, it, expect } from "vitest";
import { getVofcLibraryPath } from "../vofc/library";

describe("VOFC library presence", () => {
  it("resolved path exists and file size > 0", () => {
    const path = getVofcLibraryPath();
    expect(fs.existsSync(path), `VOFC library file not found at: ${path}`).toBe(true);
    const stat = fs.statSync(path);
    expect(stat.size, `VOFC library file is empty at: ${path}`).toBeGreaterThan(0);
  });
});
