'use client';

import React from 'react';
import { useAssessment } from '@/lib/assessment-context';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';

export function CrossDependencyToggle() {
  const { assessment, setAssessment } = useAssessment();
  const enabled = isCrossDependencyEnabled(assessment);

  const toggle = () => {
    setAssessment({
      ...assessment,
      settings: {
        ...assessment.settings,
        pra_sla_enabled: assessment.settings?.pra_sla_enabled === true,
        cross_dependency_enabled: !enabled,
      },
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
      }}
    >
      <span className="form-label mb-0" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
        Cross-Dependency:
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Cross-dependency ${enabled ? 'on' : 'off'}`}
        onClick={toggle}
        className="pra-sla-toggle"
      >
        <span
          className="pra-sla-toggle-thumb"
          style={{
            transform: enabled ? 'translateX(24px)' : 'translateX(0)',
          }}
        />
      </button>
      <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  );
}
