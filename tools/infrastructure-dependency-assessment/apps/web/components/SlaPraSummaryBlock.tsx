'use client';

import React from 'react';
import type { SlaPraSummaryItem } from '@/app/lib/sla/slaPraSummaryNarrative';

export const SLA_PRA_SUMMARY_TITLE = 'Service Restoration Reliability Summary';

type Props = {
  data?: { items: SlaPraSummaryItem[] } | null;
};

/**
 * Renders SLA/PRA summary as a bullet list. Shown in Review & Export and in DOCX.
 * If data absent or empty, renders nothing.
 */
export function SlaPraSummaryBlock({ data }: Props) {
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="mt-3 p-3" style={{ border: '1px solid var(--cisa-gray-light)', borderRadius: 'var(--border-radius)' }}>
      <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>
        {SLA_PRA_SUMMARY_TITLE}
      </h4>
      <ul className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', margin: 0, paddingLeft: '1.25rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {items.map((item) => (
          <li key={item.category} style={{ marginBottom: '0.25rem' }}>
            <strong>{item.category}:</strong> {item.routine_outage_text} {item.widespread_disaster_text}
          </li>
        ))}
      </ul>
    </div>
  );
}
