'use client';

import { useState, useEffect } from 'react';

interface ReferenceImplData {
  discipline_subtype_id: string;
  reference_impl: {
    version: string;
    discipline: string;
    subtype: string;
    section1: {
      baseline_existence_question: {
        question_text: string;
        response_enum: string[];
        clarification: {
          YES: string;
          NO: string;
          N_A: string;
        };
      };
    };
    section2: {
      what_right_looks_like: string[];
    };
    section3: {
      descriptive_branching_yes_only: Array<{
        id: string;
        question_text: string;
        response_type: string;
      }>;
    };
    section4?: {
      ofc_trigger_notes_non_user_facing: string[];
    };
  };
}

interface SubtypeReferenceImplPanelProps {
  disciplineSubtypeId: string | null | undefined;
  onFallbackToDoctrine?: () => void; // Callback if 404, to show subtype doctrine
}

/**
 * SubtypeReferenceImplPanel Component
 * 
 * Fetches and displays database-backed reference implementation for a discipline subtype.
 * Shows sections 1-3 (user-facing). Section 4 is non-user-facing.
 */
export default function SubtypeReferenceImplPanel({
  disciplineSubtypeId,
  onFallbackToDoctrine,
}: SubtypeReferenceImplPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReferenceImplData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!disciplineSubtypeId) {
      setData(null);
      setError(null);
      setNotFound(false);
      return;
    }

    const loadReferenceImpl = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const response = await fetch(
          `/api/reference/discipline-subtypes/${encodeURIComponent(disciplineSubtypeId)}/reference-impl`
        );

        if (response.status === 404) {
          setNotFound(true);
          if (onFallbackToDoctrine) {
            onFallbackToDoctrine();
          }
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load: ${response.status}`);
        }

        const result = await response.json();
        if (result.ok && result.reference_impl) {
          setData({
            discipline_subtype_id: result.discipline_subtype_id,
            reference_impl: result.reference_impl,
          });
        } else {
          setNotFound(true);
          if (onFallbackToDoctrine) {
            onFallbackToDoctrine();
          }
        }
      } catch (err) {
        console.error('Failed to load reference implementation:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadReferenceImpl();
  }, [disciplineSubtypeId, onFallbackToDoctrine]);

  if (!disciplineSubtypeId) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', fontStyle: 'italic' }}>
        No subtype is assigned to this question, so subtype guidance is unavailable.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', fontStyle: 'italic' }}>
        Loading subtype guidance...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-red)', fontStyle: 'italic' }}>
        Failed to load subtype guidance: {error}
      </div>
    );
  }

  if (notFound) {
    // Show message that no reference implementation exists yet
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', fontStyle: 'italic' }}>
        No subtype reference implementation exists yet for this subtype.
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const impl = data.reference_impl as Record<string, unknown>;
  const isCanonical = typeof impl?.purpose === 'string' || impl?.template_version === '2.0';
  const s1 = impl?.section1 as { baseline_existence_question?: { question_text?: string; response_enum?: string[]; clarification?: { YES?: string; NO?: string; N_A?: string } } } | undefined;
  const s2 = (impl?.section2 as { what_right_looks_like?: string[] } | undefined)?.what_right_looks_like || [];
  const s3 = (impl?.section3 as { descriptive_branching_yes_only?: Array<{ id: string; question_text: string; response_type?: string }> } | undefined)?.descriptive_branching_yes_only || [];

  // Canonical template (Purpose, Scope, Core Elements, Common Failure Modes)
  if (isCanonical) {
    const purpose = typeof impl.purpose === 'string' ? impl.purpose : '';
    const scope = typeof impl.scope === 'string' ? impl.scope : '';
    const coreElements = Array.isArray(impl.core_elements) ? impl.core_elements.filter((x): x is string => typeof x === 'string') : [];
    const commonFailureModes = Array.isArray(impl.common_failure_modes) ? impl.common_failure_modes.filter((x): x is string => typeof x === 'string') : [];
    return (
      <div style={{ fontSize: 'var(--font-size-sm)' }}>
        {purpose && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>Purpose</div>
            <div style={{ color: 'var(--cisa-gray-dark)', lineHeight: 1.6 }}>{purpose}</div>
          </div>
        )}
        {scope && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>Scope</div>
            <div style={{ color: 'var(--cisa-gray-dark)', lineHeight: 1.6 }}>{scope}</div>
          </div>
        )}
        {coreElements.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>Core Elements</div>
            <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--cisa-gray-dark)' }}>
              {coreElements.map((item, idx) => (
                <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', lineHeight: 1.5 }}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {commonFailureModes.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>Common Failure Modes</div>
            <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--cisa-gray-dark)' }}>
              {commonFailureModes.map((item, idx) => (
                <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', lineHeight: 1.5 }}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Legacy format (section1, section2, section3)
  const s1q = s1?.baseline_existence_question;
  return (
    <div style={{ fontSize: 'var(--font-size-sm)' }}>
      {/* Section 1: Baseline Existence Question */}
      {s1q && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
            Baseline Existence Question
          </div>
          <div style={{ 
            padding: 'var(--spacing-sm)', 
            backgroundColor: '#ffffff',
            border: '1px solid var(--cisa-gray-light)',
            borderRadius: '0.25rem',
            marginBottom: 'var(--spacing-xs)'
          }}>
            <div style={{ fontWeight: 500, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
              {s1q.question_text}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-xs)' }}>
              Response: {s1q.response_enum?.join(' / ') || 'YES / NO / N_A'}
            </div>
            {s1q.clarification && (
              <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray-dark)' }}>
                {s1q.clarification.YES && (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>YES:</strong> {s1q.clarification.YES}
                  </div>
                )}
                {s1q.clarification.NO && (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>NO:</strong> {s1q.clarification.NO}
                  </div>
                )}
                {s1q.clarification.N_A && (
                  <div>
                    <strong>N/A:</strong> {s1q.clarification.N_A}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 2: What "Right" Looks Like */}
      {s2.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
            What &quot;Right&quot; Looks Like
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--cisa-gray-dark)' }}>
            {s2.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', lineHeight: 1.5 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 3: Descriptive Branching (YES-only) */}
      {s3.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
            Descriptive Branching (YES-only)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {s3.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: '#f9fafb',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: '0.25rem',
                }}
              >
                <div style={{ color: 'var(--cisa-gray-dark)', lineHeight: 1.5 }}>
                  {q.question_text}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: '0.25rem' }}>
                  {q.response_type === 'MULTI_SELECT_OR_TEXT' ? 'Type: Text (free-form)' : `Type: ${q.response_type || 'TEXT'}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
