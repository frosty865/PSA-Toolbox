/**
 * Dual-track SLA Reliability Summary: assessor vs stakeholder.
 * All text is generated programmatically from structured inputs. No free-text. No "gap" in stakeholder output.
 */

import type {
  DependencyTopicKey,
  PriorityRestoration,
  PriorityRestorationTopic,
  SlaFailureFlagKey,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import {
  getTopicForBadge,
  topicLabel,
  countSlaFailurePoints,
  DEFAULT_PRIORITY_RESTORATION,
  SLA_FAILURE_FLAG_KEYS,
  getDefaultSlaFailureFlags,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';

export type SlaReliabilityAudience = 'ASSESSOR' | 'STAKEHOLDER';

export type SlaInPlace = 'YES' | 'NO' | 'UNKNOWN';

/** Short labels for each SLA reliability condition (used in summary detail). */
export const SLA_RELIABILITY_CONDITION_LABELS: Record<SlaFailureFlagKey, string> = {
  regional_applicability: 'regional applicability',
  clock_defined: 'clock (start/stop) definition',
  activation_required_documented: 'activation/trigger requirements',
  escalation_defined: 'escalation path',
  full_component_coverage: 'full component coverage',
  restoration_validation_defined: 'restoration validation',
  tolerance_reviewed: 'tolerance/exclusions review',
  documentation_accessible: 'documentation accessibility',
};

/** Derived fields per topic for summary generation. All from structured SLA answers. */
export type SlaReliabilityDerived = {
  topic_label: string;
  sla_assessed: boolean;
  sla_in_place: SlaInPlace;
  sla_reliability_issue_count: number;
  /** Human-readable labels for conditions not met (for detailed summary). */
  reliability_condition_labels: string[];
};

/**
 * Return list of short labels for reliability conditions that are not documented (value !== 'yes').
 */
export function getSlaReliabilityConditionLabels(topic: PriorityRestorationTopic): string[] {
  const flags = topic.sla_failure_flags ?? getDefaultSlaFailureFlags();
  const labels: string[] = [];
  for (const key of SLA_FAILURE_FLAG_KEYS) {
    if (flags[key] !== 'yes') {
      labels.push(SLA_RELIABILITY_CONDITION_LABELS[key]);
    }
  }
  return labels;
}

/**
 * Build derived data for a topic from priority_restoration. Used for deterministic summary generation.
 */
export function getSlaReliabilityDerived(
  priorityRestoration: PriorityRestoration | undefined | null,
  topicKey: DependencyTopicKey
): SlaReliabilityDerived {
  const pr = priorityRestoration ?? DEFAULT_PRIORITY_RESTORATION;
  const topic = getTopicForBadge(pr, topicKey);
  const raw = pr[topicKey];
  const sc = raw && typeof raw === 'object' && 'sla_categorization' in raw ? (raw as { sla_categorization?: { assessed?: boolean; sla_in_place?: SlaInPlace } }).sla_categorization : undefined;

  const sla_assessed = sc?.assessed ?? topic.sla_assessed ?? false;
  const sla_in_place: SlaInPlace = sc?.sla_in_place ?? (topic.paid_sla ? 'YES' : 'UNKNOWN');
  const sla_reliability_issue_count =
    topic.paid_sla === true ? countSlaFailurePoints(topic) : 0;
  const reliability_condition_labels =
    topic.paid_sla === true ? getSlaReliabilityConditionLabels(topic) : [];

  return {
    topic_label: topicLabel(topicKey),
    sla_assessed,
    sla_in_place,
    sla_reliability_issue_count,
    reliability_condition_labels,
  };
}

/**
 * Format a list of condition labels for inclusion in the summary (e.g. "A, B, and C").
 */
function formatConditionList(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * Single source of truth for SLA reliability summary text.
 * Deterministic and reproducible from (topicLabel, reliabilityCount, audience, conditionLabels?).
 */
export function generateSlaReliabilitySummary(
  topicLabel: string,
  reliabilityCount: number,
  audience: SlaReliabilityAudience,
  conditionLabels: string[] = []
): string {
  if (reliabilityCount === 0) {
    return audience === 'ASSESSOR'
      ? `${topicLabel}: Service commitment is documented. No reliability limitations were identified.`
      : `${topicLabel}: Service commitment is in place. No limitations affecting restoration reliability were identified.`;
  }

  const conditionDetail =
    conditionLabels.length > 0 ? ` (${formatConditionList(conditionLabels)})` : '';

  if (audience === 'ASSESSOR') {
    const noun = reliabilityCount === 1 ? 'condition' : 'conditions';
    return `${topicLabel}: Service commitment is documented. ${reliabilityCount} ${noun} need clarification${conditionDetail}, which could affect restoration during major events.`;
  }

  const stakeholderDetail =
    conditionLabels.length > 0
      ? ` (${conditionLabels.length > 3 ? `e.g. ${formatConditionList(conditionLabels.slice(0, 3))} and others` : formatConditionList(conditionLabels)})`
      : '';
  return `${topicLabel}: Service commitment is in place. Some conditions${stakeholderDetail} may affect how reliably restoration occurs during major events.`;
}

/**
 * Returns the display string for SLA reliability per rendering rules.
 * - sla_assessed === false → "SLA not assessed"
 * - sla_assessed === true && sla_in_place !== "YES" → status only (No SLA documented / SLA unknown)
 * - sla_assessed === true && sla_in_place === "YES" → generateSlaReliabilitySummary(...)
 */
export function getSlaReliabilityDisplayText(
  derived: SlaReliabilityDerived,
  audience: SlaReliabilityAudience
): string {
  if (!derived.sla_assessed) {
    return 'SLA not assessed';
  }
  if (derived.sla_in_place !== 'YES') {
    return derived.sla_in_place === 'NO' ? 'No SLA documented' : 'SLA unknown';
  }
  return generateSlaReliabilitySummary(
    derived.topic_label,
    derived.sla_reliability_issue_count,
    audience,
    derived.reliability_condition_labels ?? []
  );
}
