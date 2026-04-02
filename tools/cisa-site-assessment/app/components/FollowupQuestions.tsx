'use client';

import { useState, useEffect } from 'react';

interface FollowupQuestion {
  followup_key: string;
  followup_text: string;
  response_type: 'TEXT' | 'ENUM' | 'MULTISELECT';
  response_enum?: string[];
  value?: string | string[] | null;
}

interface FollowupQuestionsProps {
  assessmentId: string;
  parentResponseId: string;
  disciplineSubtypeId: string;
  followups: FollowupQuestion[];
  onSave: (followups: Array<{ followup_key: string; followup_text: string; response_type: string; value: unknown }>) => Promise<void>;
  isReadOnly?: boolean;
}

/**
 * FollowupQuestions Component
 * 
 * Renders YES-only descriptive branching questions from reference implementations.
 * Only shown when baseline question is answered YES.
 */
export default function FollowupQuestions({
  assessmentId,
  parentResponseId,
  disciplineSubtypeId: _disciplineSubtypeId,
  followups,
  onSave,
  isReadOnly = false,
}: FollowupQuestionsProps) {
  void _disciplineSubtypeId;
  const [localFollowups, setLocalFollowups] = useState<FollowupQuestion[]>(followups);
  const [saving, setSaving] = useState(false);

  // Load existing followup responses
  useEffect(() => {
    if (!parentResponseId) return;

    const loadFollowups = async () => {
      try {
        const response = await fetch(
          `/api/runtime/assessments/${assessmentId}/followups?parent_response_id=${encodeURIComponent(parentResponseId)}`
        );
        const data = await response.json();
        
        if (data.ok && Array.isArray(data.followups)) {
          // Map existing responses to followup questions
          const existingMap = new Map(
            data.followups.map((f: Record<string, unknown>) => [f.followup_key as string, f])
          );
          
          setLocalFollowups(
            followups.map((fq) => {
              const existing = existingMap.get(fq.followup_key) as
                | { response_type?: string; response_value_text?: string; response_value_enum?: string; response_value_multi?: string[] }
                | undefined;
              return {
                ...fq,
                value: existing
                  ? existing.response_type === 'TEXT'
                    ? existing.response_value_text
                    : existing.response_type === 'ENUM'
                    ? existing.response_value_enum
                    : existing.response_value_multi
                  : fq.value || null,
              };
            })
          );
        }
      } catch (error) {
        console.error('Failed to load followup responses:', error);
      }
    };

    loadFollowups();
  }, [assessmentId, parentResponseId, followups]);

  const handleChange = (followupKey: string, value: string | string[]) => {
    setLocalFollowups(
      localFollowups.map((fq) =>
        fq.followup_key === followupKey ? { ...fq, value } : fq
      )
    );
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    
    setSaving(true);
    try {
      await onSave(
        localFollowups.map((fq) => ({
          followup_key: fq.followup_key,
          followup_text: fq.followup_text,
          response_type: fq.response_type,
          value: fq.value || null,
        }))
      );
    } catch (error) {
      console.error('Failed to save followup responses:', error);
    } finally {
      setSaving(false);
    }
  };

  if (followups.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        backgroundColor: '#f9fafb',
        border: '1px solid var(--cisa-gray-light)',
        borderRadius: 'var(--border-radius)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--cisa-gray-dark)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        Context (YES-only)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {localFollowups.map((fq) => (
          <div key={fq.followup_key}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                color: 'var(--cisa-gray-dark)',
                marginBottom: '0.5rem',
              }}
            >
              {fq.followup_text}
            </label>

            {fq.response_type === 'TEXT' && (
              <textarea
                value={typeof fq.value === 'string' ? fq.value : ''}
                onChange={(e) => handleChange(fq.followup_key, e.target.value)}
                disabled={isReadOnly || saving}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.5rem',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: '0.25rem',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'inherit',
                }}
                onBlur={handleSave}
              />
            )}

            {fq.response_type === 'ENUM' && fq.response_enum && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fq.response_enum.map((option) => (
                  <label
                    key={option}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 'var(--font-size-sm)',
                      cursor: isReadOnly || saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`followup-${fq.followup_key}`}
                      value={option}
                      checked={fq.value === option}
                      onChange={() => {
                        handleChange(fq.followup_key, option);
                        handleSave();
                      }}
                      disabled={isReadOnly || saving}
                      style={{ marginRight: '0.5rem' }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}

            {fq.response_type === 'MULTISELECT' && fq.response_enum && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fq.response_enum.map((option) => (
                  <label
                    key={option}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 'var(--font-size-sm)',
                      cursor: isReadOnly || saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Array.isArray(fq.value) && fq.value.includes(option)}
                      onChange={(e) => {
                        const current = Array.isArray(fq.value) ? fq.value : [];
                        const newValue = e.target.checked
                          ? [...current, option]
                          : current.filter((v) => v !== option);
                        handleChange(fq.followup_key, newValue);
                        handleSave();
                      }}
                      disabled={isReadOnly || saving}
                      style={{ marginRight: '0.5rem' }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {saving && (
        <div
          style={{
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--cisa-gray)',
            fontStyle: 'italic',
          }}
        >
          Saving...
        </div>
      )}
    </div>
  );
}
