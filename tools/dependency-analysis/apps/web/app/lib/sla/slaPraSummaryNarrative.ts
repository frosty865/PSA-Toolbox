/**
 * SLA/PRA summary narrative for report and Review & Export.
 * Two sentences per category: routine outage + widespread/disaster. No "N unverified" counts.
 */

import type {
  DependencyTopicKey,
  PriorityRestoration,
  PriorityRestorationTopic,
  SlaCategorization,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import {
  getTopicForBadge,
  topicLabel,
  DEFAULT_PRIORITY_RESTORATION,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';

export type SlaPraSummaryCategory =
  | 'Energy'
  | 'Communications'
  | 'Information Technology'
  | 'Water'
  | 'Wastewater';

export type SlaPraSummaryConfidence = 'documented' | 'assumed' | 'not_identified';

export type SlaPraSummaryItem = {
  category: SlaPraSummaryCategory;
  routine_outage_text: string;
  widespread_disaster_text: string;
  confidence: SlaPraSummaryConfidence;
};

const CANONICAL_ORDER: DependencyTopicKey[] = [
  'energy',
  'communications',
  'information_technology',
  'water',
  'wastewater',
];

function hasAnyReliabilityGap(sc: SlaCategorization): boolean {
  const keys = [
    'applies_in_widespread_events',
    'clock_trigger_defined',
    'activation_required_documented',
    'escalation_path_documented',
    'full_component_coverage',
    'restoration_validation_defined',
    'documentation_accessible',
  ] as const;
  return keys.some((k) => sc[k] === 'NO' || sc[k] === 'UNKNOWN');
}

function routineOutageSentence(
  slaInPlace: 'YES' | 'NO' | 'UNKNOWN',
  sc: SlaCategorization | undefined,
  confidence: SlaPraSummaryConfidence
): string {
  if (slaInPlace === 'YES') {
    if (confidence === 'documented') {
      return 'Routine outages: A service commitment is documented with clear restoration conditions for localized disruptions.';
    }
    return 'Routine outages: A service commitment exists, but some documentation gaps could affect how restoration is initiated or validated during outages.';
  }
  if (slaInPlace === 'NO') {
    return 'Routine outages: No service commitment was documented for localized disruptions.';
  }
  return 'Routine outages: A service commitment for localized disruptions was not identified.';
}

function widespreadDisasterSentence(
  praInPlace: boolean,
  praTier: string | null | undefined
): string {
  if (praInPlace && praTier && ['TIER_1', 'TIER_2', 'TIER_3'].includes(praTier)) {
    return 'Major events: Priority restoration is identified. Restoration may still follow utility emergency protocols.';
  }
  if (praInPlace) {
    return 'Major events: Priority restoration is identified; the priority tier was not specified.';
  }
  return 'Major events: Priority restoration was not documented. Restoration may follow general emergency protocols.';
}

/**
 * Build SLA/PRA summary items in canonical order (Energy, Communications, IT, Water, Wastewater).
 * Uses existing fields only; no new questions.
 */
export function buildSlaPraSummary(
  priorityRestoration: PriorityRestoration | undefined | null
): SlaPraSummaryItem[] {
  const pr = priorityRestoration ?? DEFAULT_PRIORITY_RESTORATION;
  const items: SlaPraSummaryItem[] = [];

  for (const topicKey of CANONICAL_ORDER) {
    const topic = getTopicForBadge(pr, topicKey);
    const raw = pr[topicKey] as PriorityRestorationTopic | undefined;
    const sc = (raw?.sla_categorization ?? topic?.sla_categorization) as SlaCategorization | undefined;

    const slaAssessed = sc?.assessed ?? topic?.sla_assessed ?? false;
    const slaInPlace: 'YES' | 'NO' | 'UNKNOWN' =
      sc?.sla_in_place ?? (topic?.paid_sla === true ? 'YES' : 'UNKNOWN');

    let confidence: SlaPraSummaryConfidence = 'not_identified';
    if (slaInPlace === 'YES' && sc) {
      const hasGaps = hasAnyReliabilityGap(sc);
      const docsOk = sc.documentation_accessible === 'YES' && (sc.notes?.trim() ?? '').length > 0;
      confidence = !hasGaps && docsOk ? 'documented' : 'assumed';
    } else if (slaInPlace === 'NO' || slaInPlace === 'UNKNOWN') {
      confidence = 'not_identified';
    }

    const routine_outage_text = routineOutageSentence(slaInPlace, sc, confidence);

    const praInPlace = raw?.federal_standard === true;
    const praTier = raw?.pra_category ?? null;
    const widespread_disaster_text = widespreadDisasterSentence(praInPlace, praTier);

    const category = topicLabel(topicKey) as SlaPraSummaryCategory;
    items.push({
      category,
      routine_outage_text,
      widespread_disaster_text,
      confidence,
    });
  }

  return items;
}
