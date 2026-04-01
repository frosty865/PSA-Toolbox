'use client';

import React, { useState } from 'react';
import { resolveThemedFindings } from '@/app/lib/dependencies/vulnerabilities/resolveThemes';
import { resolveKnowledgeGaps } from '@/app/lib/dependencies/knowledge_gaps/resolveGaps';
import type { ThemeResolverInput } from '@/app/lib/dependencies/vulnerabilities/themeTypes';
import type { GapResolverInput } from '@/app/lib/dependencies/knowledge_gaps/gapTypes';
import { useAssessment } from '@/lib/assessment-context';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';

const CATEGORY_MAP = {
  ELECTRIC_POWER: 'ENERGY' as const,
  COMMUNICATIONS: 'COMMUNICATIONS' as const,
  INFORMATION_TECHNOLOGY: 'INFORMATION_TECHNOLOGY' as const,
  WATER: 'WATER' as const,
  WASTEWATER: 'WASTEWATER' as const,
};
/** Assessment categories use ELECTRIC_POWER; theme/gap use ENERGY. */
const THEME_TO_ASSESSMENT_CATEGORY: Record<string, 'ELECTRIC_POWER' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER'> = {
  ENERGY: 'ELECTRIC_POWER',
  COMMUNICATIONS: 'COMMUNICATIONS',
  INFORMATION_TECHNOLOGY: 'INFORMATION_TECHNOLOGY',
  WATER: 'WATER',
  WASTEWATER: 'WASTEWATER',
};

export type FindingsSummaryPanelProps = {
  category: keyof typeof CATEGORY_MAP;
  answers: Record<string, unknown>;
};

function severityLabel(s: string): string {
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM') return 'MED';
  if (s === 'LOW') return 'LOW';
  return s;
}

export function FindingsSummaryPanel({ category, answers }: FindingsSummaryPanelProps) {
  const { assessment } = useAssessment();
  const praSlaEnabled = isPraSlaEnabled(assessment);
  const themeCategory = CATEGORY_MAP[category];
  if (!themeCategory) return null;

  const themeInput: ThemeResolverInput = { category: themeCategory, answers, praSlaEnabled };
  const categoryKey = THEME_TO_ASSESSMENT_CATEGORY[themeCategory];
  const categoryData = (categoryKey && assessment?.categories?.[categoryKey]) as GapResolverInput['categoryInput'] | undefined;
  const gapInput: GapResolverInput = { category: themeCategory, answers, categoryInput: categoryData };
  const themes = resolveThemedFindings(themeInput);
  const gaps = resolveKnowledgeGaps(gapInput);

  const [themesExpanded, setThemesExpanded] = useState(false);
  const [gapsExpanded, setGapsExpanded] = useState(false);

  if (themes.length === 0 && gaps.length === 0) return null;

  return (
    <div
      className="mb-4 p-3 border rounded"
      style={{
        borderColor: 'var(--cisa-gray-light)',
        backgroundColor: 'var(--cisa-gray-lightest, #f8f9fa)',
        borderLeft: '4px solid var(--cisa-gray)',
      }}
      role="region"
      aria-labelledby="findings-summary-heading"
    >
      <h4 id="findings-summary-heading" className="mb-2" style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
        Summary
      </h4>

      {themes.length > 0 && (
        <div className="mb-2">
          <button
            type="button"
            style={{ fontWeight: 600, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-sm)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setThemesExpanded(!themesExpanded)}
            aria-expanded={themesExpanded}
          >
            <span>Structural findings: {themes.length}</span>
            <span aria-hidden>{themesExpanded ? '▼' : '▶'}</span>
          </button>
          {themesExpanded && (
            <ul style={{ marginTop: 'var(--spacing-sm)', listStyle: 'none', paddingLeft: 0, margin: 0 }}>
              {themes.map((t) => (
                <li key={t.id} style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <strong>{t.title}</strong>
                  <p className="mb-0 text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
                    {t.narrative}
                  </p>
                  {t.evidence?.length > 0 && (
                    <span className="text-secondary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)', display: 'inline-block' }}>
                      Source notes: {t.evidence.map((e) => e.question_id).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          <button
            type="button"
            style={{ fontWeight: 600, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-sm)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setGapsExpanded(!gapsExpanded)}
            aria-expanded={gapsExpanded}
          >
            <span>Knowledge gaps: {gaps.length}</span>
            <span aria-hidden>{gapsExpanded ? '▼' : '▶'}</span>
          </button>
          {gapsExpanded && (
            <ul style={{ marginTop: 'var(--spacing-sm)', listStyle: 'none', paddingLeft: 0, margin: 0 }}>
              {gaps.map((g) => (
                <li key={g.id} style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: 'calc(var(--spacing-xs) / 2) var(--spacing-xs)',
                      borderRadius: 'var(--border-radius)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      marginRight: 'var(--spacing-sm)',
                      backgroundColor:
                        g.severity === 'HIGH'
                          ? 'var(--cisa-red-lightest, #fde8e8)'
                          : g.severity === 'MEDIUM'
                            ? 'var(--cisa-amber-lightest, #fef9e7)'
                            : 'var(--cisa-gray-lightest)',
                      color:
                        g.severity === 'HIGH'
                          ? 'var(--cisa-red)'
                          : g.severity === 'MEDIUM'
                            ? 'var(--cisa-amber)'
                            : 'var(--cisa-gray)',
                    }}
                  >
                    {severityLabel(g.severity)}
                  </span>
                  <strong>{g.title}</strong> — {g.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
