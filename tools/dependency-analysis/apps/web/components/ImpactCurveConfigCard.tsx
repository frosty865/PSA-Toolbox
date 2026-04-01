'use client';

import React from 'react';

const IMPACT_CURVE_CARD_STYLE: React.CSSProperties = {
  background: 'var(--cisa-blue-lightest)',
  border: '1px solid var(--cisa-gray-light)',
  borderLeft: '4px solid var(--cisa-blue-lighter)',
  borderRadius: 'var(--border-radius)',
  padding: '1rem 1.25rem',
  marginBottom: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

export function ImpactCurveConfigCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={IMPACT_CURVE_CARD_STYLE} role="region" aria-labelledby="impact-curve-config-heading">
      <h3 id="impact-curve-config-heading" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>
        Impact Curve Configuration
      </h3>
      {children}
    </div>
  );
}
