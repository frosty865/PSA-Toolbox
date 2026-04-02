"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMyOfcs, getApprovedOfcs, type Ofc } from '@/app/lib/ofcDataProvider';

function getStatusLabel(status: Ofc['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SUBMITTED':
      return 'Submitted for Review';
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

function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

export default function FieldOfcsDashboardPage() {
  const [myOfcs, setMyOfcs] = useState<Ofc[]>([]);
  const [approvedOfcs, setApprovedOfcs] = useState<Ofc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [myData, approvedData] = await Promise.all([
          getMyOfcs(),
          getApprovedOfcs(),
        ]);

        setMyOfcs(myData);
        setApprovedOfcs(approvedData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load OFCs'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (ofcId: string) => {
    try {
      setSubmittingId(ofcId);
      const { submitOfc } = await import('@/app/lib/ofcDataProvider');
      await submitOfc(ofcId);
      
      // Reload data
      const updated = await getMyOfcs();
      setMyOfcs(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit OFC');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC Nomination & Review</h2>
        </div>
        <div className="card">
          <p>Loading OFCs...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC Nomination & Review</h2>
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
        <h2 className="section-title">OFC Nomination & Review</h2>
        <div className="section-actions">
          <Link href="/field/ofcs/new" className="usa-button">
            Nominate New OFC
          </Link>
        </div>
      </div>

      {/* My Submissions Section */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>My Submissions</h3>
        {myOfcs.length === 0 ? (
          <p className="text-muted">None submitted</p>
        ) : (
          <div className="table-responsive">
            <table className="usa-table">
              <thead>
                <tr>
                  <th>OFC Statement</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myOfcs.map((ofc) => (
                  <tr key={ofc.ofc_id}>
                    <td>
                      <Link href={`/field/ofcs/${ofc.ofc_id}`}>
                        {truncateText(ofc.ofc_text)}
                      </Link>
                    </td>
                    <td>
                      <span className={`status-badge status-${ofc.status.toLowerCase()}`}>
                        {getStatusLabel(ofc.status)}
                      </span>
                    </td>
                    <td>
                      {ofc.submitted_at
                        ? new Date(ofc.submitted_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      {ofc.status === 'DRAFT' ? (
                        <button
                          className="usa-button usa-button--outline usa-button--small"
                          onClick={() => handleSubmit(ofc.ofc_id)}
                          disabled={submittingId === ofc.ofc_id}
                        >
                          {submittingId === ofc.ofc_id ? 'Submitting...' : 'Submit for Review'}
                        </button>
                      ) : (
                        <Link
                          href={`/field/ofcs/${ofc.ofc_id}`}
                          className="usa-button usa-button--outline usa-button--small"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approved OFCs Section */}
      <div className="card">
        <h3>Approved OFCs</h3>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Approved OFCs reflect governing body decisions.
        </p>
        {approvedOfcs.length === 0 ? (
          <p className="text-muted">No approved OFCs</p>
        ) : (
          <div className="table-responsive">
            <table className="usa-table">
              <thead>
                <tr>
                  <th>OFC Statement</th>
                  <th>Version</th>
                  <th>Approved</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedOfcs.map((ofc) => (
                  <tr key={ofc.ofc_id}>
                    <td>
                      <Link href={`/field/ofcs/${ofc.ofc_id}`}>
                        {truncateText(ofc.ofc_text)}
                      </Link>
                    </td>
                    <td>{ofc.version}</td>
                    <td>
                      {ofc.approved_at
                        ? new Date(ofc.approved_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <Link
                        href={`/field/ofcs/${ofc.ofc_id}`}
                        className="usa-button usa-button--outline usa-button--small"
                      >
                        View
                      </Link>
                      {ofc.status === 'APPROVED' && (
                        <Link
                          href={`/field/ofcs/${ofc.ofc_root_id}/propose`}
                          className="usa-button usa-button--outline usa-button--small"
                          style={{ marginLeft: '0.5rem' }}
                        >
                          Propose Change
                        </Link>
                      )}
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
        .status-draft {
          background-color: #f0f0f0;
          color: #333;
        }
        .status-submitted {
          background-color: #e6f2ff;
          color: #0066cc;
        }
        .status-under_review {
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

