"use client";

import { useState, useEffect } from 'react';
import { useSecurityMode } from '../../../contexts/SecurityModeContext';

interface Nomination {
  nomination_id: string;
  assessment_id?: string;
  finding_id?: string;
  discipline_id?: string;
  discipline_subtype_id?: string;
  proposed_title: string;
  proposed_ofc_text: string;
  evidence_excerpt: string;
  evidence_page?: number;
  submitted_by: string;
  submitted_role: string;
  submitted_at: string;
  status: string;
  status_reason?: string;
  locked: boolean;
  reference_unresolved?: boolean;
  discipline_name?: string;
  discipline_code?: string;
  subtype_name?: string;
  subtype_code?: string;
}

export default function EngineeringReviewPage() {
  const { mode } = useSecurityMode();
  const [loading, setLoading] = useState(true);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [selectedNomination, setSelectedNomination] = useState<Nomination | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('');
  const [subtypeFilter, setSubtypeFilter] = useState<string>('');
  const [referenceUnresolvedFilter, setReferenceUnresolvedFilter] = useState<boolean | null>(null);
  void setDisciplineFilter;
  void setSubtypeFilter;
  void setReferenceUnresolvedFilter;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [decisionForm, setDecisionForm] = useState({
    decision: '',
    decision_notes: '',
    decided_by: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadNominations();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when filters change
  }, [statusFilter, disciplineFilter, subtypeFilter, referenceUnresolvedFilter]);

  const loadNominations = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/ofcs/review-queue?status=${statusFilter}`;
      if (disciplineFilter) {
        url += `&discipline_id=${encodeURIComponent(disciplineFilter)}`;
      }
      if (subtypeFilter) {
        url += `&subtype_id=${encodeURIComponent(subtypeFilter)}`;
      }
      if (referenceUnresolvedFilter !== null) {
        url += `&reference_unresolved=${referenceUnresolvedFilter}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      if (data.success || Array.isArray(data.nominations)) {
        setNominations(data.nominations || []);
      }
    } catch (err) {
      console.error('Failed to load nominations:', err);
      setError('Failed to load nominations');
    } finally {
      setLoading(false);
    }
  };

  const handleSetStatus = async (nominationId: string, status: string) => {
    setActionLoading(nominationId);
    setError(null);
    try {
      const response = await fetch(`/api/ofc/nominations/${nominationId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          updated_by: 'engineering-reviewer'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update status');
      }

      setSuccess(`Status updated to ${status}`);
      await loadNominations();
      if (selectedNomination?.nomination_id === nominationId) {
        setSelectedNomination(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecision = async (nominationId: string) => {
    if (!decisionForm.decision || !decisionForm.decision_notes || !decisionForm.decided_by) {
      setError('All decision fields are required');
      return;
    }
    
    // Guardrail: Prevent approval if reference_unresolved
    if (decisionForm.decision === 'APPROVE_TO_CANONICAL') {
      const nomination = nominations.find(n => n.nomination_id === nominationId);
      if (nomination?.reference_unresolved) {
        setError('Cannot approve: References are unresolved. Please resolve references before approving.');
        return;
      }
    }
    
    // Guardrail: Require reason for rejection
    if (decisionForm.decision === 'REJECT' && !decisionForm.decision_notes.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setActionLoading(nominationId);
    setError(null);
    try {
      const response = await fetch(`/api/ofc/nominations/${nominationId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionForm.decision,
          decision_notes: decisionForm.decision_notes,
          decided_by: decisionForm.decided_by,
          decided_role: 'ENGINEER'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to make decision');
      }

      setSuccess(`Decision recorded: ${decisionForm.decision}`);
      setDecisionForm({ decision: '', decision_notes: '', decided_by: '' });
      setSelectedNomination(null);
      await loadNominations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to make decision');
    } finally {
      setActionLoading(null);
    }
  };

  const canMakeDecision = () => {
    if (mode === 'DISABLED') return true;
    if (mode === 'ENGINEERING') return true; // ENGINEER role allowed
    if (mode === 'ENFORCED') return true; // ENGINEER allowed in ENFORCED
    return false;
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-lg)' }}>
        <p>Loading nominations...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Engineering OFC Review Queue</h1>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
        Review and approve OFC nominations submitted by Field/PSA teams.
      </p>

      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)',
          color: '#991b1b'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: '#d1fae5',
          border: '1px solid #10b981',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)'
        }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            border: '1px solid #d1d5db',
            borderRadius: 'var(--border-radius)'
          }}
        >
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
        <button
          onClick={loadNominations}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* Nominations List */}
        <div>
          <h2>Nominations ({nominations.length})</h2>
          {nominations.length === 0 ? (
            <p style={{ color: 'var(--cisa-gray)' }}>No nominations found with status: {statusFilter}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {nominations.map(nom => (
                <div
                  key={nom.nomination_id}
                  onClick={() => setSelectedNomination(nom)}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: '1px solid #d1d5db',
                    borderRadius: 'var(--border-radius)',
                    cursor: 'pointer',
                    backgroundColor: selectedNomination?.nomination_id === nom.nomination_id ? '#eff6ff' : 'white',
                    borderColor: selectedNomination?.nomination_id === nom.nomination_id ? '#3b82f6' : '#d1d5db'
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                    {nom.proposed_title}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                    Status: <strong>{nom.status}</strong> | Submitted by: {nom.submitted_by}
                  </div>
                  {nom.reference_unresolved && (
                    <div style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: '0.25rem',
                      fontSize: 'var(--font-size-xs)',
                      color: '#92400e',
                      marginTop: 'var(--spacing-xs)',
                      fontWeight: 600
                    }}>
                      ⚠️ Reference Unresolved
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                    {new Date(nom.submitted_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div>
          {selectedNomination ? (
            <div style={{
              padding: 'var(--spacing-lg)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)',
              backgroundColor: 'white'
            }}>
              <h2>Nomination Details</h2>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>Title:</strong> {selectedNomination.proposed_title}
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>OFC Text:</strong>
                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: '#f9fafb',
                  borderRadius: 'var(--border-radius)',
                  marginTop: 'var(--spacing-xs)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedNomination.proposed_ofc_text}
                </div>
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>Evidence Excerpt:</strong>
                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: '#f9fafb',
                  borderRadius: 'var(--border-radius)',
                  marginTop: 'var(--spacing-xs)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedNomination.evidence_excerpt}
                </div>
                {selectedNomination.evidence_page && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                    Page: {selectedNomination.evidence_page}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>Discipline:</strong> {selectedNomination.discipline_name || 'N/A'}
                {selectedNomination.subtype_name && (
                  <> | <strong>Subtype:</strong> {selectedNomination.subtype_name}</>
                )}
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>Status:</strong> {selectedNomination.status}
                {selectedNomination.status_reason && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                    <strong>Status Reason:</strong> {selectedNomination.status_reason}
                  </div>
                )}
                {selectedNomination.reference_unresolved && (
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '0.25rem',
                    fontSize: 'var(--font-size-sm)',
                    color: '#92400e',
                    marginTop: 'var(--spacing-xs)',
                    fontWeight: 600
                  }}>
                    ⚠️ Reference Unresolved
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <strong>Submitted by:</strong> {selectedNomination.submitted_by} ({selectedNomination.submitted_role})
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                  {new Date(selectedNomination.submitted_at).toLocaleString()}
                </div>
              </div>

              {selectedNomination.locked && (
                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: 'var(--border-radius)',
                  marginBottom: 'var(--spacing-md)',
                  color: '#92400e'
                }}>
                  This nomination is locked and cannot be modified.
                </div>
              )}

              {!selectedNomination.locked && (
                <>
                  {/* Status Actions */}
                  <div style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: 'var(--border-radius)' }}>
                    <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-base)' }}>Status Actions</h3>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                      {selectedNomination.status === 'SUBMITTED' && (
                        <button
                          onClick={() => handleSetStatus(selectedNomination.nomination_id, 'UNDER_REVIEW')}
                          disabled={actionLoading === selectedNomination.nomination_id}
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--border-radius)',
                            cursor: 'pointer'
                          }}
                        >
                          Set Under Review
                        </button>
                      )}
                      <button
                        onClick={() => handleSetStatus(selectedNomination.nomination_id, 'WITHDRAWN')}
                        disabled={actionLoading === selectedNomination.nomination_id}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          backgroundColor: '#6b7280',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 'var(--border-radius)',
                          cursor: 'pointer'
                        }}
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>

                  {/* Decision Actions */}
                  {canMakeDecision() && (
                    <div style={{ padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: 'var(--border-radius)' }}>
                      <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-base)' }}>Decision</h3>
                      
                      {/* Guardrail: Reference Unresolved Warning */}
                      {selectedNomination.reference_unresolved && (
                        <div style={{
                          padding: 'var(--spacing-sm)',
                          backgroundColor: '#fef3c7',
                          border: '1px solid #f59e0b',
                          borderRadius: 'var(--border-radius)',
                          marginBottom: 'var(--spacing-md)',
                          color: '#92400e'
                        }}>
                          <strong>⚠️ Reference Unresolved:</strong> This nomination has unresolved references. 
                          Approval is disabled until references are resolved.
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        <select
                          value={decisionForm.decision}
                          onChange={(e) => setDecisionForm(prev => ({ ...prev, decision: e.target.value }))}
                          disabled={selectedNomination.reference_unresolved && decisionForm.decision === 'APPROVE_TO_CANONICAL'}
                          style={{
                            padding: 'var(--spacing-sm)',
                            border: '1px solid #d1d5db',
                            borderRadius: 'var(--border-radius)',
                            opacity: selectedNomination.reference_unresolved && decisionForm.decision === 'APPROVE_TO_CANONICAL' ? 0.5 : 1
                          }}
                        >
                          <option value="">Select decision</option>
                          <option 
                            value="APPROVE_TO_CANONICAL"
                            disabled={selectedNomination.reference_unresolved}
                          >
                            Approve to Canonical {selectedNomination.reference_unresolved ? '(Disabled - References Unresolved)' : ''}
                          </option>
                          <option value="REJECT">Reject</option>
                          <option value="REQUEST_CHANGES">Request Changes</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Your name"
                          value={decisionForm.decided_by}
                          onChange={(e) => setDecisionForm(prev => ({ ...prev, decided_by: e.target.value }))}
                          style={{
                            padding: 'var(--spacing-sm)',
                            border: '1px solid #d1d5db',
                            borderRadius: 'var(--border-radius)'
                          }}
                        />

                        <textarea
                          placeholder={decisionForm.decision === 'REJECT' ? 'Rejection reason (required)' : 'Decision notes (required)'}
                          value={decisionForm.decision_notes}
                          onChange={(e) => setDecisionForm(prev => ({ ...prev, decision_notes: e.target.value }))}
                          rows={4}
                          required={decisionForm.decision === 'REJECT'}
                          style={{
                            padding: 'var(--spacing-sm)',
                            border: '1px solid #d1d5db',
                            borderRadius: 'var(--border-radius)',
                            fontFamily: 'inherit'
                          }}
                        />

                        <button
                          onClick={() => handleDecision(selectedNomination.nomination_id)}
                          disabled={!decisionForm.decision || !decisionForm.decision_notes || !decisionForm.decided_by || actionLoading === selectedNomination.nomination_id}
                          style={{
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            backgroundColor: decisionForm.decision && decisionForm.decision_notes && decisionForm.decided_by ? '#10b981' : '#9ca3af',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--border-radius)',
                            cursor: decisionForm.decision && decisionForm.decision_notes && decisionForm.decided_by ? 'pointer' : 'not-allowed',
                            fontWeight: 600
                          }}
                        >
                          {actionLoading === selectedNomination.nomination_id ? 'Processing...' : 'Submit Decision'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!canMakeDecision() && (
                    <div style={{
                      padding: 'var(--spacing-sm)',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #ef4444',
                      borderRadius: 'var(--border-radius)',
                      color: '#991b1b'
                    }}>
                      Decisions are not allowed in current security mode ({mode})
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{
              padding: 'var(--spacing-lg)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)',
              backgroundColor: '#f9fafb',
              textAlign: 'center',
              color: 'var(--cisa-gray)'
            }}>
              Select a nomination to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

