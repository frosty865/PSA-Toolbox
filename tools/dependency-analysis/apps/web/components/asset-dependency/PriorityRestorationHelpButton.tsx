'use client';

import React, { useState } from 'react';
import {
  DEFAULT_PRIORITY_RESTORATION,
  type PriorityRestoration,
  type PriorityRestorationTopicKey,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { PriorityRestorationHelpModal } from './PriorityRestorationHelpModal';

const TOPIC_KEYS: PriorityRestorationTopicKey[] = [
  'energy',
  'communications',
  'information_technology',
  'water',
  'wastewater',
];

const TOPIC_LABELS: Record<PriorityRestorationTopicKey, string> = {
  energy: 'Energy',
  communications: 'Communications',
  information_technology: 'Information Technology',
  water: 'Water',
  wastewater: 'Wastewater',
};

export type PriorityRestorationHelpButtonProps = {
  /** Which dependency topic this button opens. */
  topicKey: PriorityRestorationTopicKey;
  /** Current state for all topics (or a subset). Missing keys use defaults. */
  value?: Partial<PriorityRestoration>;
  /** Callback when any topic is updated. Parent should persist. */
  onChange?: (next: PriorityRestoration) => void;
  showNotes?: boolean;
  warningText?: string;
};

/**
 * Example integration: a "Priority Restoration & SLA" help button that opens the
 * help panel in a modal for the given topic. Use one per dependency section
 * (Energy, Communications, IT, Water, Wastewater) with the matching topicKey.
 *
 * Parent can hold state: const [pr, setPr] = useState(DEFAULT_PRIORITY_RESTORATION)
 * and pass value={pr} onChange={setPr} topicKey="energy" (etc.).
 */
export function PriorityRestorationHelpButton(props: PriorityRestorationHelpButtonProps) {
  const { topicKey, value, onChange, showNotes = true, warningText } = props;
  const [open, setOpen] = useState(false);

  const fullValue = {
    ...DEFAULT_PRIORITY_RESTORATION,
    ...value,
  };
  const topicValue = fullValue[topicKey] ?? {
    federal_standard: false,
    paid_sla: false,
    sla_assessed: false,
    sla_mttr_max_hours: null,
    sla_mttr_max_source: 'unknown',
    sla_mttr_max_notes: '',
    notes: '',
  };

  const handleTopicChange = (next: typeof topicValue) => {
    onChange?.({
      ...fullValue,
      [topicKey]: next,
    });
  };

  return (
    <>
      <button
        type="button"
        className="ida-btn ida-btn-primary"
        onClick={() => setOpen(true)}
        aria-label={`Add Priority Restoration and Service Level Agreement — ${TOPIC_LABELS[topicKey]}`}
      >
        Add Priority Restoration and Service Level Agreement
      </button>
      {open && (
        <PriorityRestorationHelpModal
          topicKey={topicKey}
          value={topicValue}
          onChange={handleTopicChange}
          onClose={() => setOpen(false)}
          showNotes={showNotes}
          warningText={warningText}
        />
      )}
    </>
  );
}

export { TOPIC_KEYS, TOPIC_LABELS };
