/**
 * Discipline-Level Checklist Configuration
 * 
 * Defines discipline-level checklists that group subtypes into higher-level capabilities.
 * Used for disciplines where subtypes should be grouped rather than shown individually.
 */

import type { ChecklistItem } from './types/checklist';

/**
 * Discipline-level checklist configuration
 * Maps discipline codes to their checklist items
 */
export const DISCIPLINE_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'COM': [
    {
      id: 'operational_comms',
      label: 'Operational Communications (security / operations coordination)',
      description: 'Means for security or operations personnel to communicate during incidents',
      tags: ['OPERATIONAL_COMMS'],
    },
    {
      id: 'occupant_notification',
      label: 'Occupant Notification',
      description: 'Means to notify occupants when protective actions are required',
      tags: ['OCCUPANT_NOTIFICATION'],
    },
  ],
};

/**
 * Map COM subtypes to checklist tags
 */
export const COM_SUBTYPE_TO_TAG: Record<string, string[]> = {
  'COM_RADIOS_TWO_WAY': ['OPERATIONAL_COMMS'],
  'COM_INTEROPERABLE_COMMUNICATIONS': ['OPERATIONAL_COMMS'],
  'COM_COMMUNICATION_PROTOCOLS': ['OPERATIONAL_COMMS'],
  'COM_BACKUP_COMMUNICATIONS': ['OPERATIONAL_COMMS'],
  'COM_PA_SYSTEMS': ['OCCUPANT_NOTIFICATION'],
  'COM_PAGING_SYSTEMS': ['OCCUPANT_NOTIFICATION'],
};

/**
 * Get discipline-level checklist items for a discipline
 */
export function getDisciplineChecklist(disciplineCode: string): ChecklistItem[] | null {
  return DISCIPLINE_CHECKLISTS[disciplineCode.toUpperCase()] || null;
}

/**
 * Check if a discipline uses a discipline-level checklist
 */
export function usesDisciplineChecklist(disciplineCode: string): boolean {
  return disciplineCode.toUpperCase() in DISCIPLINE_CHECKLISTS;
}

/**
 * Get tags for a COM subtype
 */
export function getComSubtypeTags(subtypeCode: string): string[] {
  return COM_SUBTYPE_TO_TAG[subtypeCode] || [];
}
