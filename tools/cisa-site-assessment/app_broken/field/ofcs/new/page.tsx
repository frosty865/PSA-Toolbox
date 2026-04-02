"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createOfc, type CreateOfcRequest } from '@/app/lib/ofcDataProvider';

interface Discipline {
  id: string;
  name: string;
  code: string;
  discipline_subtypes?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}

export default function NewOfcPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [selectedSubtype, setSelectedSubtype] = useState<string>('');

  const [formData, setFormData] = useState<CreateOfcRequest>({
    ofc_text: '',
    rationale: '',
    context_conditions: '',
    discipline: '',
    subtype: '',
    assessment_id: '',
  });

  useEffect(() => {
    const loadDisciplines = async () => {
      try {
        const response = await fetch('/api/reference/disciplines?active=true', {
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          setDisciplines(data.disciplines || []);
        }
      } catch (err) {
        console.error('Error loading disciplines:', err);
      }
    };

    loadDisciplines();
  }, []);

  const availableSubtypes = selectedDiscipline
    ? disciplines
        .find((d) => d.id === selectedDiscipline)
        ?.discipline_subtypes?.filter((st) => st.is_active !== false) || []
    : [];

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
      setLoading(true);

      const request: CreateOfcRequest = {
        ofc_text: formData.ofc_text.trim(),
        rationale: formData.rationale.trim(),
        context_conditions: formData.context_conditions?.trim() || undefined,
        discipline: selectedDiscipline || undefined,
        subtype: selectedSubtype || undefined,
        assessment_id: formData.assessment_id?.trim() || undefined,
      };

      await createOfc(request);
      router.push('/field/ofcs');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create OFC'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section active">
      <div className="section-header">
        <h2 className="section-title">Nominate New OFC</h2>
        <Link href="/field/ofcs" className="usa-button usa-button--outline">
          Back to OFCs
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          <strong>Error:</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="card">
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
              placeholder="Enter the OFC statement..."
            />
            <span className="usa-hint">
              Describe the recommended action or consideration.
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
              placeholder="Explain why this OFC is needed..."
            />
            <span className="usa-hint">
              Provide the reasoning or evidence supporting this OFC.
            </span>
          </div>

          <div className="usa-form-group">
            <label htmlFor="context_conditions" className="usa-label">
              Context / Conditions (Optional)
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
              placeholder="Describe any specific conditions or context..."
            />
            <span className="usa-hint">
              Optional: Describe when or under what conditions this OFC applies.
            </span>
          </div>

          <div className="grid-row grid-gap">
            <div className="tablet:grid-col-6">
              <div className="usa-form-group">
                <label htmlFor="discipline" className="usa-label">
                  Discipline (Optional)
                </label>
                <select
                  id="discipline"
                  name="discipline"
                  className="usa-select"
                  value={selectedDiscipline}
                  onChange={(e) => {
                    setSelectedDiscipline(e.target.value);
                    setSelectedSubtype('');
                    setFormData({
                      ...formData,
                      discipline: e.target.value || undefined,
                      subtype: undefined,
                    });
                  }}
                >
                  <option value="">Select discipline...</option>
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tablet:grid-col-6">
              <div className="usa-form-group">
                <label htmlFor="subtype" className="usa-label">
                  Subtype (Optional)
                </label>
                <select
                  id="subtype"
                  name="subtype"
                  className="usa-select"
                  value={selectedSubtype}
                  onChange={(e) => {
                    setSelectedSubtype(e.target.value);
                    setFormData({
                      ...formData,
                      subtype: e.target.value || undefined,
                    });
                  }}
                  disabled={!selectedDiscipline}
                >
                  <option value="">Select subtype...</option>
                  {availableSubtypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="usa-form-group">
            <label htmlFor="assessment_id" className="usa-label">
              Assessment ID (Optional)
            </label>
            <input
              id="assessment_id"
              name="assessment_id"
              type="text"
              className="usa-input"
              value={formData.assessment_id}
              onChange={(e) =>
                setFormData({ ...formData, assessment_id: e.target.value })
              }
              placeholder="Enter assessment ID if applicable..."
            />
            <span className="usa-hint">
              Optional: Link this OFC to a specific assessment.
            </span>
          </div>

          <div className="usa-form-group">
            <button
              type="submit"
              className="usa-button"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create OFC'}
            </button>
            <Link
              href="/field/ofcs"
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

