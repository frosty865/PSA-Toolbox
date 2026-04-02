/**
 * Technology Types Mapping
 * 
 * Authoritative UI mapping for technology types per discipline/subtype.
 * This is a static mapping file for UI display only.
 * 
 * TODO: Technology types will be curated subtype-by-subtype.
 * Initially populated with empty arrays for all subtypes.
 * 
 * Structure:
 * - Key: discipline_subtype_id (UUID as string)
 * - Value: Array of {code: string, label: string}
 */

export interface TechnologyType {
  code: string;
  label: string;
}

type TechnologyTypesMap = Record<string, TechnologyType[]>;

// Static mapping: discipline_subtype_id -> technology types
// TODO: Populate with curated technology types per subtype
const TECHNOLOGY_TYPES_MAP: TechnologyTypesMap = {
  // VSS (Video Surveillance Systems) subtypes
  // TODO: Add actual subtype IDs and technology types
  
  // ACS (Access Control Systems) subtypes
  // TODO: Add actual subtype IDs and technology types
};

/**
 * Get technology types for a discipline and subtype.
 * 
 * @param discipline_id - Discipline UUID (optional, for future use)
 * @param discipline_subtype_id - Subtype UUID
 * @returns Array of technology type options
 */
export function getTechnologyTypes(
  discipline_id: string | null,
  discipline_subtype_id: string
): TechnologyType[] {
  // Return technology types for this subtype, or empty array if not found
  return TECHNOLOGY_TYPES_MAP[discipline_subtype_id] || [];
}

/**
 * Get all technology types for a discipline (across all subtypes).
 * 
 * @param discipline_id - Discipline UUID
 * @returns Map of subtype_id -> technology types
 */
export function getTechnologyTypesByDiscipline(
  _discipline_id: string  
): Record<string, TechnologyType[]> {
  // TODO: Implement when discipline_id mapping is available
  return {};
}

