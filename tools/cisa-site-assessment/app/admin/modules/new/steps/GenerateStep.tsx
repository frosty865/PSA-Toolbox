"use client";

import { useState, useEffect, useRef } from 'react';
import type { WizardState } from '../page';

interface GenerateStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  onError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function GenerateStep({ state, onUpdate, onNext, onBack, onError, loading: _loading, setLoading: _setLoading }: GenerateStepProps) {
  void _loading;
  void _setLoading;
  const [generating, setGenerating] = useState(false);
  const autoRunDone = useRef(false);
  const requestInFlight = useRef(false);

  // Auto-run stream when landing on Generate step (same logic as manual button)
  useEffect(() => {
    if (!state.module_code || !state.sources?.length || generating) return;
    if (state.generated_content?.questions?.length) {
      autoRunDone.current = true;
      return;
    }
    if (autoRunDone.current) return;
    if (requestInFlight.current) return;
    autoRunDone.current = true;

    const run = async () => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      setGenerating(true);
      onError(null);
      try {
        const response = await fetch('/api/admin/modules/wizard/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module_code: state.module_code,
            max_chunks: 12,
          })
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          const errorMsg = data.error?.message || data.error || 'Failed to generate content';
          if (data.error?.code === 'CHUNK_EXPORT_MISSING') {
            onError(
              'Chunk export missing. Run the offline chunk extractor before generating module content for ' +
                state.module_code
            );
            setGenerating(false);
            return;
          }
          throw new Error(errorMsg);
        }

        onUpdate({
          generated_content: {
            questions: data.questions || [],
            ofcs: data.ofcs || []
          }
        });

        onNext();
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : 'Failed to generate content');
        autoRunDone.current = false; // allow Retry
      } finally {
        requestInFlight.current = false;
        setGenerating(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when step is shown
  }, [state.module_code, state.sources?.length]);

  if (!state.module_code) {
    return (
      <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
        <p style={{ color: '#b50909' }}>Module code is required. Please go back to the Define step.</p>
        <button onClick={onBack} style={{ marginTop: 'var(--spacing-md)' }}>Go Back</button>
      </div>
    );
  }

  if (!state.sources || state.sources.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
        <p style={{ color: '#b50909' }}>At least one source is required. Please go back to the Sources step.</p>
        <button onClick={onBack} style={{ marginTop: 'var(--spacing-md)' }}>Go Back</button>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setGenerating(true);
    onError(null);

    try {
      const response = await fetch('/api/admin/modules/wizard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_code: state.module_code,
          max_chunks: 12,
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        const errorMsg = data.error?.message || data.error || 'Failed to generate content';
        if (data.error?.code === 'CHUNK_EXPORT_MISSING') {
          onError(
            'Chunk export missing. Run the offline chunk extractor before generating module content for ' +
              state.module_code
          );
          requestInFlight.current = false;
          setGenerating(false);
          return;
        }
        throw new Error(errorMsg);
      }

      onUpdate({
        generated_content: {
          questions: data.questions || [],
          ofcs: data.ofcs || []
        }
      });

      onNext();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      requestInFlight.current = false;
      setGenerating(false);
    }
  };

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
      <h2 style={{ marginTop: 0 }}>Step 3: Generate Content</h2>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-lg)' }}>
        Generate questions and OFCs from your sources. The system will analyze your sources and create
        existence-based questions with corresponding OFCs that attach on NO responses.
      </p>

      <div style={{
        padding: 'var(--spacing-lg)',
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <h3 style={{ marginTop: 0 }}>Ready to Generate</h3>
        <p>Based on {state.sources?.length || 0} source(s). Generation typically takes 2–10 minutes.</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
          Requires <code>data/module_chunks/{state.module_code}.json</code>. Run the offline chunk extractor for {state.module_code} if needed.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          disabled={generating}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: 'var(--cisa-gray-light)',
            border: '1px solid var(--cisa-gray)',
            borderRadius: '4px',
            cursor: generating ? 'not-allowed' : 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: generating ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: generating ? 'not-allowed' : 'pointer'
          }}
        >
          {generating ? 'Generating… (2–10 min)' : state.generated_content?.questions?.length ? 'Regenerate Content' : 'Generate Content'}
        </button>
      </div>
    </div>
  );
}
