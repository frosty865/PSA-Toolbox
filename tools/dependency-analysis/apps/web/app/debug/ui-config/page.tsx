'use client';

import React from 'react';
import { UI_CONFIG } from 'schema';

/**
 * Dev-only debug view: prove labels match XLSM.
 * Disabled in production (see layout).
 */
export default function DebugUiConfigPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
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
        <strong>Labels are sourced from Asset Dependency Visualization.xlsm and must match exactly.</strong>
      </div>

      <h1 style={{ marginTop: 0 }}>UI config (workbook source-of-truth)</h1>
      <p className="text-secondary">
        Each category and field shows key, label, label_source (sheet/cell), and help if any.
      </p>

      {UI_CONFIG.map((cat) => (
        <section key={cat.category} style={{ marginBottom: '2rem' }}>
          <h2>{cat.title}</h2>
          {cat.table ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>key</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>label</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>label_source</th>
                </tr>
              </thead>
              <tbody>
                {cat.table.columns.map((col) => (
                  <tr key={col.key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}><code>{col.key}</code></td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>{col.label}</td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                      {col.label_source.sheet} / {col.label_source.cell}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>key</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>label</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>label_source</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>help</th>
                </tr>
              </thead>
              <tbody>
                {cat.fields.map((f) => (
                  <tr key={f.key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}><code>{f.key}</code></td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>{f.label}</td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                      {f.label_source.sheet} / {f.label_source.cell}
                    </td>
                    <td style={{ padding: '0.5rem', verticalAlign: 'top', maxWidth: 280 }}>
                      {f.help ?? '—'}
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
