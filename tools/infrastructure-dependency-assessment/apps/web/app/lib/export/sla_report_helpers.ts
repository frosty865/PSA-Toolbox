/**
 * SLA/PRA report payload builders for export. Kept out of API route to satisfy Next.js route export constraints.
 */
import { getSlaReliabilityDerived, getSlaReliabilityDisplayText } from '@/app/lib/sla/slaReliabilitySummary';
import { buildSlaPraSummary } from '@/app/lib/sla/slaPraSummaryNarrative';
import {
  DEFAULT_PRIORITY_RESTORATION,
  getTopicForBadge,
  getSlaMttrMaxHours,
  type DependencyTopicKey,
  type PriorityRestoration,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';

const PRIORITY_RESTORATION_TOPICS: DependencyTopicKey[] = [
  'energy',
  'communications',
  'information_technology',
  'water',
  'wastewater',
];

const REPORT_TOPIC_LABEL: Record<DependencyTopicKey, string> = {
  energy: 'Electric Power',
  communications: 'Communications',
  information_technology: 'Information Technology',
  water: 'Water',
  wastewater: 'Wastewater',
};

/** Build SLA reliability payload for report: stakeholder text only when assessed and SLA in place. No "No SLA documented" when not assessed. */
export function buildSlaReliabilityForReport(assessment: { priority_restoration?: unknown }): Array<{
  topic_label: string;
  sla_assessed: boolean;
  sla_in_place: string;
  mttr_max_hours: number | null;
  summary_text: string | null;
}> {
  const pr = (assessment.priority_restoration ?? DEFAULT_PRIORITY_RESTORATION) as PriorityRestoration;
  return PRIORITY_RESTORATION_TOPICS.map((topicKey) => {
    const derived = getSlaReliabilityDerived(pr, topicKey);
    const topic = getTopicForBadge(pr, topicKey);
    const summary_text =
      derived.sla_assessed && derived.sla_in_place === 'YES'
        ? getSlaReliabilityDisplayText(derived, 'STAKEHOLDER')
        : null;
    const mttr =
      derived.sla_assessed && derived.sla_in_place === 'YES' ? getSlaMttrMaxHours(topic) : null;
    return {
      topic_label: REPORT_TOPIC_LABEL[topicKey],
      sla_assessed: derived.sla_assessed,
      sla_in_place: derived.sla_in_place,
      mttr_max_hours: mttr != null && Number.isFinite(mttr) ? mttr : null,
      summary_text,
    };
  });
}

/** Build SLA/PRA summary narrative items for DOCX. Two sentences per category; no "N unverified" language. */
export function buildSlaPraSummaryForReport(assessment: { priority_restoration?: unknown }): {
  items: Array<{ category: string; routine_outage_text: string; widespread_disaster_text: string; confidence: string }>;
} | null {
  const pr = (assessment.priority_restoration ?? DEFAULT_PRIORITY_RESTORATION) as PriorityRestoration;
  const items = buildSlaPraSummary(pr);
  return items.length > 0 ? { items } : null;
}
