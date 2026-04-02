"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getOfcHistory, type AdminOfc } from '@/app/lib/adminOfcDataProvider';

function getStatusLabel(status: AdminOfc['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'RETIRED':
      return 'Retired';
    case 'SUPERSEDED':
      return 'Superseded';
    default:
      return status;
  }
}

export default function AdminOfcHistoryPage() {
  const params = useParams();
  const rootId = params.rootId as string;

  const [history, setHistory] = useState<AdminOfc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getOfcHistory(rootId);
        setHistory(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load OFC history'
        );
      } finally {
        setLoading(false);
      }
    };

    if (rootId) {
      loadHistory();
    }
  }, [rootId]);

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC History</h2>
        </div>
        <div className="card">
          <p>Loading history...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC History</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error:</strong>
          <p>{error}</p>
          <Link href="/admin/ofcs" className="usa-button usa-button--outline">
            Back to Review Queue
          </Link>
        </div>
      </section>
    );
  }

  if (history.length === 0) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC History</h2>
        </div>
        <div className="card">
          <p className="text-muted">No history found for this OFC root.</p>
          <Link href="/admin/ofcs" className="usa-button usa-button--outline">
            Back to Review Queue
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h2 className="section-title">OFC History</h2>
        <Link href="/admin/ofcs" className="usa-button usa-button--outline">
          Back to Review Queue
        </Link>
      </div>

      <div className="card">
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          Complete audit trail for OFC Root ID: {rootId}
        </p>

        <div className="table-responsive">
          <table className="usa-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>OFC Statement</th>
                <th>Submitted</th>
                <th>Approved</th>
                <th>Decision Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((ofc) => (
                <tr key={ofc.ofc_id}>
                  <td>{ofc.version}</td>
                  <td>
                    <span className={`status-badge status-${ofc.status.toLowerCase().replace('_', '-')}`}>
                      {getStatusLabel(ofc.status)}
                    </span>
                    {ofc.supersedes_ofc_id && (
                      <span className="usa-tag" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        Supersedes
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ofc.ofc_text.substring(0, 100)}
                      {ofc.ofc_text.length > 100 ? '...' : ''}
                    </div>
                  </td>
                  <td>
                    {ofc.submitted_at ? (
                      <div>
                        <div>{new Date(ofc.submitted_at).toLocaleDateString()}</div>
                        {ofc.submitted_by && (
                          <div style={{ fontSize: '0.875rem', color: '#666' }}>
                            by {ofc.submitted_by.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {ofc.approved_at ? (
                      <div>
                        <div>{new Date(ofc.approved_at).toLocaleDateString()}</div>
                        {ofc.approved_by && (
                          <div style={{ fontSize: '0.875rem', color: '#666' }}>
                            by {ofc.approved_by.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {ofc.decision_reason ? (
                      <div style={{ maxWidth: '200px', fontSize: '0.875rem' }}>
                        {ofc.decision_reason.substring(0, 100)}
                        {ofc.decision_reason.length > 100 ? '...' : ''}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/admin/ofcs/${ofc.ofc_id}`}
                      className="usa-button usa-button--outline usa-button--small"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .status-draft {
          background-color: #f0f0f0;
          color: #333;
        }
        .status-submitted {
          background-color: #e6f2ff;
          color: #0066cc;
        }
        .status-under-review {
          background-color: #fff4e6;
          color: #cc6600;
        }
        .status-approved {
          background-color: #e6ffe6;
          color: #006600;
        }
        .status-rejected {
          background-color: #ffe6e6;
          color: #cc0000;
        }
        .status-retired {
          background-color: #f0f0f0;
          color: #666;
        }
        .status-superseded {
          background-color: #f0f0f0;
          color: #666;
        }
        .text-muted {
          color: #666;
          font-style: italic;
        }
      `}</style>
    </section>
  );
}

