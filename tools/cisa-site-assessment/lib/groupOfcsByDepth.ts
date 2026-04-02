// STABLE: OFC depth hierarchy rendering
// Changes require doctrine or backend contract change.
// Do not modify during baseline burn-down.

export interface Ofc {
  parent_required_element_id?: string | null;
  is_sector_depth?: boolean;
  sector_id?: string | null;
  subsector_id?: string | null;
}

/**
 * Groups OFCs by depth type using backend-provided flags.
 * 
 * This is the SINGLE SOURCE OF TRUTH for OFC grouping logic.
 * All UI components must use this function to ensure consistency.
 * 
 * Rules:
 * - parent_required_element_id == null → baseline OFC
 * - parent_required_element_id != null && is_sector_depth === false → baseline depth OFC
 * - parent_required_element_id != null && is_sector_depth === true && !subsector_id → sector depth OFC
 * - parent_required_element_id != null && subsector_id != null → subsector depth OFC
 */
export function groupOfcsByDepth(ofcs: Ofc[]) {
  const baseline = ofcs.filter(
    o => o.parent_required_element_id == null
  );

  const baselineDepth = ofcs.filter(
    o => o.parent_required_element_id != null && o.is_sector_depth === false
  );

  const sectorDepth = ofcs.filter(
    o =>
      o.parent_required_element_id != null &&
      o.is_sector_depth === true &&
      !o.subsector_id
  );

  const subsectorDepth = ofcs.filter(
    o =>
      o.parent_required_element_id != null &&
      o.subsector_id != null
  );

  return {
    baseline,
    baselineDepth,
    sectorDepth,
    subsectorDepth,
  };
}

