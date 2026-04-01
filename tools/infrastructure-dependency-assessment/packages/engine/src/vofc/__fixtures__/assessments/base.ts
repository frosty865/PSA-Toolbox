/**
 * Base assessment factory for fixtures. Uses fixed meta for determinism.
 */
import type { Assessment } from "schema";

const FIXED_META = {
  tool_version: "0.1.0",
  template_version: "1",
  created_at_iso: "2000-01-01T00:00:00Z",
};

const FIXED_ASSET = {
  asset_name: "Fixture Asset",
  visit_date_iso: "2000-01-01",
};

export function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    meta: FIXED_META,
    asset: FIXED_ASSET,
    categories: {},
    ...overrides,
  };
}
