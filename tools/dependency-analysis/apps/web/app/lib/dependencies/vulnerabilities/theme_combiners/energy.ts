/**
 * Theme combiner for Energy dependency.
 * Returns up to 3 themed findings.
 */
import type { EvidenceItem, ThemedFinding, ThemeResolverInput } from '../themeTypes';
import { isNoOrUnknown, isYes } from '../themeUtils';

function evidence(qid: string, answer?: unknown): EvidenceItem {
  return { question_id: qid, answer: answer as string | boolean | undefined };
}

export function resolveEnergyThemes(input: ThemeResolverInput): ThemedFinding[] {
  const { answers } = input;
  const findings: ThemedFinding[] = [];

  // 1) ENERGY_FEED_DIVERSITY
  const e3 = answers['E-3_more_than_one_connection'];
  const e4 = answers['E-4_physically_separated'];
  const e5 = answers['E-5_single_supports_core_ops'];
  const e3No = isNoOrUnknown(e3);
  const e4No = e4 !== 'na' && isNoOrUnknown(e4); // na = not applicable, skip
  const e5No = isNoOrUnknown(e5);
  if (e3No || e4No || e5No) {
    const evidenceList: EvidenceItem[] = [];
    if (e3No) evidenceList.push(evidence('E-3', e3));
    if (e4No) evidenceList.push(evidence('E-4', e4));
    if (e5No) evidenceList.push(evidence('E-5', e5));
    findings.push({
      id: 'ENERGY_FEED_DIVERSITY',
      title: 'Electric service feed diversity may be limited',
      narrative:
        'Electric service may rely on a single connection, co-located entry points, or insufficient load survivability. A localized failure could significantly affect facility operations.',
      evidence: evidenceList,
      ofcText:
        'Evaluate the feasibility of establishing additional electric service connections with geographic separation, or ensuring one connection can support critical operations.',
    });
  }

  // 2) ENERGY_BACKUP_ABSENT
  const e8 = answers['E-8_backup_power_available'];
  const e8Assets = (answers['E-8_backup_assets'] as { supported_load_classification?: string[] }[]) ?? [];
  const hasCoreOrFull = e8Assets.some(
    (a) =>
      a?.supported_load_classification?.includes('critical_core_services') ||
      a?.supported_load_classification?.includes('full_facility_load'),
  );
  const e8No = isNoOrUnknown(e8);
  const e8YesNoCore = isYes(e8) && !hasCoreOrFull && e8Assets.length > 0;
  if (e8No || e8YesNoCore) {
    const evidenceList: EvidenceItem[] = [evidence('E-8', e8)];
    findings.push({
      id: 'ENERGY_BACKUP_ABSENT',
      title: 'Backup power capability may be absent or insufficient',
      narrative:
        'Backup or alternate power may be absent, or available backup may not support critical or full facility operations. This can increase operational impacts during electric service disruptions.',
      evidence: evidenceList,
      ofcText:
        'Evaluate the need for backup or alternate power capability to support critical operations during extended electric service outages.',
    });
  }

  // 3) ENERGY_BACKUP_SUSTAIN_TEST
  const e9 = answers['E-9_refuel_sustainment_established'];
  const e10 = answers['E-10_tested_under_load'];
  const e9No = isNoOrUnknown(e9);
  const e10No = isNoOrUnknown(e10);
  if (e9No || e10No) {
    const evidenceList: EvidenceItem[] = [];
    if (e9No) evidenceList.push(evidence('E-9', e9));
    if (e10No) evidenceList.push(evidence('E-10', e10));
    findings.push({
      id: 'ENERGY_BACKUP_SUSTAIN_TEST',
      title: 'Backup power sustainment or testing may be uncertain',
      narrative:
        'Refueling or sustainment planning for backup power may be absent, or backup systems may not have been tested under load. This can increase recovery time and uncertainty during extended outages.',
      evidence: evidenceList,
      ofcText:
        'Establish refueling/sustainment planning for backup power and maintain a routine testing schedule to verify backup systems function as intended under load.',
    });
  }

  return findings;
}
