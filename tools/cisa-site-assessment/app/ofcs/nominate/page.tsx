"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Discipline {
  id: string;
  name: string;
  code: string;
  discipline_subtypes?: DisciplineSubtype[];
}

interface DisciplineSubtype {
  id: string;
  name: string;
  code: string;
  discipline_id: string;
}

export default function NominateOFCPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [subtypes, setSubtypes] = useState<DisciplineSubtype[]>([]);
  const [formData, setFormData] = useState({
    discipline_id: '',
    discipline_subtype_id: '',
    proposed_title: '',
    proposed_ofc_text: '',
    evidence_excerpt: '',
    evidence_page: '',
    assessment_id: '',
    finding_id: '',
    document_id: '',
    page: '',
    submitted_by: '',
    attestation: false
  });
  const [success, setSuccess] = useState<{ nomination_id: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDisciplines();
  }, []);

  useEffect(() => {
    if (selectedDisciplineId) {
      const selectedDiscipline = disciplines.find(d => d.id === selectedDisciplineId);
      if (selectedDiscipline?.discipline_subtypes) {
        setSubtypes(selectedDiscipline.discipline_subtypes);
      } else {
        setSubtypes([]);
      }
      setFormData(prev => ({ ...prev, discipline_subtype_id: '' }));
    } else {
      setSubtypes([]);
    }
  }, [selectedDisciplineId, disciplines]);

  const loadDisciplines = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reference/disciplines?active=true');
      const data = await response.json();
      if (data.success && data.disciplines) {
        setDisciplines(data.disciplines);
      }
    } catch (err) {
      console.error('Failed to load disciplines:', err);
      setError('Failed to load disciplines');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        discipline_id: formData.discipline_id || null,
        discipline_subtype_id: formData.discipline_subtype_id || null,
        evidence_page: formData.evidence_page ? parseInt(formData.evidence_page) : null,
        page: formData.page ? parseInt(formData.page) : null,
        assessment_id: formData.assessment_id || null,
        finding_id: formData.finding_id || null,
        document_id: formData.document_id || null,
        submitted_role: 'FIELD',
        attestation: formData.attestation
      };

      const response = await fetch('/api/ofc/nominations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to submit nomination');
      }

      setSuccess({
        nomination_id: data.nomination_id,
        status: data.status
      });

      // Reset form
      setFormData({
        discipline_id: '',
        discipline_subtype_id: '',
        proposed_title: '',
        proposed_ofc_text: '',
        evidence_excerpt: '',
        evidence_page: '',
        assessment_id: '',
        finding_id: '',
        document_id: '',
        page: '',
        submitted_by: '',
        attestation: false
      });
      setSelectedDisciplineId('');

    } catch (err: unknown) {
      console.error('Failed to submit nomination:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit nomination');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-lg)' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Nominate OFC</h1>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
        Submit a new Operational Functional Capability (OFC) for review and approval.
      </p>

      {success && (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: '#d1fae5',
          border: '1px solid #10b981',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)'
        }}>
          <strong>Nomination submitted successfully!</strong>
          <p style={{ margin: 'var(--spacing-xs) 0 0 0' }}>
            Nomination ID: <code>{success.nomination_id}</code><br />
            Status: <strong>{success.status}</strong>
          </p>
        </div>
      )}

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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div>
          <label htmlFor="discipline_id" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Discipline *
          </label>
          <select
            id="discipline_id"
            value={selectedDisciplineId}
            onChange={(e) => {
              setSelectedDisciplineId(e.target.value);
              setFormData(prev => ({ ...prev, discipline_id: e.target.value }));
            }}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          >
            <option value="">Select a discipline</option>
            {disciplines.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="discipline_subtype_id" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Subtype *
          </label>
          <select
            id="discipline_subtype_id"
            value={formData.discipline_subtype_id}
            onChange={(e) => setFormData(prev => ({ ...prev, discipline_subtype_id: e.target.value }))}
            disabled={!selectedDisciplineId}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)',
              opacity: selectedDisciplineId ? 1 : 0.6
            }}
          >
            <option value="">Select a subtype</option>
            {subtypes.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="proposed_title" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Proposed Title *
          </label>
          <input
            type="text"
            id="proposed_title"
            value={formData.proposed_title}
            onChange={(e) => setFormData(prev => ({ ...prev, proposed_title: e.target.value }))}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          />
        </div>

        <div>
          <label htmlFor="proposed_ofc_text" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Proposed OFC Text (WHAT capability, no &quot;how&quot;) *
          </label>
          <textarea
            id="proposed_ofc_text"
            value={formData.proposed_ofc_text}
            onChange={(e) => setFormData(prev => ({ ...prev, proposed_ofc_text: e.target.value }))}
            required
            rows={6}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div>
          <label htmlFor="evidence_excerpt" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Evidence Excerpt *
          </label>
          <textarea
            id="evidence_excerpt"
            value={formData.evidence_excerpt}
            onChange={(e) => setFormData(prev => ({ ...prev, evidence_excerpt: e.target.value }))}
            required
            rows={4}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div>
          <label htmlFor="evidence_page" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Evidence Page (optional)
          </label>
          <input
            type="number"
            id="evidence_page"
            value={formData.evidence_page}
            onChange={(e) => setFormData(prev => ({ ...prev, evidence_page: e.target.value }))}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          />
        </div>

        <div>
          <label htmlFor="submitted_by" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Your Name *
          </label>
          <input
            type="text"
            id="submitted_by"
            value={formData.submitted_by}
            onChange={(e) => setFormData(prev => ({ ...prev, submitted_by: e.target.value }))}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          />
        </div>

        <div>
          <label htmlFor="assessment_id" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Assessment ID (optional)
          </label>
          <input
            type="text"
            id="assessment_id"
            value={formData.assessment_id}
            onChange={(e) => setFormData(prev => ({ ...prev, assessment_id: e.target.value }))}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          />
        </div>

        <div>
          <label htmlFor="finding_id" style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Finding ID (optional)
          </label>
          <input
            type="text"
            id="finding_id"
            value={formData.finding_id}
            onChange={(e) => setFormData(prev => ({ ...prev, finding_id: e.target.value }))}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <input
              type="checkbox"
              checked={formData.attestation}
              onChange={(e) => setFormData(prev => ({ ...prev, attestation: e.target.checked }))}
              required
            />
            <span style={{ fontWeight: 600 }}>
              I attest that this OFC nomination is accurate and complete *
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              fontWeight: 600
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Nomination'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

