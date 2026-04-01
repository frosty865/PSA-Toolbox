/**
 * Knowledge gap resolver for Energy.
 */
import type { KnowledgeGap, GapResolverInput } from './gapTypes';
import { isNoOrUnknown } from '../vulnerabilities/themeUtils';

export function resolveEnergyGaps(input: GapResolverInput): KnowledgeGap[] {
  const { answers } = input;
  const gaps: KnowledgeGap[] = [];

  const e8 = answers['E-8_backup_power_available'];
  const e10 = answers['E-10_tested_under_load'];
  if (e8 === 'yes' && (e10 === 'unknown' || e10 == null)) {
    gaps.push({
      id: 'ENERGY_BACKUP_TESTING_UNKNOWN',
      title: 'Backup power testing status unknown',
      description: 'Backup power exists but whether it has been tested under load is not documented.',
      question_ids: ['E-10'],
      severity: 'MEDIUM',
    });
  }

  const e9 = answers['E-9_refuel_sustainment_established'];
  if (e8 === 'yes' && (e9 === 'unknown' || e9 == null)) {
    gaps.push({
      id: 'ENERGY_REFUELING_SUSTAINMENT_UNKNOWN',
      title: 'Refueling/sustainment planning status unknown',
      description: 'Backup power exists but refueling or sustainment planning status is not documented.',
      question_ids: ['E-9'],
      severity: 'MEDIUM',
    });
  }

  return gaps.slice(0, 6); // cap at 6
}
