"use client";

import { useEffect, useState } from 'react';

interface SampleOrphan {
  ofc_id: string;
  source_key: string;
  created_at: string | null;
}

interface IntegrityAuditResult {
  integrity_ok: boolean;
  total_citations: number;
  distinct_source_keys: number;
  total_sources_in_registry: number;
  missing_in_corpus: string[];
  missing_count: number;
  sample_orphans: SampleOrphan[];
}

export default function CitationIntegrityPanel() {
  const [auditData, setAuditData] = useState<IntegrityAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAudit() {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/citations/integrity-audit');
        if (!response.ok) {
          throw new Error(`Failed to fetch integrity audit: ${response.statusText}`);
        }
        const data = await response.json();
        setAuditData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchAudit();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
        <p style={{ margin: 0, color: 'var(--cisa-gray)' }}>Loading integrity audit...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ 
        padding: 'var(--spacing-lg)',
        border: '1px solid #dc2626',
        backgroundColor: '#fef2f2'
      }}>
        <h3 style={{ margin: '0 0 var(--spacing-sm) 0', color: '#dc2626' }}>
          ⚠️ Integrity Audit Error
        </h3>
        <p style={{ margin: 0, color: '#991b1b' }}>{error}</p>
      </div>
    );
  }

  if (!auditData) {
    return null;
  }

  const hasViolations = auditData.missing_count > 0;

  return (
    <div className="card" style={{ 
      padding: 'var(--spacing-lg)',
      border: hasViolations ? '2px solid #dc2626' : '1px solid var(--cisa-gray-light)',
      backgroundColor: hasViolations ? '#fef2f2' : '#ffffff',
      marginBottom: 'var(--spacing-lg)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-md)'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: hasViolations ? '#dc2626' : '#059669',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600
        }}>
          {hasViolations ? '⚠️ Citation Integrity Violations Detected' : '✅ Citation Integrity OK'}
        </h3>
      </div>

      {/* Summary Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        backgroundColor: '#f9fafb',
        borderRadius: 'var(--border-radius)'
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: '4px' }}>
            Total Citations
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--cisa-gray-dark)' }}>
            {auditData.total_citations.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: '4px' }}>
            Distinct Source Keys
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--cisa-gray-dark)' }}>
            {auditData.distinct_source_keys.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: '4px' }}>
            Sources in Registry
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--cisa-gray-dark)' }}>
            {auditData.total_sources_in_registry.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: '4px' }}>
            Missing Source Keys
          </div>
          <div style={{ 
            fontSize: 'var(--font-size-xl)', 
            fontWeight: 600, 
            color: hasViolations ? '#dc2626' : '#059669'
          }}>
            {auditData.missing_count.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Violations Section */}
      {hasViolations && (
        <>
          <div style={{ 
            marginBottom: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--border-radius)'
          }}>
            <h4 style={{ 
              margin: '0 0 var(--spacing-sm) 0', 
              color: '#991b1b',
              fontSize: 'var(--font-size-base)',
              fontWeight: 600
            }}>
              Missing Source Keys ({auditData.missing_in_corpus.length})
            </h4>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 'var(--spacing-xs)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              {auditData.missing_in_corpus.map((key) => (
                <code key={key} style={{
                  padding: '2px 8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #fca5a5',
                  borderRadius: '4px',
                  fontSize: 'var(--font-size-sm)',
                  color: '#991b1b',
                  fontFamily: 'monospace'
                }}>
                  {key}
                </code>
              ))}
            </div>
          </div>

          {/* Sample Orphans Table */}
          {auditData.sample_orphans.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ 
                margin: '0 0 var(--spacing-sm) 0', 
                color: '#991b1b',
                fontSize: 'var(--font-size-base)',
                fontWeight: 600
              }}>
                Sample Orphan Citations ({auditData.sample_orphans.length} of {auditData.missing_count} total)
              </h4>
              <div style={{ 
                overflowX: 'auto',
                border: '1px solid #fecaca',
                borderRadius: 'var(--border-radius)'
              }}>
                <table style={{ 
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fee2e2' }}>
                      <th style={{ 
                        padding: 'var(--spacing-sm)',
                        textAlign: 'left',
                        borderBottom: '1px solid #fecaca',
                        fontWeight: 600,
                        color: '#991b1b'
                      }}>
                        OFC ID
                      </th>
                      <th style={{ 
                        padding: 'var(--spacing-sm)',
                        textAlign: 'left',
                        borderBottom: '1px solid #fecaca',
                        fontWeight: 600,
                        color: '#991b1b'
                      }}>
                        Source Key
                      </th>
                      <th style={{ 
                        padding: 'var(--spacing-sm)',
                        textAlign: 'left',
                        borderBottom: '1px solid #fecaca',
                        fontWeight: 600,
                        color: '#991b1b'
                      }}>
                        Created At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.sample_orphans.map((orphan, idx) => (
                      <tr 
                        key={`${orphan.ofc_id}-${orphan.source_key}-${idx}`}
                        style={{ 
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fef2f2',
                          borderBottom: idx < auditData.sample_orphans.length - 1 ? '1px solid #fecaca' : 'none'
                        }}
                      >
                        <td style={{ padding: 'var(--spacing-sm)' }}>
                          <code style={{ 
                            fontFamily: 'monospace',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--cisa-gray-dark)'
                          }}>
                            {orphan.ofc_id}
                          </code>
                        </td>
                        <td style={{ padding: 'var(--spacing-sm)' }}>
                          <code style={{ 
                            fontFamily: 'monospace',
                            fontSize: 'var(--font-size-xs)',
                            color: '#dc2626',
                            fontWeight: 600
                          }}>
                            {orphan.source_key}
                          </code>
                        </td>
                        <td style={{ padding: 'var(--spacing-sm)', color: 'var(--cisa-gray)' }}>
                          {orphan.created_at 
                            ? new Date(orphan.created_at).toLocaleString()
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Remediation Instructions */}
          <div style={{ 
            padding: 'var(--spacing-md)',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde047',
            borderRadius: 'var(--border-radius)'
          }}>
            <h4 style={{ 
              margin: '0 0 var(--spacing-sm) 0', 
              color: '#92400e',
              fontSize: 'var(--font-size-base)',
              fontWeight: 600
            }}>
              🔧 Remediation Instructions
            </h4>
            <p style={{ 
              margin: 0, 
              color: '#78350f',
              fontSize: 'var(--font-size-sm)',
              lineHeight: 1.6
            }}>
              Fix integrity violations by either:
            </p>
            <ul style={{ 
              margin: 'var(--spacing-sm) 0 0 0', 
              paddingLeft: 'var(--spacing-lg)',
              color: '#78350f',
              fontSize: 'var(--font-size-sm)',
              lineHeight: 1.8
            }}>
              <li><strong>Re-add missing sources:</strong> Create entries in CORPUS <code>source_registry</code> for the missing <code>source_key</code> values listed above.</li>
              <li><strong>Remove/update citations:</strong> Delete or update citations in RUNTIME <code>ofc_library_citations</code> that reference non-existent source keys.</li>
            </ul>
            <p style={{ 
              margin: 'var(--spacing-sm) 0 0 0', 
              color: '#78350f',
              fontSize: 'var(--font-size-sm)',
              fontStyle: 'italic'
            }}>
              Use the <strong>Source Registry</strong> admin page to manage sources, or query RUNTIME database directly to fix citations.
            </p>
          </div>
        </>
      )}

      {/* Refresh Button */}
      <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            fetch('/api/admin/citations/integrity-audit')
              .then(res => res.json())
              .then(data => {
                setAuditData(data);
                setLoading(false);
              })
              .catch(err => {
                setError(err.message);
                setLoading(false);
              });
          }}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: 'var(--cisa-blue)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0050d4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cisa-blue)';
          }}
        >
          🔄 Refresh Audit
        </button>
      </div>
    </div>
  );
}
