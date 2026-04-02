"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLatestApprovedOfc, proposeChange, type ProposeChangeRequest } from '@/app/lib/ofcDataProvider';
import type { Ofc } from '@/app/lib/ofcDataProvider';

export default function ProposeChangePage() {
  const params = useParams();
  const router = useRouter();
  const ofcRootId = params.rootId as string;

  const [originalOfc, setOriginalOfc] = useState<Ofc | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProposeChangeRequest>({
    ofc_text: '',
    rationale: '',
    context_conditions: '',
  });

  useEffect(() => {
    const loadOriginalOfc = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getLatestApprovedOfc(ofcRootId);
        if (!data) {
          setError('Approved OFC not found');
          return;
        }

        setOriginalOfc(data);
        setFormData({
          ofc_text: data.ofc_text,
          rationale: data.rationale,
          context_conditions: data.context_conditions || '',
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load OFC'
        );
      } finally {
        setLoading(false);
      }
    };

    if (ofcRootId) {
      loadOriginalOfc();
    }
  }, [ofcRootId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.ofc_text.trim()) {
      setError('OFC statement is required');
      return;
    }

    if (!formData.rationale.trim()) {
      setError('Rationale is required');
      return;
    }

    try {
      setSubmitting(true);

      const request: ProposeChangeRequest = {
        ofc_text: formData.ofc_text.trim(),
        rationale: formData.rationale.trim(),
        context_conditions: formData.context_conditions?.trim() || undefined,
      };

      await proposeChange(ofcRootId, request);
      router.push('/field/ofcs');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to propose change'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Propose Change to OFC</h2>
        </div>
        <div className="card">
          <p>Loading OFC...</p>
        </div>
      </section>
    );
  }

  if (error || !originalOfc) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Propose Change to OFC</h2>
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
        <h2 className="section-title">Propose Change to OFC</h2>
        <Link href={`/field/ofcs/${originalOfc.ofc_id}`} className="usa-button usa-button--outline">
          Back to OFC
        </Link>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
        <strong>Important:</strong>
        <p>
          Proposed changes require governing body approval.
          Original OFC remains in effect until approved.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          <strong>Error:</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Original OFC (Version {originalOfc.version})</h3>
        <div style={{ marginBottom: '1rem' }}>
          <strong>OFC Statement:</strong>
          <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{originalOfc.ofc_text}</p>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Rationale:</strong>
          <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{originalOfc.rationale}</p>
          </div>
        </div>
        {originalOfc.context_conditions && (
          <div>
            <strong>Context / Conditions:</strong>
            <div className="card" style={{ marginTop: '0.5rem', backgroundColor: '#f9f9f9' }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{originalOfc.context_conditions}</p>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Proposed Changes</h3>
        <form onSubmit={handleSubmit}>
          <div className="usa-form-group">
            <label htmlFor="ofc_text" className="usa-label">
              OFC Statement <span className="text-red">*</span>
            </label>
            <textarea
              id="ofc_text"
              name="ofc_text"
              className="usa-textarea"
              rows={4}
              required
              value={formData.ofc_text}
              onChange={(e) =>
                setFormData({ ...formData, ofc_text: e.target.value })
              }
            />
            <span className="usa-hint">
              Edit the OFC statement as needed.
            </span>
          </div>

          <div className="usa-form-group">
            <label htmlFor="rationale" className="usa-label">
              Rationale <span className="text-red">*</span>
            </label>
            <textarea
              id="rationale"
              name="rationale"
              className="usa-textarea"
              rows={4}
              required
              value={formData.rationale}
              onChange={(e) =>
                setFormData({ ...formData, rationale: e.target.value })
              }
            />
            <span className="usa-hint">
              Edit the rationale as needed.
            </span>
          </div>

          <div className="usa-form-group">
            <label htmlFor="context_conditions" className="usa-label">
              Context / Conditions
            </label>
            <textarea
              id="context_conditions"
              name="context_conditions"
              className="usa-textarea"
              rows={3}
              value={formData.context_conditions}
              onChange={(e) =>
                setFormData({ ...formData, context_conditions: e.target.value })
              }
            />
            <span className="usa-hint">
              Edit context/conditions as needed.
            </span>
          </div>

          <div className="usa-form-group">
            <button
              type="submit"
              className="usa-button"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Proposed Change'}
            </button>
            <Link
              href={`/field/ofcs/${originalOfc.ofc_id}`}
              className="usa-button usa-button--outline"
              style={{ marginLeft: '0.5rem' }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <style jsx>{`
        .text-red {
          color: #d13212;
        }
      `}</style>
    </section>
  );
}

