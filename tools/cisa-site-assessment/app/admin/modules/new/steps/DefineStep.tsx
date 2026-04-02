"use client";

import { useState, useEffect } from 'react';
import type { WizardState } from '../page';

interface DefineStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function DefineStep({ state, onUpdate, onNext, onError, loading, setLoading }: DefineStepProps) {
  const [title, setTitle] = useState(state.title || '');
  const [description, setDescription] = useState(state.description || '');
  const [moduleCode, setModuleCode] = useState(state.module_code || '');

  // Auto-generate module code from title
  useEffect(() => {
    if (title.trim() && !state.module_code) {
      const code = title
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const generated = code ? `MODULE_${code}` : '';
      setModuleCode(generated);
    }
  }, [title, state.module_code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    
    if (!title.trim()) {
      onError('Title is required');
      return;
    }

    if (!moduleCode.trim() || !moduleCode.startsWith('MODULE_')) {
      onError('Module code must start with MODULE_');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/modules/wizard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          module_code: moduleCode.trim().toUpperCase()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to create module');
      }

      onUpdate({
        module_code: data.module_code ?? moduleCode.trim().toUpperCase(),
        title: title.trim(),
        description: (description ?? '').trim() || undefined
      });

      onNext();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to create module');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
      <h2 style={{ marginTop: 0 }}>Step 1: Define Module</h2>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-lg)' }}>
        Start by giving your module a name and description. The module code will be auto-generated.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
            Module Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., EV Charging Station Security"
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-base)',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: '4px'
            }}
          />
        </div>

        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
            Module Code *
          </label>
          <input
            type="text"
            value={moduleCode}
            onChange={(e) => setModuleCode(e.target.value.toUpperCase())}
            placeholder="MODULE_EV_CHARGING"
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-base)',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: '4px',
              backgroundColor: '#f5f5f5',
              fontFamily: 'monospace'
            }}
          />
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
            Auto-generated from title. Must start with MODULE_ and contain only uppercase letters, numbers, and underscores.
          </p>
        </div>

        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose and scope of this module..."
            rows={4}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-base)',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: '4px',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => window.location.href = '/admin/modules'}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: 'var(--cisa-gray-light)',
              border: '1px solid var(--cisa-gray)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim() || !moduleCode.trim()}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: loading || !title.trim() || !moduleCode.trim() ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !title.trim() || !moduleCode.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating...' : 'Next: Add Sources'}
          </button>
        </div>
      </form>
    </div>
  );
}
