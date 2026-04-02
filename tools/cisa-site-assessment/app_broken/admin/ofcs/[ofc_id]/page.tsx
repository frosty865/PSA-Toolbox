"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getOfcForReview,
  approveOfc,
  rejectOfc,
  requestRevision,
  type AdminOfc,
  type ApproveOfcRequest,
  type RejectOfcRequest,
  type RequestRevisionRequest,
} from '@/app/lib/adminOfcDataProvider';

export default function AdminOfcReviewPage() {
  const params = useParams();
  const router = useRouter();
  const ofcId = params.ofc_id as string;

  const [ofc, setOfc] = useState<AdminOfc | null>(null);
  const [supersededOfc, setSupersededOfc] = useState<AdminOfc | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);

  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [revisionReason, setRevisionReason] = useState('');

  useEffect(() => {
    const loadOfc = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getOfcForReview(ofcId);
        if (!data) {
          setError('OFC not found or not available for review');
          return;
        }

        setOfc(data);

        // If this OFC supersedes another, try to load it
        if (data.supersedes_ofc_id) {
          // Note: This would require a GET endpoint for individual OFCs
          // For now, we'll note it but not load the full OFC
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

  const handleApprove = async () => {
    if (!ofc) return;

    try {
      setProcessing(true);
      setError(null);

      const request: ApproveOfcRequest = {
        notes: approveNotes.trim() || undefined,
      };

      await approveOfc(ofc.ofc_id, request);
      router.push('/admin/ofcs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve OFC');
      setShowApproveDialog(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    // UI GUARD: decision_reason is REQUIRED for reject
    if (!ofc || !rejectReason.trim()) {
      setError('Decision reason is required');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const request: RejectOfcRequest = {
        decision_reason: rejectReason.trim(),
      };

      await rejectOfc(ofc.ofc_id, request);
      router.push('/admin/ofcs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject OFC');
      setShowRejectDialog(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestRevision = async () => {
    // UI GUARD: decision_reason is REQUIRED for request revision
    if (!ofc || !revisionReason.trim()) {
      setError('Decision reason is required');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const request: RequestRevisionRequest = {
        decision_reason: revisionReason.trim(),
      };

      await requestRevision(ofc.ofc_id, request);
      router.push('/admin/ofcs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request revision');
      setShowRevisionDialog(false);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Review OFC</h2>
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
          <h2 className="section-title">Review OFC</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error:</strong>
          <p>{error || 'OFC not found'}</p>
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
        <h2 className="section-title">Review OFC</h2>
        <Link href="/admin/ofcs" className="usa-button usa-button--outline">
          Back to Review Queue
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <strong>Error:</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="grid-row grid-gap">
            <div className="tablet:grid-col-6">
              <strong>Status:</strong>
              <div style={{ marginTop: '0.5rem' }}>
                <span className={`status-badge status-${ofc.status.toLowerCase().replace('_', '-')}`}>
                  {ofc.status === 'SUBMITTED' ? 'Submitted' : 'Under Review'}
                </span>
              </div>
            </div>
            <div className="tablet:grid-col-6">
              <strong>Version:</strong>
              <p>{ofc.version}</p>
            </div>
          </div>
        </div>

        {ofc.supersedes_ofc_id && (
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <strong>Note:</strong> This OFC supersedes an approved OFC (ID: {ofc.supersedes_ofc_id}).
            If approved, the previous version will be marked as SUPERSEDED.
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
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #ddd' }}>
          <Link
            href={`/admin/ofcs/${ofc.ofc_root_id}/history`}
            className="usa-link"
          >
            View full history
          </Link>
        </div>
      </div>

      {/* UI GUARD: Admin UI - No create OFC controls, no text editing */}
      {/* All content is read-only. Only status transitions allowed. */}
      
      {/* Decision Controls */}
      <div className="card">
        <h3>Decision</h3>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          Select an action below. All decisions are recorded and immutable.
        </p>

        <div className="grid-row grid-gap">
          <div className="tablet:grid-col-4">
            <button
              className="usa-button usa-button--success"
              onClick={() => setShowApproveDialog(true)}
              disabled={processing}
              // UI GUARD: Button disabled during processing to prevent double-submission
            >
              Approve
            </button>
          </div>
          <div className="tablet:grid-col-4">
            <button
              className="usa-button usa-button--secondary"
              onClick={() => setShowRejectDialog(true)}
              disabled={processing}
            >
              Reject
            </button>
          </div>
          <div className="tablet:grid-col-4">
            <button
              className="usa-button usa-button--outline"
              onClick={() => setShowRevisionDialog(true)}
              disabled={processing}
            >
              Request Revision
            </button>
          </div>
        </div>
      </div>

      {/* Approve Dialog */}
      {showApproveDialog && (
        <div className="usa-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="usa-modal" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="usa-modal-content">
              <div className="usa-modal-header">
                <h3>Approve OFC</h3>
              </div>
              <div className="usa-modal-body">
                <p>Are you sure you want to approve this OFC?</p>
                <div className="usa-form-group">
                  <label htmlFor="approve-notes" className="usa-label">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="approve-notes"
                    className="usa-textarea"
                    rows={3}
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    placeholder="Optional notes about this approval..."
                  />
                </div>
              </div>
              <div className="usa-modal-footer">
                <button
                  className="usa-button usa-button--success"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? 'Approving...' : 'Confirm Approve'}
                </button>
                <button
                  className="usa-button usa-button--outline"
                  onClick={() => {
                    setShowApproveDialog(false);
                    setApproveNotes('');
                  }}
                  disabled={processing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="usa-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="usa-modal" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="usa-modal-content">
              <div className="usa-modal-header">
                <h3>Reject OFC</h3>
              </div>
              <div className="usa-modal-body">
                <p>Decision reason is required.</p>
                <div className="usa-form-group">
                  <label htmlFor="reject-reason" className="usa-label">
                    Decision Reason <span className="text-red">*</span>
                  </label>
                  <textarea
                    id="reject-reason"
                    className="usa-textarea"
                    rows={4}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this OFC is being rejected..."
                  />
                </div>
              </div>
              <div className="usa-modal-footer">
                <button
                  className="usa-button usa-button--secondary"
                  onClick={handleReject}
                  disabled={processing || !rejectReason.trim()}
                >
                  {processing ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button
                  className="usa-button usa-button--outline"
                  onClick={() => {
                    setShowRejectDialog(false);
                    setRejectReason('');
                  }}
                  disabled={processing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Revision Dialog */}
      {showRevisionDialog && (
        <div className="usa-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="usa-modal" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="usa-modal-content">
              <div className="usa-modal-header">
                <h3>Request Revision</h3>
              </div>
              <div className="usa-modal-body">
                <p>This will send the OFC back to DRAFT status for revision.</p>
                <div className="usa-form-group">
                  <label htmlFor="revision-reason" className="usa-label">
                    Decision Reason <span className="text-red">*</span>
                  </label>
                  <textarea
                    id="revision-reason"
                    className="usa-textarea"
                    rows={4}
                    required
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="Explain what revisions are needed..."
                  />
                </div>
              </div>
              <div className="usa-modal-footer">
                <button
                  className="usa-button usa-button--outline"
                  onClick={handleRequestRevision}
                  disabled={processing || !revisionReason.trim()}
                >
                  {processing ? 'Requesting...' : 'Confirm Request Revision'}
                </button>
                <button
                  className="usa-button usa-button--outline"
                  onClick={() => {
                    setShowRevisionDialog(false);
                    setRevisionReason('');
                  }}
                  disabled={processing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        }
        .text-red {
          color: #d13212;
        }
        .usa-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }
        .usa-modal {
          background: white;
          border-radius: 0.25rem;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .usa-modal-content {
          padding: 0;
        }
        .usa-modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #ddd;
        }
        .usa-modal-body {
          padding: 1.5rem;
        }
        .usa-modal-footer {
          padding: 1.5rem;
          border-top: 1px solid #ddd;
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
      `}</style>
    </section>
  );
}

