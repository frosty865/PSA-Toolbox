"use client";

import { useState, useEffect } from 'react';

interface CandidateMatch {
  discipline_name: string;
  subtype_name: string;
  score: number;
}

interface QuarantinedChunk {
  chunk_id: string;
  document_id: string;
  page_number?: number;
  page_numbers?: number[];
  text?: string;
  excerpt_text?: string;
  source_citation?: string;
  quarantine_reason: string;
  candidate_matches?: CandidateMatch[];
  top_score?: number;
  second_score?: number;
  review_status?: 'pending' | 'reviewed';
  review?: {
    review_decision: string;
    approved_discipline?: string;
    approved_subtype?: string;
    reviewer_role?: string;
    reviewed_at?: string;
  };
}

interface SourceProvenance {
  publisher: string;
  title: string;
  source_key: string;
  authority_tier: string;
  status: string;
}

export default function ReviewQuarantinedPage() {
  const [chunks, setChunks] = useState<QuarantinedChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<QuarantinedChunk | null>(null);
  const [reviewDecision, setReviewDecision] = useState<string>('');
  const [approvedDiscipline, setApprovedDiscipline] = useState<string>('');
  const [approvedSubtype, setApprovedSubtype] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  // Engineering-only review gate: Required reviewer identity fields
  const [reviewerId, setReviewerId] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('');
  const [attestation, setAttestation] = useState<boolean>(false);
  const [sourceProvenance, setSourceProvenance] = useState<SourceProvenance | null>(null);
  const [loadingSource, setLoadingSource] = useState<boolean>(false);

  useEffect(() => {
    // Get user role (for now, from localStorage or default to FIELD)
    // Engineering-only gate: Only ENGINEER role can submit reviews
    const role = localStorage.getItem('userRole') || 'FIELD';
    setUserRole(role);
    
    // Pre-fill reviewer identity if available (for convenience)
    const savedReviewerId = localStorage.getItem('reviewerId');
    const savedReviewerName = localStorage.getItem('reviewerName');
    if (savedReviewerId) setReviewerId(savedReviewerId);
    if (savedReviewerName) setReviewerName(savedReviewerName);

    const loadChunks = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/review/quarantined', {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          // Try to parse error message, but handle gracefully if JSON parsing fails
          let errorMessage = 'Failed to load quarantined chunks';
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // If response is not JSON, use status text
            errorMessage = `${response.status} ${response.statusText || 'Error'}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setChunks(data.quarantined_chunks || []);
      } catch (err: unknown) {
        console.error('Error loading quarantined chunks:', err);
        const e = err as { name?: string; message?: string };
        if (e.name === 'AbortError' || (e.message && e.message.includes('fetch'))) {
          setError('Backend service unavailable. Please ensure the Flask backend is running.');
        } else {
          setError(e.message ?? 'Failed to load quarantined chunks');
        }
      } finally {
        setLoading(false);
      }
    };

    loadChunks();
  }, []);

  // Load source provenance when chunk is selected
  useEffect(() => {
    if (selectedChunk?.document_id) {
      const loadSourceProvenance = async () => {
        try {
          setLoadingSource(true);
          const response = await fetch(`/api/admin/documents/${selectedChunk.document_id}/source`, {
            cache: 'no-store',
          });
          if (response.ok) {
            const data = await response.json();
            if (data.ok && data.data) {
              setSourceProvenance(data.data);
            } else {
              setSourceProvenance(null);
            }
          } else {
            setSourceProvenance(null);
          }
        } catch (err) {
          console.error('Failed to load source provenance:', err);
          setSourceProvenance(null);
        } finally {
          setLoadingSource(false);
        }
      };
      loadSourceProvenance();
    } else {
      setSourceProvenance(null);
    }
  }, [selectedChunk?.document_id]);

  const handleSubmitReview = async () => {
    if (!selectedChunk) return;

    // Engineering-only gate: Validate reviewer identity
    if (!reviewerId.trim()) {
      alert('Reviewer ID is required');
      return;
    }
    if (!reviewerName.trim()) {
      alert('Reviewer name is required');
      return;
    }
    if (userRole !== 'ENGINEER') {
      alert('Engineering-only review gate active. ENGINEER role required to submit reviews.');
      return;
    }
    if (!attestation) {
      alert('You must attest to submit a review');
      return;
    }

    // Validate required fields
    if (reviewDecision === 'APPROVE_ALIGNMENT') {
      if (!approvedDiscipline || !approvedSubtype) {
        alert('Discipline and subtype are required for APPROVE_ALIGNMENT');
        return;
      }
      if (!reviewNotes.trim()) {
        alert('Review notes are required for APPROVE_ALIGNMENT');
        return;
      }
    } else if (reviewDecision === 'REJECT_AS_NON_ACTIONABLE') {
      if (!reviewNotes.trim()) {
        alert('Review notes are required for REJECT_AS_NON_ACTIONABLE');
        return;
      }
    }

    if (!reviewDecision) {
      alert('Please select a review decision');
      return;
    }

    try {
      setSubmitting(true);

      // Save reviewer identity for convenience
      localStorage.setItem('reviewerId', reviewerId);
      localStorage.setItem('reviewerName', reviewerName);

      const response = await fetch(`/api/review/${selectedChunk.chunk_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewer_id: reviewerId,
          reviewer_name: reviewerName,
          reviewer_role: 'ENGINEER', // Engineering-only gate: must be ENGINEER
          attestation: true,
          review_decision: reviewDecision,
          approved_discipline: approvedDiscipline || null,
          approved_subtype: approvedSubtype || null,
          review_notes: reviewNotes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit review');
      }

      // Reload chunks to show updated review status
      const reloadResponse = await fetch('/api/review/quarantined', {
        cache: 'no-store',
      });
      const reloadData = await reloadResponse.json();
      setChunks(reloadData.quarantined_chunks || []);

      // Reset form
      setSelectedChunk(null);
      setReviewDecision('');
      setApprovedDiscipline('');
      setApprovedSubtype('');
      setReviewNotes('');
      alert('Review submitted successfully');
    } catch (err: unknown) {
      console.error('Error submitting review:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to submit review: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Engineering-only gate: Only ENGINEER can review
  const canReview = userRole === 'ENGINEER' && attestation;
  const pendingChunks = chunks.filter(c => c.review_status === 'pending');
  const reviewedChunks = chunks.filter(c => c.review_status === 'reviewed');

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
          <p>Loading quarantined chunks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          color: '#991b1b'
        }}>
          <h2 style={{ marginTop: 0 }}>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Phase 6 Review Queue</h1>
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray)',
          lineHeight: 1.6,
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          Review quarantined chunks from Phase 4 that require human alignment decisions.
        </p>
        {/* Engineering-Only Review Gate Banner */}
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--font-size-base)',
          color: '#92400e',
          fontWeight: 600
        }}>
          <strong>🔒 Engineering-Only Review Mode Active</strong>
          <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
            Only ENGINEER role can submit reviews. All other roles (GOVERNANCE, FIELD, PSA) are view-only.
            This is a temporary but auditable gate until enterprise IAM is implemented.
          </p>
        </div>
        
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--font-size-sm)',
          color: '#0369a1'
        }}>
          <strong>Status:</strong> {pendingChunks.length} pending, {reviewedChunks.length} reviewed
          {!canReview && (
            <span>
              {' '}
              {userRole !== 'ENGINEER' 
                ? '(View-only mode - ENGINEER role required to submit reviews)'
                : '(Attestation required - check the attestation box to enable review controls)'}
            </span>
          )}
        </div>
      </div>

      {chunks.length === 0 ? (
        <div className="card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
          <p style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--cisa-gray)',
            margin: 0,
            fontStyle: 'italic'
          }}>
            No quarantined chunks found.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
          {/* Chunk List */}
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
              Quarantined Chunks ({chunks.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {chunks.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  className="card"
                  style={{
                    padding: 'var(--spacing-md)',
                    border: selectedChunk?.chunk_id === chunk.chunk_id
                      ? '2px solid var(--cisa-blue)'
                      : '1px solid var(--cisa-gray-light)',
                    cursor: 'pointer',
                    backgroundColor: chunk.review_status === 'reviewed' ? '#f0f9ff' : '#ffffff'
                  }}
                  onClick={() => setSelectedChunk(chunk)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-xs)' }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                      {chunk.excerpt_text || chunk.text || 'No excerpt'}{' '}
                      {(chunk.excerpt_text || chunk.text || '').length > 100 ? '...' : ''}
                    </h3>
                    {chunk.review_status === 'reviewed' && (
                      <span style={{
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        backgroundColor: '#d1fae5',
                        color: '#065f46',
                        borderRadius: 'var(--border-radius)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600
                      }}>
                        Reviewed
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray-dark)' }}>
                    Page: {chunk.page_number || chunk.page_numbers?.join(', ') || 'N/A'} | 
                    Reason: {chunk.quarantine_reason}
                  </p>
                  {chunk.candidate_matches && chunk.candidate_matches.length > 0 && (
                    <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)' }}>
                      Top candidate: {chunk.candidate_matches[0].discipline_name} / {chunk.candidate_matches[0].subtype_name} (score: {chunk.candidate_matches[0].score.toFixed(3)})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Review Form */}
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
              Review Decision
            </h2>
            {selectedChunk ? (
              <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
                {/* Source Provenance Panel */}
                {sourceProvenance && (
                  <div style={{ 
                    marginBottom: 'var(--spacing-md)', 
                    padding: 'var(--spacing-sm)', 
                    backgroundColor: '#f9fafb', 
                    border: '1px solid #e5e7eb',
                    borderRadius: 'var(--border-radius)'
                  }}>
                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                      Source
                    </h4>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray-dark)' }}>
                      <div><strong>Publisher:</strong> {sourceProvenance.publisher}</div>
                      <div><strong>Title:</strong> {sourceProvenance.title}</div>
                      <div><strong>Key:</strong> <code style={{ fontSize: '0.9em' }}>{sourceProvenance.source_key}</code></div>
                      <div><strong>Tier:</strong> {sourceProvenance.authority_tier}</div>
                      <div><strong>Status:</strong> {sourceProvenance.status}</div>
                    </div>
                  </div>
                )}
                {loadingSource && (
                  <div style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)' }}>
                    Loading source information...
                  </div>
                )}
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
                    Chunk Details
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray-dark)', whiteSpace: 'pre-wrap' }}>
                    {selectedChunk.text || selectedChunk.excerpt_text || 'No text available'}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                    Document: {selectedChunk.document_id} | Page: {selectedChunk.page_number || selectedChunk.page_numbers?.join(', ') || 'N/A'}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)' }}>
                    Reason: {selectedChunk.quarantine_reason}
                  </p>
                </div>

                {selectedChunk.candidate_matches && selectedChunk.candidate_matches.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                      Candidate Matches
                    </h4>
                    <ul style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray-dark)', paddingLeft: 'var(--spacing-md)' }}>
                      {selectedChunk.candidate_matches.slice(0, 3).map((match, idx) => (
                        <li key={idx}>
                          {match.discipline_name} / {match.subtype_name} (score: {match.score.toFixed(3)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedChunk.review_status === 'reviewed' ? (
                  <div style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 'var(--border-radius)'
                  }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: '#0369a1' }}>
                      <strong>Already reviewed:</strong> {selectedChunk.review?.review_decision}
                      {selectedChunk.review?.approved_discipline && (
                        <> → {selectedChunk.review.approved_discipline} / {selectedChunk.review.approved_subtype}</>
                      )}
                      <br />
                      Reviewed by: {selectedChunk.review?.reviewer_role} at {selectedChunk.review?.reviewed_at ? new Date(selectedChunk.review.reviewed_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Engineering-Only Review Gate: Reviewer Identity Fields */}
                    <div style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: 'var(--border-radius)',
                      marginBottom: 'var(--spacing-md)'
                    }}>
                      <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-sm)', color: '#92400e' }}>
                        Reviewer Identity (Required)
                      </h4>
                      
                      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                          Reviewer ID *
                        </label>
                        <input
                          type="text"
                          value={reviewerId}
                          onChange={(e) => setReviewerId(e.target.value)}
                          placeholder="Enter your reviewer ID"
                          disabled={userRole !== 'ENGINEER'}
                          style={{
                            width: '100%',
                            padding: 'var(--spacing-sm)',
                            fontSize: 'var(--font-size-sm)',
                            border: '1px solid var(--cisa-gray-light)',
                            borderRadius: 'var(--border-radius)',
                            opacity: userRole !== 'ENGINEER' ? 0.6 : 1
                          }}
                        />
                      </div>
                      
                      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                          Reviewer Name *
                        </label>
                        <input
                          type="text"
                          value={reviewerName}
                          onChange={(e) => setReviewerName(e.target.value)}
                          placeholder="Enter your name"
                          disabled={userRole !== 'ENGINEER'}
                          style={{
                            width: '100%',
                            padding: 'var(--spacing-sm)',
                            fontSize: 'var(--font-size-sm)',
                            border: '1px solid var(--cisa-gray-light)',
                            borderRadius: 'var(--border-radius)',
                            opacity: userRole !== 'ENGINEER' ? 0.6 : 1
                          }}
                        />
                      </div>
                      
                      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-xs)', cursor: userRole === 'ENGINEER' ? 'pointer' : 'not-allowed' }}>
                          <input
                            type="checkbox"
                            checked={attestation}
                            onChange={(e) => setAttestation(e.target.checked)}
                            disabled={userRole !== 'ENGINEER'}
                            style={{
                              marginRight: 'var(--spacing-xs)',
                              cursor: userRole === 'ENGINEER' ? 'pointer' : 'not-allowed',
                              opacity: userRole !== 'ENGINEER' ? 0.6 : 1
                            }}
                          />
                          <span style={{ opacity: userRole !== 'ENGINEER' ? 0.6 : 1 }}>
                            I attest that I am an ENGINEER and have the authority to submit this review *
                          </span>
                        </label>
                      </div>
                      
                      {userRole !== 'ENGINEER' && (
                        <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-xs)', color: '#92400e', fontStyle: 'italic' }}>
                          Engineering-only review gate: Only ENGINEER role can submit reviews.
                        </p>
                      )}
                    </div>
                    
                    {canReview ? (
                      <>
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                            Review Decision *
                          </label>
                          <select
                            value={reviewDecision}
                            onChange={(e) => setReviewDecision(e.target.value)}
                            style={{
                              width: '100%',
                              padding: 'var(--spacing-sm)',
                              fontSize: 'var(--font-size-sm)',
                              border: '1px solid var(--cisa-gray-light)',
                              borderRadius: 'var(--border-radius)'
                            }}
                          >
                            <option value="">Select decision...</option>
                            <option value="APPROVE_ALIGNMENT">Approve Alignment</option>
                            <option value="REJECT_AS_NON_ACTIONABLE">Reject as Non-Actionable</option>
                            <option value="SPLIT_REQUIRED">Split Required</option>
                          </select>
                        </div>

                        {reviewDecision === 'APPROVE_ALIGNMENT' && (
                          <>
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                Approved Discipline *
                              </label>
                              <input
                                type="text"
                                value={approvedDiscipline}
                                onChange={(e) => setApprovedDiscipline(e.target.value)}
                                placeholder="Enter discipline name"
                                style={{
                                  width: '100%',
                                  padding: 'var(--spacing-sm)',
                                  fontSize: 'var(--font-size-sm)',
                                  border: '1px solid var(--cisa-gray-light)',
                                  borderRadius: 'var(--border-radius)'
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                Approved Subtype *
                              </label>
                              <input
                                type="text"
                                value={approvedSubtype}
                                onChange={(e) => setApprovedSubtype(e.target.value)}
                                placeholder="Enter subtype name"
                                style={{
                                  width: '100%',
                                  padding: 'var(--spacing-sm)',
                                  fontSize: 'var(--font-size-sm)',
                                  border: '1px solid var(--cisa-gray-light)',
                                  borderRadius: 'var(--border-radius)'
                                }}
                              />
                            </div>
                          </>
                        )}

                        {(reviewDecision === 'APPROVE_ALIGNMENT' || reviewDecision === 'REJECT_AS_NON_ACTIONABLE') && (
                          <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                              Review Notes *
                            </label>
                            <textarea
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              placeholder="Enter review notes..."
                              rows={4}
                              style={{
                                width: '100%',
                                padding: 'var(--spacing-sm)',
                                fontSize: 'var(--font-size-sm)',
                                border: '1px solid var(--cisa-gray-light)',
                                borderRadius: 'var(--border-radius)',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        )}

                        <button
                          onClick={handleSubmitReview}
                          disabled={submitting || !reviewDecision}
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            fontSize: 'var(--font-size-sm)',
                            cursor: submitting || !reviewDecision ? 'not-allowed' : 'pointer',
                            opacity: submitting || !reviewDecision ? 0.6 : 1
                          }}
                        >
                          {submitting ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </>
                    ) : (
                      <div style={{
                        padding: 'var(--spacing-md)',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: 'var(--border-radius)',
                        color: '#92400e'
                      }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
                          <strong>View-only mode:</strong> {userRole !== 'ENGINEER' 
                            ? 'ENGINEER role required to submit reviews (engineering-only gate active).'
                            : 'Attestation required. Please check the attestation box above to enable review controls.'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="card" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--cisa-gray)',
                  margin: 0,
                  fontStyle: 'italic'
                }}>
                  Select a chunk to review
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

