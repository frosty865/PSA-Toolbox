/**
 * Theme combiner for Wastewater dependency (doctrine-aligned).
 * Uses new WW_Q1–WW_Q14 answer schema.
 */
import type { EvidenceItem, ThemedFinding, ThemeResolverInput } from '../themeTypes';

function evidence(qid: string, answer?: unknown): EvidenceItem {
  return { question_id: qid, answer: answer as string | boolean | undefined };
}

export function resolveWastewaterThemes(input: ThemeResolverInput): ThemedFinding[] {
  const { answers, praSlaEnabled } = input;
  const findings: ThemedFinding[] = [];

  const isNo = (v: unknown) => v === 'no';
  const isNoOrUnknown = (v: unknown) => v === 'no' || v === 'unknown';

  // WW_Q6 is PRA/SLA-specific; skip this finding when toggle is OFF
  if (praSlaEnabled === true && isNo(answers.WW_Q6_priority_restoration)) {
    findings.push({
      id: 'WW_NO_PRIORITY_RESTORATION',
      title: 'No priority restoration plan',
      narrative:
        'The facility does not participate in a priority or coordinated restoration plan with the wastewater provider.',
      evidence: [evidence('WW_Q6', answers.WW_Q6_priority_restoration)],
      ofcText: 'Consider discussing restoration prioritization criteria with the provider and documenting realistic expectations.',
    });
  }

  // WW_SINGLE_CONNECTION_NO_REDUNDANCY
  const connCount = typeof answers.WW_Q2_connection_count === 'number' ? answers.WW_Q2_connection_count : null;
  if (answers.curve_requires_service === true && connCount !== null && connCount <= 1) {
    findings.push({
      id: 'WW_SINGLE_CONNECTION_NO_REDUNDANCY',
      title: 'Single wastewater connection with limited redundancy',
      narrative:
        'The facility reports one wastewater service/discharge connection, increasing susceptibility to single-path disruption.',
      evidence: [evidence('WW_Q2', connCount)],
      ofcText:
        'Consider evaluating feasible options to reduce single-connection wastewater dependency risk.',
    });
  }

  // WW_CONSTRAINTS_NOT_EVALUATED
  if (isNoOrUnknown(answers.WW_Q14_constraints_evaluated)) {
    findings.push({
      id: 'WW_CONSTRAINTS_NOT_EVALUATED',
      title: 'Wastewater disruption constraints not fully evaluated',
      narrative:
        'Regulatory and operational constraints for prolonged wastewater disruption are not fully evaluated, which can delay decision-making during extended events.',
      evidence: [evidence('WW_Q14', answers.WW_Q14_constraints_evaluated)],
      ofcText:
        'Consider completing a constraints review covering permit limits, temporary handling options, and escalation triggers.',
    });
  }

  return findings.slice(0, 3);
}
