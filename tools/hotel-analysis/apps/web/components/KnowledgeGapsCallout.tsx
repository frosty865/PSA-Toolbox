'use client';

import React, { useState } from 'react';
import { resolveKnowledgeGaps } from '@/app/lib/dependencies/knowledge_gaps/resolveGaps';
import type { GapResolverInput } from '@/app/lib/dependencies/knowledge_gaps/gapTypes';

const CATEGORY_MAP = {
  ELECTRIC_POWER: 'ENERGY' as const,
  COMMUNICATIONS: 'COMMUNICATIONS' as const,
  INFORMATION_TECHNOLOGY: 'INFORMATION_TECHNOLOGY' as const,
  WATER: 'WATER' as const,
  WASTEWATER: 'WASTEWATER' as const,
};

export type KnowledgeGapsCalloutProps = {
  category: keyof typeof CATEGORY_MAP;
  answers: Record<string, unknown>;
};

export function KnowledgeGapsCallout({ category, answers }: KnowledgeGapsCalloutProps) {
  const themeCategory = CATEGORY_MAP[category];
  if (!themeCategory) return null;

  const input: GapResolverInput = { category: themeCategory, answers };
  const gaps = resolveKnowledgeGaps(input);

  const [expanded, setExpanded] = useState(false);

  if (gaps.length === 0) return null;

  return (
    <div
      className="mb-4 p-3 border rounded"
      style={{ borderColor: 'var(--cisa-amber-light, #f5c842)', backgroundColor: 'var(--cisa-amber-lightest, #fef9e7)', borderLeft: '4px solid var(--cisa-amber, #f5c842)' }}
      role="region"
      aria-labelledby="knowledge-gaps-heading"
    >
      <button
        type="button"
        id="knowledge-gaps-heading"
        style={{ fontWeight: 600, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-sm)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span>Knowledge gaps identified: {gaps.length}</span>
        <span aria-hidden>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <ul style={{ marginTop: 'var(--spacing-sm)', listStyle: 'none', paddingLeft: 0, margin: 0 }}>
          {gaps.map((g) => (
            <li key={g.id} style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
              <strong>{g.title}</strong> — {g.description}
              {g.question_ids.length > 0 && (
                <span className="text-secondary ml-1">&nbsp;(Q: {g.question_ids.join(', ')})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
