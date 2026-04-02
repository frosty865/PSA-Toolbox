"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface AdminOfc {
  id: string;
  ofc_text: string;
  title: string | null;
  version: number;
  status: string;
  status_reason: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reference_unresolved: boolean;
  evidence_excerpt: string | null;
  discipline: string | null;
  discipline_id: string | null;
  subtype: string | null;
  subtype_id: string | null;
  supersedes_ofc_id: string | null;
  supersedes_version: number | null;
}

export default function AdminOFCDetailPage() {
  const params = useParams();
  const ofcId = params.ofc_id as string;
  
  const [ofc, setOfc] = useState<AdminOfc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ofcId) {
      loadOFCDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when ofcId changes
  }, [ofcId]);

  const loadOFCDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/ofcs/review-queue?status=`, {
        cache: 'no-store'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to load OFC details');
      }
      
      if (data.success && data.ofcs) {
        const foundOfc = data.ofcs.find((o: AdminOfc) => o.id === ofcId);
        if (foundOfc) {
          setOfc(foundOfc);
        } else {
          setError('OFC not found');
        }
      } else {
        setError('Failed to load OFC details');
      }
    } catch (err) {
      console.error('Error loading OFC details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load OFC details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
      case 'UNDER_REVIEW':
        return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
      case 'APPROVED':
        return { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' };
      case 'REJECTED':
        return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      default:
        return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    }
  };

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h1 className="section-title">OFC Details</h1>
        </div>
        <div className="card">
          <p>Loading OFC details...</p>
        </div>
      </section>
    );
  }

  if (error || !ofc) {
    return (
      <section className="section active">
        <div className="section-header">
          <h1 className="section-title">OFC Details</h1>
        </div>
        <div className="card" style={{ 
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca'
        }}>
          <p style={{ color: '#991b1b', margin: 0 }}>
            <strong>Error:</strong> {error || 'OFC not found'}
          </p>
          <Link
            href="/admin/ofcs"
            style={{
              display: 'inline-block',
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'var(--cisa-blue)',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: 'var(--border-radius)'
            }}
          >
            Back to Review Queue
          </Link>
        </div>
      </section>
    );
  }

  const statusColors = getStatusBadgeColor(ofc.status);

  return (
    <section className="section active">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Link
            href="/admin/ofcs"
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'transparent',
              color: 'var(--cisa-blue)',
              textDecoration: 'none',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--cisa-blue)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            ← Back to Queue
          </Link>
          <h1 className="section-title" style={{ margin: 0 }}>OFC Review</h1>
        </div>
      </div>

      {/* OFC Details Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
            <div>
              <h2 style={{ 
                fontSize: 'var(--font-size-xl)',
                fontWeight: 600,
                margin: 0,
                marginBottom: 'var(--spacing-xs)'
              }}>
                {ofc.title || 'Untitled OFC'}
              </h2>
              <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: statusColors.bg,
                color: statusColors.color,
                border: `1px solid ${statusColors.border}`,
                marginTop: 'var(--spacing-xs)'
              }}>
                {ofc.status}
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            backgroundColor: '#f9fafb',
            borderRadius: 'var(--border-radius)',
            marginBottom: 'var(--spacing-md)'
          }}>
            <div>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>Submitted By:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-base)' }}>
                {ofc.submitted_by || 'N/A'}
              </p>
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>Submitted At:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-base)' }}>
                {formatDate(ofc.submitted_at)}
              </p>
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>Discipline:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-base)' }}>
                {ofc.discipline || 'N/A'}
                {ofc.subtype && (
                  <span style={{ color: 'var(--cisa-gray)' }}> / {ofc.subtype}</span>
                )}
              </p>
            </div>
            <div>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>Version:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-size-base)' }}>
                {ofc.version}
              </p>
            </div>
          </div>

          {/* OFC Text */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ 
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
              marginBottom: 'var(--spacing-sm)'
            }}>
              OFC Text
            </h3>
            <div style={{
              padding: 'var(--spacing-md)',
              backgroundColor: '#ffffff',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6
            }}>
              {ofc.ofc_text || <em style={{ color: 'var(--cisa-gray)' }}>No text provided</em>}
            </div>
          </div>

          {/* Evidence Excerpt */}
          {ofc.evidence_excerpt && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <h3 style={{ 
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                marginBottom: 'var(--spacing-sm)'
              }}>
                Evidence Excerpt
              </h3>
              <div style={{
                padding: 'var(--spacing-md)',
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: 'var(--border-radius)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontSize: 'var(--font-size-sm)'
              }}>
                {ofc.evidence_excerpt}
              </div>
            </div>
          )}

          {/* Status Reason */}
          {ofc.status_reason && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <h3 style={{ 
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                marginBottom: 'var(--spacing-sm)'
              }}>
                Status Reason
              </h3>
              <div style={{
                padding: 'var(--spacing-md)',
                backgroundColor: '#f3f4f6',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6
              }}>
                {ofc.status_reason}
              </div>
            </div>
          )}

          {/* Reference Unresolved Warning */}
          {ofc.reference_unresolved && (
            <div style={{
              padding: 'var(--spacing-md)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--border-radius)',
              marginBottom: 'var(--spacing-md)'
            }}>
              <strong style={{ color: '#991b1b' }}>⚠ Reference Unresolved:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#991b1b', fontSize: 'var(--font-size-sm)' }}>
                This OFC has unresolved references that need attention.
              </p>
            </div>
          )}

          {/* Supersession Info */}
          {ofc.supersedes_ofc_id && (
            <div style={{
              padding: 'var(--spacing-md)',
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: 'var(--border-radius)',
              marginBottom: 'var(--spacing-md)'
            }}>
              <strong style={{ color: '#1e40af' }}>ℹ Supersedes:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#1e40af', fontSize: 'var(--font-size-sm)' }}>
                This OFC supersedes OFC {ofc.supersedes_ofc_id} (version {ofc.supersedes_version}).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Notice */}
      <div className="card" style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #fcd34d'
      }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: '#92400e' }}>
          <strong>Note:</strong> Governance actions (approve, reject, request revision, retire) are available through the backend API endpoints. 
          This is a read-only view of the OFC details.
        </p>
      </div>
    </section>
  );
}
