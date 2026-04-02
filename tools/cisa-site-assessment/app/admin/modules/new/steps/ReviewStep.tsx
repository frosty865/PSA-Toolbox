"use client";

import { useState } from 'react';
import type { WizardState } from '../page';

interface ReviewStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  onError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function ReviewStep({ state, onUpdate, onNext, onBack, onError: _onError, loading: _loading, setLoading: _setLoading }: ReviewStepProps) {
  void _onError;
  void _loading;
  void _setLoading;
  // Parent passes key so we remount when generated_content changes; no sync effect needed
  const [questions, setQuestions] = useState(state.generated_content?.questions || []);
  const [ofcs, setOfcs] = useState(state.generated_content?.ofcs || []);

  if (!state.generated_content || questions.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
        <p style={{ color: '#b50909' }}>No generated content found. Please go back to the Generate step.</p>
        <button onClick={onBack} style={{ marginTop: 'var(--spacing-md)' }}>Go Back</button>
      </div>
    );
  }

  const handleQuestionUpdate = (index: number, field: string, value: unknown) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleOFCUpdate = (index: number, field: string, value: unknown) => {
    const updated = [...ofcs];
    updated[index] = { ...updated[index], [field]: value };
    setOfcs(updated);
  };

  const handleSave = () => {
    onUpdate({
      reviewed_content: {
        questions,
        ofcs
      }
    });
    onNext();
  };

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
      <h2 style={{ marginTop: 0 }}>Step 4: Review & Edit</h2>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-lg)' }}>
        Review and edit the generated questions and OFCs. Each question has a corresponding OFC that will
        be shown when the answer is NO.
      </p>

      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3>Questions & OFCs ({questions.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {questions.map((q, qIndex) => {
            const ofc = ofcs.find(o => o.criterion_key === q.criterion_key);
            return (
              <div
                key={q.criterion_key}
                style={{
                  padding: 'var(--spacing-md)',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: '4px',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
                    Question {qIndex + 1}
                  </label>
                  <textarea
                    value={q.question_text}
                    onChange={(e) => handleQuestionUpdate(qIndex, 'question_text', e.target.value)}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm)',
                      fontSize: 'var(--font-size-base)',
                      border: '1px solid var(--cisa-gray-light)',
                      borderRadius: '4px'
                    }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        Asset/Location
                      </label>
                      <input
                        type="text"
                        value={q.asset_or_location}
                        onChange={(e) => handleQuestionUpdate(qIndex, 'asset_or_location', e.target.value)}
                        style={{
                          width: '100%',
                          padding: 'var(--spacing-xs)',
                          fontSize: 'var(--font-size-sm)',
                          border: '1px solid var(--cisa-gray-light)',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        Event Trigger
                      </label>
                      <select
                        value={q.event_trigger || ''}
                        onChange={(e) => handleQuestionUpdate(qIndex, 'event_trigger', e.target.value || undefined)}
                        style={{
                          width: '100%',
                          padding: 'var(--spacing-xs)',
                          fontSize: 'var(--font-size-sm)',
                          border: '1px solid var(--cisa-gray-light)',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="">None</option>
                        <option value="TAMPERING">TAMPERING</option>
                        <option value="FIRE">FIRE</option>
                        <option value="IMPACT">IMPACT</option>
                        <option value="OUTAGE">OUTAGE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>
                  </div>
                </div>

                {ofc && (
                  <div>
                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
                      OFC (shown when answer is NO)
                    </label>
                    <textarea
                      value={ofc.ofc_text}
                      onChange={(e) => {
                        const ofcIndex = ofcs.findIndex(o => o.criterion_key === q.criterion_key);
                        if (ofcIndex >= 0) {
                          handleOFCUpdate(ofcIndex, 'ofc_text', e.target.value);
                        }
                      }}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-base)',
                        border: '1px solid var(--cisa-gray-light)',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
        <button
          onClick={onBack}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: 'var(--cisa-gray-light)',
            border: '1px solid var(--cisa-gray)',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: 'var(--cisa-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Next: Publish
        </button>
      </div>
    </div>
  );
}
