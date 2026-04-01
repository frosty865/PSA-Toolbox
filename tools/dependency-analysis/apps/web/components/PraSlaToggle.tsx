'use client';

import React, { useState, useEffect } from 'react';
import { useAssessment } from '@/lib/assessment-context';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';

export function PraSlaToggle() {
  const { assessment, setAssessment } = useAssessment();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const enabled = isPraSlaEnabled(assessment);

  const toggle = () => {
    setAssessment({
      ...assessment,
      settings: {
        ...assessment.settings,
        pra_sla_enabled: !enabled,
        cross_dependency_enabled: assessment.settings?.cross_dependency_enabled === true,
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
      suppressHydrationWarning
    >
      <span className="form-label mb-0" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
        PRA/SLA:
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`PRA/SLA ${enabled ? 'on' : 'off'}`}
        onClick={toggle}
        className="pra-sla-toggle"
        suppressHydrationWarning
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
