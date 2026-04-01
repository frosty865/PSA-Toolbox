'use client';

import React from 'react';

export interface InfraIntroBlockProps {
  title: string;
  purpose: string;
  includes: string[];
  excludes: string[];
  curveDriver: string;
}

export function InfraIntroBlock({
  title,
  purpose,
  includes,
  excludes,
  curveDriver,
}: InfraIntroBlockProps) {
  return (
    <div
      className="mb-4 p-3 border rounded"
      style={{
        backgroundColor: 'var(--cisa-gray-lighter, #f1f1f2)',
        borderColor: 'var(--cisa-gray-light, #d6d7d9)',
      }}
    >
      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>{title}</h3>
      
      <div className="mb-3">
        <strong>Purpose:</strong> {purpose}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }} className="mb-3">
        <div>
          <strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>Includes:</strong>
          <ul style={{ fontSize: 'var(--font-size-sm)', paddingLeft: 'var(--spacing-lg)', margin: 0 }}>
            {includes.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>Excludes:</strong>
          <ul style={{ fontSize: 'var(--font-size-sm)', paddingLeft: 'var(--spacing-lg)', margin: 0 }}>
            {excludes.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ fontSize: 'var(--font-size-sm)' }}>
        <strong>Curve driver:</strong> {curveDriver}
      </div>
    </div>
  );
}
