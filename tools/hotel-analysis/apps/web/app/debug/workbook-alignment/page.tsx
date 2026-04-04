'use client';

import React from 'react';
import { UI_CONFIG } from 'schema';

/**
 * Dev-only: visual diff so you can point at the screen and say "this came from cell A8."
 * Disabled in production (see layout).
 */
export default function DebugWorkbookAlignmentPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>
      <div
        role="alert"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          background: 'var(--color-background-alt, #f0f0f0)',
          border: '1px solid var(--color-border, #ccc)',
          borderRadius: 4,
        }}
      >
        <strong>Labels must match Asset Dependency Visualization.xlsm exactly.</strong>
      </div>

      <h1 style={{ marginTop: 0 }}>Workbook alignment</h1>
      <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>
        Left: field key. Middle: label as rendered in the UI. Right: source (sheet + cell).
      </p>

      {UI_CONFIG.map((cat) => (
        <section key={cat.category} style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>{cat.title}</h2>
          {cat.table ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '22%' }}>column.key</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '48%' }}>Rendered UI label</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '30%' }}>label_source</th>
                </tr>
              </thead>
              <tbody>
                {cat.table.columns.map((col) => (
                  <tr key={col.key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                      <code style={{ fontSize: '0.8em' }}>{col.key}</code>
                    </td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                      <span className="form-label" style={{ fontWeight: 600 }}>{col.label}</span>
                    </td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top', color: '#555' }}>
                      {col.label_source.sheet} {col.label_source.cell}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '22%' }}>Key</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '48%' }}>Rendered UI label</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '30%' }}>label_source</th>
                </tr>
              </thead>
              <tbody>
                {cat.fields.map((f) => (
                  <tr key={f.key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                      <code style={{ fontSize: '0.8em' }}>{f.key}</code>
                    </td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                      <span className="form-label" style={{ fontWeight: 600 }}>
                        {f.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top', color: '#555' }}>
                      {f.label_source.sheet} {f.label_source.cell}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
