/**
 * Theme combiner for Communications dependency (voice/command & control).
 * Uses new comm_* and curve_* keys; falls back to legacy CO-* when present.
 */
import type { EvidenceItem, ThemedFinding, ThemeResolverInput } from '../themeTypes';
import { isNoOrUnknown, isYes } from '../themeUtils';

function evidence(qid: string, answer?: unknown): EvidenceItem {
  return { question_id: qid, answer: answer as string | boolean | undefined };
}

export function resolveCommsThemes(input: ThemeResolverInput): ThemedFinding[] {
  const { answers } = input;
  const findings: ThemedFinding[] = [];

  const backupAvailable = answers.curve_backup_available ?? answers['CO-8_backup_available'];
  const restorationCoord = answers.comm_restoration_coordination ?? answers['CO-11_restoration_coordination'];
  const singlePoint = answers.comm_single_point_voice_failure;
  const co3 = answers['CO-3_multiple_connections'];
  const co4 = answers['CO-4_physically_separated'];
  const co9 = answers['CO-9_sustainment_plan'];

  // 1) COMMS_DIVERSITY — single point of failure or legacy diversity (only use legacy when present)
  const diversityWeak =
    singlePoint === 'yes' ||
    singlePoint === 'unknown' ||
    (co3 != null && isNoOrUnknown(co3)) ||
    (co4 != null && isNoOrUnknown(co4)) ||
    (co9 != null && (co9 === 'no_shared_failure_point' || co9 === 'unknown'));
  if (diversityWeak) {
    const evidenceList: EvidenceItem[] = [];
    if (singlePoint != null) evidenceList.push(evidence('comm_single_point_voice_failure', singlePoint));
    if (co3 != null) evidenceList.push(evidence('CO-3', co3));
    if (co4 != null) evidenceList.push(evidence('CO-4', co4));
    if (co9 != null) evidenceList.push(evidence('CO-9', co9));
    findings.push({
      id: 'COMMS_DIVERSITY',
      title: 'Carrier diversity is limited',
      narrative:
        'Communications service is vulnerable to a single external event due to limited circuit diversity, lack of geographic separation, or shared failure points. This increases the likelihood that one outage disrupts both primary and backup communications.',
      evidence: evidenceList,
      ofcText:
        'Evaluate the feasibility of establishing additional communications service connections with geographic separation, or diversifying backup capability to use different carriers, routes, or infrastructure.',
    });
  }

  // 2) COMMS_ALTERNATE_CAPABILITY
  const co10 = answers['CO-10_reliability_known'];
  const backupNo = backupAvailable != null && isNoOrUnknown(backupAvailable);
  const hasBackup = isYes(backupAvailable);
  const co10No = co10 != null && isNoOrUnknown(co10);
  const alternateWeak = backupNo || (hasBackup && co10No);
  if (alternateWeak) {
    const evidenceList: EvidenceItem[] = [];
    if (backupNo) evidenceList.push(evidence('curve_backup_available', backupAvailable));
    if (hasBackup && co10No) evidenceList.push(evidence('CO-10', co10));
    findings.push({
      id: 'COMMS_ALTERNATE_CAPABILITY',
      title: 'Alternate communications capability is insufficient or unverified',
      narrative:
        'Alternate communications capability is absent, limited, or not recently verified. During extended events, this reduces the ability to sustain critical communications functions.',
      evidence: evidenceList,
      ofcText:
        'Evaluate the need for backup or alternate communications capability to support core operations during extended service outages and ensure the solution remains reliable under real-world conditions.',
    });
  }

  // 3) COMMS_RESTORATION_REALISM
  if (restorationCoord != null && isNoOrUnknown(restorationCoord)) {
    findings.push({
      id: 'COMMS_RESTORATION_REALISM',
      title: 'Restoration coordination is unclear',
      narrative:
        'Coordination with the service provider for restoration is not documented or not established. This can delay troubleshooting, escalation, and restoration during outages.',
      evidence: [evidence('comm_restoration_coordination', restorationCoord)],
      ofcText:
        'Establish documented coordination with the communications service provider regarding restoration expectations, priority considerations, and communication procedures.',
    });
  }

  return findings;
}
