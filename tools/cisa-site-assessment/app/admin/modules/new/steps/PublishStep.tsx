"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WizardState } from '../page';

interface PublishStepProps {
  state: WizardState;
  onBack: () => void;
  onError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function PublishStep({ state, onBack, onError, loading: _loading, setLoading: _setLoading }: PublishStepProps) {
  void _loading;
  void _setLoading;
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  if (!state.module_code || !state.reviewed_content) {
    return (
      <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
        <p style={{ color: '#b50909' }}>Missing required data. Please go back and complete previous steps.</p>
        <button onClick={onBack} style={{ marginTop: 'var(--spacing-md)' }}>Go Back</button>
      </div>
    );
  }

  const handlePublish = async () => {
    setPublishing(true);
    onError(null);

    try {
      const response = await fetch('/api/admin/modules/wizard/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_code: state.module_code,
          questions: state.reviewed_content!.questions,
          ofcs: state.reviewed_content!.ofcs
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to publish module');
      }

      // Clear wizard state
      localStorage.removeItem('module_wizard_state');

      // Redirect to module detail page
      router.push(`/admin/modules/${encodeURIComponent(state.module_code!)}`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to publish module');
      setPublishing(false);
    }
  };

  const questions = state.reviewed_content!.questions;
  const ofcs = state.reviewed_content!.ofcs;

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
      <h2 style={{ marginTop: 0 }}>Step 5: Publish Module</h2>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-lg)' }}>
        Review the summary and publish your module. Once published, it will be available for use in assessments.
      </p>

      <div style={{ 
        padding: 'var(--spacing-lg)', 
        backgroundColor: '#f9fafb', 
        borderRadius: '4px',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <h3 style={{ marginTop: 0 }}>Module Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
          <div>
            <strong>Module Code:</strong>
            <div style={{ fontFamily: 'monospace', marginTop: 'var(--spacing-xs)' }}>{state.module_code}</div>
          </div>
          <div>
            <strong>Title:</strong>
            <div style={{ marginTop: 'var(--spacing-xs)' }}>{state.title}</div>
          </div>
          <div>
            <strong>Questions:</strong>
            <div style={{ marginTop: 'var(--spacing-xs)' }}>{questions.length}</div>
          </div>
          <div>
            <strong>OFCs:</strong>
            <div style={{ marginTop: 'var(--spacing-xs)' }}>{ofcs.length}</div>
          </div>
          <div>
            <strong>Sources:</strong>
            <div style={{ marginTop: 'var(--spacing-xs)' }}>{state.sources?.length || 0}</div>
          </div>
        </div>
      </div>

      <div style={{ 
        padding: 'var(--spacing-md)', 
        backgroundColor: '#d1ecf1', 
        border: '1px solid #bee5eb',
        borderRadius: '4px',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <strong>Ready to Publish</strong>
        <p style={{ marginBottom: 0, marginTop: 'var(--spacing-xs)' }}>
          Publishing will create {questions.length} questions and {ofcs.length} OFCs. 
          The module will be set to ACTIVE status and available for assessments.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
        <button
          onClick={onBack}
          disabled={publishing}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: 'var(--cisa-gray-light)',
            border: '1px solid var(--cisa-gray)',
            borderRadius: '4px',
            cursor: publishing ? 'not-allowed' : 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: publishing ? 'var(--cisa-gray-light)' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: publishing ? 'not-allowed' : 'pointer'
          }}
        >
          {publishing ? 'Publishing...' : 'Publish Module'}
        </button>
      </div>
    </div>
  );
}
