'use client';

import React from 'react';
import type { Assessment } from 'schema';
import type { ReportVM } from '@/app/lib/report/view_model';

/**
 * Synthesis Preview: Shows synthesis sections from reportVM (real data).
 * When assessment is not completed (no key risk drivers), shows empty state only.
 */
export function SynthesisPreview({
  assessment,
  reportVM,
  showHelp,
}: {
  assessment: Assessment;
  reportVM: ReportVM | null;
  showHelp: boolean;
}) {
  const synthesis = reportVM?.synthesis;
  const hasSynthesisData = (synthesis?.sections?.length ?? 0) > 0;

  if (!hasSynthesisData || !synthesis) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          border: '1px solid var(--cisa-gray-light)',
          borderRadius: 'var(--border-radius)',
          color: 'var(--color-secondary)',
          fontSize: 'var(--font-size-sm)',
          textAlign: 'center',
        }}
      >
        Complete the dependency assessment to see synthesis and risk posture classification.
      </div>
    );
  }

  const sections = synthesis.sections ?? [];
  if (sections.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          border: '1px solid var(--cisa-gray-light)',
          borderRadius: 'var(--border-radius)',
          color: 'var(--color-secondary)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        Complete the dependency assessment to see synthesis and risk posture classification.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {sections.map((section, idx) => (
        <div
          key={idx}
          style={{
            padding: 'var(--spacing-md)',
            border: '1px solid var(--cisa-gray-light)',
            borderLeft: `4px solid ${idx === sections.length - 1 ? 'var(--color-danger)' : 'var(--color-primary)'}`,
            borderRadius: 'var(--border-radius)',
          }}
        >
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
            {section.heading}
          </h5>
          {section.paragraphs?.map((p, pidx) => (
            <p
              key={pidx}
              style={{ fontSize: 'var(--font-size-sm)', margin: pidx ? '0.5rem 0 0 0' : 0, lineHeight: 1.6, color: 'var(--color-secondary)' }}
            >
              {p.text}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
