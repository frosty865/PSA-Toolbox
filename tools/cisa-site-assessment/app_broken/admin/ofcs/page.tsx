"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getReviewQueue, type AdminOfc } from '@/app/lib/adminOfcDataProvider';

function getStatusLabel(status: AdminOfc['status']): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'UNDER_REVIEW':
      return 'Under Review';
    default:
      return status;
  }
}

function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

export default function AdminOfcsDashboardPage() {
  const [reviewQueue, setReviewQueue] = useState<AdminOfc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const queue = await getReviewQueue();
        setReviewQueue(queue);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load review queue'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC Governance</h2>
        </div>
        <div className="card">
          <p>Loading review queue...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC Governance</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error:</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h2 className="section-title">OFC Governance</h2>
      </div>

      <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
        <strong>Governance Notice:</strong>
        <p>
          Governance actions are authoritative. All decisions are recorded and immutable.
        </p>
      </div>

      {/* Review Queue Section */}
      <div className="card">
        <h3>Review Queue</h3>
        {reviewQueue.length === 0 ? (
          <p className="text-muted">No items in review queue</p>
        ) : (
          <div className="table-responsive">
            <table className="usa-table">
              <thead>
                <tr>
                  <th>OFC Statement</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Submitted By</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map((ofc) => (
                  <tr key={ofc.ofc_id}>
                    <td>
                      <Link href={`/admin/ofcs/${ofc.ofc_id}`}>
                        {truncateText(ofc.ofc_text)}
                      </Link>
                      {ofc.supersedes_ofc_id && (
                        <span
                          className="usa-tag"
                          style={{
                            marginLeft: '0.5rem',
                            backgroundColor: '#005ea2',
                            color: 'white',
                          }}
                        >
                          Supersedes
                        </span>
                      )}
                    </td>
                    <td>{ofc.version}</td>
                    <td>
                      <span className={`status-badge status-${ofc.status.toLowerCase().replace('_', '-')}`}>
                        {getStatusLabel(ofc.status)}
                      </span>
                    </td>
                    <td>{ofc.submitted_by || '—'}</td>
                    <td>
                      {ofc.submitted_at
                        ? new Date(ofc.submitted_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <Link
                        href={`/admin/ofcs/${ofc.ofc_id}`}
                        className="usa-button usa-button--outline usa-button--small"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .status-submitted {
          background-color: #e6f2ff;
          color: #0066cc;
        }
        .status-under-review {
          background-color: #fff4e6;
          color: #cc6600;
        }
        .text-muted {
          color: #666;
          font-style: italic;
        }
      `}</style>
    </section>
  );
}

