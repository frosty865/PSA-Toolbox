/**
 * Edge Classification Legend
 * Clarifies the meaning of Primary/Critical/Immediate for cross-dependency edges.
 */

import React from 'react';

export function EdgeLegend() {
  return (
    <div className="border rounded p-3 mb-3" style={{ background: 'var(--cisa-gray-lighter, #f1f1f2)' }}>
      <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', marginBottom: 'var(--spacing-sm)' }}>Edge Classification Terms</h4>
      <dl className="mb-0" style={{ fontSize: 'var(--font-size-sm)' }}>
        <dt style={{ fontWeight: 600 }}>Primary operations</dt>
        <dd className="text-secondary mb-2">
          Directly supports mission-essential operations.
        </dd>
        
        <dt style={{ fontWeight: 600 }}>Critical</dt>
        <dd className="text-secondary mb-2">
          Loss causes severe operational degradation.
        </dd>
        
        <dt style={{ fontWeight: 600 }}>Immediate</dt>
        <dd className="text-secondary mb-0">
          Impact occurs within 1 hour of service loss.
        </dd>
      </dl>
    </div>
  );
}
