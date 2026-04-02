"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOfcById, type Ofc } from '@/app/lib/ofcDataProvider';

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

function getStatusExplanation(status: Ofc['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'This OFC is in draft and has not been submitted for review.';
    case 'SUBMITTED':
      return 'This OFC has been submitted and is awaiting review by the governing body.';
    case 'UNDER_REVIEW':
      return 'This OFC is currently under review by the governing body.';
    case 'APPROVED':
      return 'This OFC has been approved by the governing body and is in effect.';
    case 'REJECTED':
      return 'This OFC was rejected by the governing body.';
    case 'RETIRED':
      return 'This OFC has been retired by the governing body.';
    case 'SUPERSEDED':
      return 'This OFC has been superseded by a newer approved version.';
    default:
      return '';
  }
}

export default function OfcDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ofcId = params.id as string;

  const [ofc, setOfc] = useState<Ofc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supersedingOfc, setSupersedingOfc] = useState<Ofc | null>(null);

  useEffect(() => {
    const loadOfc = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getOfcById(ofcId);
        if (!data) {
          setError('OFC not found');
          return;
        }

        setOfc(data);

        // If superseded, try to find the superseding OFC
        if (data.status === 'SUPERSEDED') {
          // Note: This would require a backend endpoint to find superseding OFC
          // For now, we'll just show the status
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load OFC'
        );
      } finally {
        setLoading(false);
      }
    };

    if (ofcId) {
      loadOfc();
    }
  }, [ofcId]);

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC Details</h2>
        </div>
        <div className="card">
          <p>Loading OFC...</p>
        </div>
      </section>
    );
  }

  if (error || !ofc) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">OFC Details</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error:</strong>
          <p>{error || 'OFC not found'}</p>
          <Link href="/field/ofcs" className="usa-button usa-button--outline">
            Back to OFCs
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h2 className="section-title">OFC Details</h2>
        <Link href="/field/ofcs" className="usa-button usa-button--outline">
          Back to OFCs
        </Link>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="grid-row grid-gap">
            <div className="tablet:grid-col-6">
              <strong>Status:</strong>
              <div style={{ marginTop: '0.5rem' }}>
                <span className={`status-badge status-${ofc.status.toLowerCase()}`}>
                  {getStatusLabel(ofc.status)}
                </span>
              </div>
              <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {getStatusExplanation(ofc.status)}
              </p>
            </div>
            <div className="tablet:grid-col-6">
              <strong>Version:</strong>
              <p>{ofc.version}</p>
            </div>
          </div>
        </div>

        {ofc.status === 'SUPERSEDED' && (
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <strong>Note:</strong> This OFC has been superseded by a newer version.
            {ofc.supersedes_ofc_id && (
              <div style={{ marginTop: '0.5rem' }}>
                <Link
                  href={`/field/ofcs/${ofc.supersedes_ofc_id}`}
                  className="usa-link"
                >
                  View newer version
                </Link>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <strong>OFC Statement:</strong>
          <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ofc.ofc_text}</p>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <strong>Rationale:</strong>
          <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ofc.rationale}</p>
          </div>
        </div>

        {ofc.context_conditions && (
          <div style={{ marginBottom: '1.5rem' }}>
            <strong>Context / Conditions:</strong>
            <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{ofc.context_conditions}</p>
            </div>
          </div>
        )}

        <div className="grid-row grid-gap" style={{ marginBottom: '1.5rem' }}>
          {ofc.submitted_at && (
            <div className="tablet:grid-col-6">
              <strong>Submitted:</strong>
              <p>
                {new Date(ofc.submitted_at).toLocaleString()}
                {ofc.submitted_by && ` by ${ofc.submitted_by}`}
              </p>
            </div>
          )}
          {ofc.approved_at && (
            <div className="tablet:grid-col-6">
              <strong>Approved:</strong>
              <p>
                {new Date(ofc.approved_at).toLocaleString()}
                {ofc.approved_by && ` by ${ofc.approved_by}`}
              </p>
            </div>
          )}
        </div>

        {ofc.decision_reason && (
          <div style={{ marginBottom: '1.5rem' }}>
            <strong>
              {ofc.status === 'REJECTED' ? 'Rejection Reason:' : 
               ofc.status === 'RETIRED' ? 'Retirement Reason:' : 
               'Decision Reason:'}
            </strong>
            <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{ofc.decision_reason}</p>
            </div>
          </div>
        )}

        {ofc.status === 'APPROVED' && (
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #ddd' }}>
            <Link
              href={`/field/ofcs/${ofc.ofc_root_id}/propose`}
              className="usa-button"
            >
              Propose Change to This OFC
            </Link>
          </div>
        )}
      </div>

      {/* UI GUARD: Field UI - No edit-in-place, no delete, no approve/reject/retire controls */}
      {/* This page is read-only. PSA cannot modify approved OFCs. */}

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
        }
      `}</style>
    </section>
  );
}

