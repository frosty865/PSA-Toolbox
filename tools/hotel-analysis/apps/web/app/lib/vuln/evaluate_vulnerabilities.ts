/**
 * Vulnerability Evaluator - Runtime trigger evaluation
 *
 * Uses the same catalogs and trigger format as the report (TriggerRule).
 * Returns triggered vulnerabilities with matched answer context.
 */

import type { InfraId, VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';
import type { TriggeredVulnerability } from './vulnerability_types';
import { VULN_CATALOGS } from './catalog_registry';
import { evaluateRule } from '../report/vulnerability/evaluate_vulnerabilities';
import { collectQuestionIds } from './validate_catalog';

/**
 * Get vulnerability catalog for an infrastructure (single source of truth).
 */
export function getVulnerabilityCatalog(infraId: InfraId): VulnerabilityConfig[] {
  return VULN_CATALOGS[infraId] ?? [];
}

/**
 * Evaluate vulnerability trigger against answers (TriggerRule format).
 */
function evaluateVulnerabilityTrigger(
  vuln: VulnerabilityConfig,
  answers: Record<string, unknown>
): { triggered: boolean; matchedAnswers: Record<string, unknown> } {
  const triggered = evaluateRule(vuln.trigger, answers);
  const matchedAnswers: Record<string, unknown> = {};
  if (triggered) {
    for (const qid of collectQuestionIds(vuln.trigger)) {
      if (qid in answers) matchedAnswers[qid] = answers[qid];
    }
  }
  return { triggered, matchedAnswers };
}

/**
 * Evaluate all vulnerabilities for an infrastructure
 *
 * @param infraId - Infrastructure ID
 * @param answers - Assessment answers (flat key-value)
 * @returns Array of triggered vulnerabilities with matched answers
 */
export function evaluateVulnerabilities(
  infraId: InfraId,
  answers: Record<string, unknown>
): TriggeredVulnerability[] {
  const catalog = getVulnerabilityCatalog(infraId);
  const triggered: TriggeredVulnerability[] = [];

  for (const vuln of catalog) {
    const evaluation = evaluateVulnerabilityTrigger(vuln, answers);

    if (evaluation.triggered) {
      triggered.push({
        config: vuln,
        matched_answers: evaluation.matchedAnswers,
      });
    }
  }

  return triggered;
}

/**
 * Evaluate vulnerabilities across all infrastructures
 *
 * @param answersByInfra - Answers organized by infrastructure
 * @returns Record of triggered vulnerabilities by infrastructure
 */
export function evaluateAllVulnerabilities(
  answersByInfra: Partial<Record<InfraId, Record<string, unknown>>>
): Record<InfraId, TriggeredVulnerability[]> {
  const results: Partial<Record<InfraId, TriggeredVulnerability[]>> = {};

  const infraIds: InfraId[] = [
    'ELECTRIC_POWER',
    'COMMUNICATIONS',
    'INFORMATION_TECHNOLOGY',
    'WATER',
    'WASTEWATER',
    'CROSS_DEPENDENCY',
  ];

  for (const infraId of infraIds) {
    const answers = answersByInfra[infraId];
    if (answers) {
      const triggered = evaluateVulnerabilities(infraId, answers);
      if (triggered.length > 0) {
        results[infraId] = triggered;
      }
    }
  }

  return results as Record<InfraId, TriggeredVulnerability[]>;
}
