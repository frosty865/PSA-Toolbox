'use client';

import React from 'react';
import type { ExecutiveRiskPostureSnapshotVM } from '@/app/lib/report/snapshot_builder';

/**
 * Risk Posture Snapshot Display Component
 * 
 * Displays the executive risk posture snapshot with:
 * - Overall posture banner
 * - Key driver cards (3–6)
 * - Infrastructure sensitivity matrix
 * - Cascading indicator (if present)
 * 
 * NO calculations. Display only. All values pre-computed by engine.
 */

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: '#e31c3d',
  ELEVATED: '#fa9441',
  MODERATE: '#fdb81e',
};

interface RiskPostureSnapshotProps {
  snapshot: ExecutiveRiskPostureSnapshotVM;
}

/**
 * Color bar for sensitivity/cascade exposure.
 */
function SensitivityBar({
  value,
}: {
  value: string;
}) {
  const colorMap: Record<string, string> = {
    // Impact Sensitivity
    'Immediate': '#e31c3d',
    'Near-term': '#fa9441',
    'Tolerant': '#fdb81e',
    // Mitigation Depth
    'None': '#e31c3d',
    'Limited': '#fa9441',
    // NOTE: 'Moderate' removed due to duplicate with Cascade Exposure
    // TODO: Restructure to support context-sensitive color mapping
    'Sustained': '#00a91c',
    // Recovery Sensitivity
    'Extended': '#e31c3d',
    'Managed': '#fa9441',
    'Rapid': '#00a91c',
    // Cascade Exposure
    'High': '#e31c3d',
    'Moderate': '#fa9441',  // Used for both Mitigation and Cascade 'Moderate'
    'Low': '#00a91c',
  };

  return (
    <span
      style={{
        display: 'inline-block',
        paddingLeft: '0.5rem',
        paddingRight: '0.5rem',
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        borderRadius: '0.25rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        backgroundColor: colorMap[value] || '#ccc',
        color: 'white',
      }}
    >
      {value}
    </span>
  );
}

export function RiskPostureSnapshot({ snapshot }: RiskPostureSnapshotProps) {
  const { overallPosture, drivers, infraMatrix, cascadingIndicator } = snapshot;

  return (
    <div
      style={{
        border: '2px solid var(--cisa-gray-medium)',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--cisa-gray-lightest)',
        marginBottom: 'var(--spacing-xl)',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          marginBottom: 'var(--spacing-lg)',
          paddingBottom: 'var(--spacing-md)',
          borderBottom: '2px solid var(--cisa-gray-medium)',
        }}
      >
        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          Executive Risk Posture Snapshot
        </h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary)', margin: 0 }}>
          One-page summary of risk drivers, infrastructure sensitivity, and cascading exposure.
        </p>
      </div>

      {/* OVERALL POSTURE BANNER */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          marginBottom: 'var(--spacing-lg)',
        }}
      >
        <div
          style={{
            backgroundColor: '#f0f0f0',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--border-radius)',
            borderLeft: '4px solid var(--cisa-blue)',
          }}
        >
          <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
            Overall Risk Posture
          </h4>
          <p
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
              color: '#333',
            }}
          >
            {overallPosture}
          </p>
        </div>
      </div>

      {/* DRIVER STRIP */}
      {drivers.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
            Key Risk Drivers ({drivers.length})
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--spacing-md)',
            }}
          >
            {drivers.map((driver, idx) => (
              <div
                key={idx}
                style={{
                  border: `1px solid ${SEVERITY_COLORS[driver.severity] || '#ccc'}`,
                  borderRadius: 'var(--border-radius)',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'white',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: 0, flex: 1 }}>
                    {driver.title}
                  </h5>
                  <span
                    style={{
                      display: 'inline-block',
                      paddingLeft: '0.5rem',
                      paddingRight: '0.5rem',
                      paddingTop: '0.25rem',
                      paddingBottom: '0.25rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: SEVERITY_COLORS[driver.severity] || '#ccc',
                      color: 'white',
                      whiteSpace: 'nowrap',
                      marginLeft: '0.5rem',
                    }}
                  >
                    {driver.severity}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', lineHeight: 1.4, margin: '0.5rem 0 0 0', color: '#555' }}>
                  {driver.shortSummary}
                </p>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: '#888',
                    margin: '0.5rem 0 0 0',
                  }}
                >
                  Affects: {driver.infrastructures.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INFRASTRUCTURE SENSITIVITY MATRIX */}
      {infraMatrix.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
            Infrastructure Sensitivity Matrix
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--font-size-sm)',
                border: '1px solid var(--cisa-gray-light)',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--cisa-gray-light)' }}>
                  <th
                    style={{
                      padding: 'var(--spacing-sm)',
                      textAlign: 'left',
                      fontWeight: 600,
                      borderRight: '1px solid var(--cisa-gray-light)',
                    }}
                  >
                    Infrastructure
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-sm)',
                      textAlign: 'left',
                      fontWeight: 600,
                      borderRight: '1px solid var(--cisa-gray-light)',
                    }}
                  >
                    Impact Sensitivity
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-sm)',
                      textAlign: 'left',
                      fontWeight: 600,
                      borderRight: '1px solid var(--cisa-gray-light)',
                    }}
                  >
                    Mitigation Depth
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-sm)',
                      textAlign: 'left',
                      fontWeight: 600,
                      borderRight: '1px solid var(--cisa-gray-light)',
                    }}
                  >
                    Recovery Sensitivity
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-sm)',
                      textAlign: 'left',
                      fontWeight: 600,
                    }}
                  >
                    Cascade Exposure
                  </th>
                </tr>
              </thead>
              <tbody>
                {infraMatrix.map((row, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--cisa-gray-light)' }}>
                    <td
                      style={{
                        padding: 'var(--spacing-sm)',
                        fontWeight: 600,
                        borderRight: '1px solid var(--cisa-gray-light)',
                      }}
                    >
                      {row.infra}
                    </td>
                    <td
                      style={{
                        padding: 'var(--spacing-sm)',
                        borderRight: '1px solid var(--cisa-gray-light)',
                      }}
                    >
                      <SensitivityBar value={row.impactSensitivity} />
                    </td>
                    <td
                      style={{
                        padding: 'var(--spacing-sm)',
                        borderRight: '1px solid var(--cisa-gray-light)',
                      }}
                    >
                      <SensitivityBar value={row.mitigationDepth} />
                    </td>
                    <td
                      style={{
                        padding: 'var(--spacing-sm)',
                        borderRight: '1px solid var(--cisa-gray-light)',
                      }}
                    >
                      <SensitivityBar value={row.recoverySensitivity} />
                    </td>
                    <td style={{ padding: 'var(--spacing-sm)' }}>
                      <SensitivityBar value={row.cascadeExposure} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CASCADING INDICATOR */}
      {cascadingIndicator && (
        <div
          style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--spacing-md)',
          }}
        >
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
            Cross-Infrastructure Exposure
          </h4>
          <p style={{ fontSize: 'var(--font-size-sm)', margin: 0, lineHeight: 1.6 }}>
            {cascadingIndicator.summary}
          </p>
        </div>
      )}
    </div>
  );
}
