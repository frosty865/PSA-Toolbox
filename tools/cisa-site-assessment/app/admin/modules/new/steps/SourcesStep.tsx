"use client";

import { useState, useEffect } from 'react';
import type { WizardState } from '../page';

interface SourcesStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  onError: (error: string | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

/** Module source (RUNTIME.module_sources) for "already in this module" picker */
interface AvailableSource {
  id: string;
  source_key: string;
  publisher: string;
  title: string;
  tier: number;
  source_type?: string;
}

/** Module source (RUNTIME) for "Select from Source Registry" = all documents in module storage */
interface RegistrySource {
  id: string;
  source_key: string;
  publisher: string | null;
  title: string | null;
  tier: number;
  source_type?: string;
  module_code?: string;
  module_name?: string | null;
  sha256?: string | null;
}

export default function SourcesStep({ state, onUpdate, onNext, onBack, onError, loading, setLoading }: SourcesStepProps) {
  // All hooks must be called before any conditional returns
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sources, setSources] = useState(state.sources || []);
  const [uploading, setUploading] = useState(false);
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSourceBrowser, setShowSourceBrowser] = useState(false);
  const [registrySources, setRegistrySources] = useState<RegistrySource[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [registrySearchQuery, setRegistrySearchQuery] = useState('');
  const [showRegistryBrowser, setShowRegistryBrowser] = useState(false);

  // Sync sources with state when it changes (e.g., when loading from draft)
  useEffect(() => {
    if (state.sources) {
      setSources(state.sources);
    }
  }, [state.sources]);

  // Load available sources from this module (RUNTIME.module_sources). Show only module-native
  // sources (MODULE_UPLOAD, URL, etc.), not CORPUS_POINTER (attached from corpus).
  useEffect(() => {
    if (!showSourceBrowser || !state.module_code) return;
    setLoadingSources(true);
    fetch(`/api/admin/modules/${encodeURIComponent(state.module_code)}/sources`)
      .then(r => r.json())
      .then(data => {
        if (data.sources && Array.isArray(data.sources)) {
          const moduleOnly = data.sources.filter((s: Record<string, unknown>) => s.source_type !== 'CORPUS_POINTER');
          setAvailableSources(
            moduleOnly.map((s: Record<string, unknown>) => ({
              id: String(s.id ?? ''),
              source_key: String(s.source_type ?? s.id ?? ''),
              publisher: 'Module',
              title: String(s.source_label ?? s.storage_relpath ?? s.source_url ?? 'Unnamed source'),
              tier: 0,
              source_type: String(s.source_type ?? '')
            }))
          );
        }
      })
      .catch(err => {
        console.error('Failed to load module sources:', err);
      })
      .finally(() => setLoadingSources(false));
  }, [showSourceBrowser, state.module_code]);

  // Load all module sources (RUNTIME) — same list as Source Registry "Module" tab.
  useEffect(() => {
    if (!showRegistryBrowser) return;
    setLoadingRegistry(true);
    fetch('/api/admin/module-sources')
      .then(r => r.json())
      .then(data => {
        if (data.sources && Array.isArray(data.sources)) {
          setRegistrySources(
            data.sources.map((s: Record<string, unknown>) => ({
              id: String(s.id ?? ''),
              source_key: String(s.module_code ?? '') + ':' + String(s.id ?? ''),
              publisher: (s.publisher as string) ?? null,
              title: (s.source_label as string) ?? (s.source_url as string) ?? 'Unnamed',
              tier: 0,
              source_type: (s.source_type as string) ?? undefined,
              module_code: (s.module_code as string) ?? undefined,
              module_name: (s.module_name as string) ?? null,
              sha256: s.sha256 != null ? String(s.sha256) : null
            }))
          );
        } else {
          setRegistrySources([]);
        }
      })
      .catch(err => {
        console.error('Failed to load module sources:', err);
        setRegistrySources([]);
      })
      .finally(() => setLoadingRegistry(false));
  }, [showRegistryBrowser]);

  // Now we can do conditional returns after all hooks
  if (!state.module_code) {
    return (
      <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
        <p style={{ color: '#b50909' }}>Module code is required. Please go back to the Define step.</p>
        <button onClick={onBack} style={{ marginTop: 'var(--spacing-md)' }}>Go Back</button>
      </div>
    );
  }

  const handleAddUrl = async () => {
    if (!sourceUrl.trim() && !sourceLabel.trim()) {
      onError('Please provide either a URL or label');
      return;
    }

    setLoading(true);
    onError(null);

    try {
      const response = await fetch('/api/admin/modules/wizard/sources/add-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_code: state.module_code,
          source_url: sourceUrl.trim() || null,
          source_label: sourceLabel.trim() || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to add source');
      }

      const newSource = {
        id: data.source_id,
        url: sourceUrl.trim() || undefined,
        label: sourceLabel.trim() || undefined
      };

      const updatedSources = [...sources, newSource];
      setSources(updatedSources);
      onUpdate({ sources: updatedSources });
      setSourceUrl('');
      setSourceLabel('');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    onError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module_code', state.module_code!);

      const response = await fetch('/api/admin/modules/wizard/sources/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to upload file');
      }

      const newSource = {
        id: data.source_id,
        upload_path: data.upload_path,
        label: data.source_label ?? file.name
      };

      const updatedSources = [...sources, newSource];
      setSources(updatedSources);
      onUpdate({ sources: updatedSources });
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleRemoveSource = (id: string) => {
    const updatedSources = sources.filter(s => s.id !== id);
    setSources(updatedSources);
    onUpdate({ sources: updatedSources });
  };

  const handleSelectExistingSource = (source: AvailableSource) => {
    // Check if already in current sources
    if (sources.some(s => s.id === source.id)) {
      onError('Source already in list');
      return;
    }
    // Module source is already in DB; just add to wizard state (no API call)
    const newSource = {
      id: source.id,
      url: undefined as string | undefined,
      label: source.title || source.source_key
    };
    const updatedSources = [...sources, newSource];
    setSources(updatedSources);
    onUpdate({ sources: updatedSources });
    onError(null);
  };

  const handleSelectFromRegistry = async (registrySource: RegistrySource) => {
    if (!state.module_code) return;
    if (sources.some(s => s.corpus_source_id === registrySource.id)) {
      onError('This document is already in your sources');
      return;
    }
    setLoading(true);
    onError(null);
    try {
      const response = await fetch('/api/admin/modules/wizard/sources/link-module-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_code: state.module_code,
          from_module_code: registrySource.module_code ?? undefined,
          source_id: registrySource.id
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || data.error?.code || 'Failed to add from module sources');
      }
      const newSource = {
        id: data.source_id,
        label: data.source_label ?? registrySource.title ?? 'Linked document',
        sha256: data.sha256 ?? registrySource.sha256
      };
      const updatedSources = [...sources, newSource];
      setSources(updatedSources);
      onUpdate({ sources: updatedSources });
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to add from module sources');
    } finally {
      setLoading(false);
    }
  };

  const filteredAvailableSources = availableSources.filter(s => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(query)) ||
      (s.source_key && s.source_key.toLowerCase().includes(query)) ||
      (s.publisher && s.publisher.toLowerCase().includes(query))
    );
  });

  const filteredRegistrySources = registrySources.filter(s => {
    if (!registrySearchQuery.trim()) return true;
    const q = registrySearchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.source_key && s.source_key.toLowerCase().includes(q)) ||
      (s.publisher && String(s.publisher).toLowerCase().includes(q))
    );
  });

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
      <h2 style={{ marginTop: 0 }}>Step 2: Add Sources</h2>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-lg)' }}>
        Add research sources for your module. These will be used to generate questions and OFCs.
      </p>

      {/* Add from URL */}
      <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-lg)' }}>Add Source from URL</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/source"
            style={{
              flex: 1,
              padding: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-base)',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: '4px'
            }}
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="Source label (optional)"
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-base)',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: '4px'
            }}
          />
        </div>
        <button
          onClick={handleAddUrl}
          disabled={loading || (!sourceUrl.trim() && !sourceLabel.trim())}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: loading || (!sourceUrl.trim() && !sourceLabel.trim()) ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || (!sourceUrl.trim() && !sourceLabel.trim()) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Adding...' : 'Add Source'}
        </button>
      </div>

      {/* Upload File */}
      <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-lg)' }}>Upload PDF</h3>
        <input
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          disabled={uploading}
          style={{
            width: '100%',
            padding: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-base)',
            border: '1px solid var(--cisa-gray-light)',
            borderRadius: '4px'
          }}
        />
        {uploading && <p style={{ marginTop: 'var(--spacing-xs)', color: 'var(--cisa-gray)' }}>Uploading...</p>}
      </div>

      {/* Select Existing Source */}
      <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
          <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-lg)' }}>Select from sources already in this module</h3>
          <button
            onClick={() => setShowSourceBrowser(!showSourceBrowser)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: showSourceBrowser ? 'var(--cisa-gray)' : 'var(--cisa-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            {showSourceBrowser ? 'Hide' : 'Browse Sources'}
          </button>
        </div>
        
        {showSourceBrowser && (
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or type..."
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-base)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: '4px',
                marginBottom: 'var(--spacing-sm)'
              }}
            />
            
            {loadingSources ? (
              <p style={{ color: 'var(--cisa-gray)', fontStyle: 'italic' }}>Loading sources...</p>
            ) : (
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid var(--cisa-gray-light)', 
                borderRadius: '4px',
                backgroundColor: 'white'
              }}>
                {filteredAvailableSources.length === 0 ? (
                  <p style={{ padding: 'var(--spacing-md)', color: 'var(--cisa-gray)', fontStyle: 'italic', textAlign: 'center' }}>
                    {searchQuery ? 'No sources match your search' : 'No sources in this module yet. Add via URL or Upload above.'}
                  </p>
                ) : (
                  filteredAvailableSources.map((source) => {
                    const isAdded = sources.some(s => s.id === source.id);
                    return (
                      <div
                        key={source.id}
                        style={{
                          padding: 'var(--spacing-sm) var(--spacing-md)',
                          borderBottom: '1px solid var(--cisa-gray-light)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: isAdded ? '#e8f5e9' : 'white'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: 'var(--spacing-xs)' }}>
                            {source.title || source.source_key}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                            {source.publisher && <span>{source.publisher} • </span>}
                            <span>Tier {source.tier}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => !isAdded && handleSelectExistingSource(source)}
                          disabled={isAdded || loading}
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            backgroundColor: isAdded ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isAdded || loading ? 'not-allowed' : 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            opacity: isAdded ? 0.6 : 1
                          }}
                        >
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Select from Source Registry (any document in the registry) */}
      <div style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)', backgroundColor: '#f0f4f8', borderRadius: '4px', border: '1px solid var(--cisa-gray-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
          <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-lg)' }}>Select from Source Registry</h3>
          <button
            onClick={() => setShowRegistryBrowser(!showRegistryBrowser)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: showRegistryBrowser ? 'var(--cisa-gray)' : 'var(--cisa-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            {showRegistryBrowser ? 'Hide' : 'Browse Registry'}
          </button>
        </div>
        <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
          All documents in module storage (any module). Add a source to link it to this module.
        </p>
        {showRegistryBrowser && (
          <div>
            <input
              type="text"
              value={registrySearchQuery}
              onChange={(e) => setRegistrySearchQuery(e.target.value)}
              placeholder="Search by title, publisher, or key..."
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-base)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: '4px',
                marginBottom: 'var(--spacing-sm)'
              }}
            />
            {loadingRegistry ? (
              <p style={{ color: 'var(--cisa-gray)', fontStyle: 'italic' }}>Loading registry...</p>
            ) : (
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}>
                {filteredRegistrySources.length === 0 ? (
                  <p style={{ padding: 'var(--spacing-md)', color: 'var(--cisa-gray)', fontStyle: 'italic', textAlign: 'center' }}>
                    {registrySearchQuery ? 'No module sources match your search' : 'No module sources yet. Upload PDFs or add from URL first.'}
                  </p>
                ) : (
                  filteredRegistrySources.map((source) => {
                    const isAdded =
                      source.module_code === state.module_code ||
                      sources.some(s => (s as { sha256?: string }).sha256 && source.sha256 && (s as { sha256?: string }).sha256 === source.sha256);
                    return (
                      <div
                        key={source.id}
                        style={{
                          padding: 'var(--spacing-sm) var(--spacing-md)',
                          borderBottom: '1px solid var(--cisa-gray-light)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: isAdded ? '#e8f5e9' : 'white'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: 'var(--spacing-xs)' }}>
                            {source.title || source.source_key || 'Untitled'}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                            {(source.module_name || source.module_code) && <span>{source.module_name || source.module_code} • </span>}
                            {source.publisher && <span>{source.publisher} • </span>}
                            {source.source_type && <span>{source.source_type}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => !isAdded && handleSelectFromRegistry(source)}
                          disabled={isAdded || loading}
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            backgroundColor: isAdded ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isAdded || loading ? 'not-allowed' : 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            opacity: isAdded ? 0.6 : 1
                          }}
                        >
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source List */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>Current Sources ({sources.length})</h3>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSources([]);
                onUpdate({ sources: [] });
                onError(null);
              }}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                backgroundColor: '#fff',
                color: '#b91c1c',
                border: '1px solid #b91c1c',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Clear all
            </button>
          )}
        </div>
        {sources.length === 0 ? (
          <p style={{ color: 'var(--cisa-gray)', fontStyle: 'italic' }}>No sources added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {sources.map((source) => (
              <div
                key={source.id}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'white',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  {source.label && <strong>{source.label}</strong>}
                  {source.corpus_source_id && (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      <span style={{ fontStyle: 'italic' }}>Imported from Source Registry</span>
                    </div>
                  )}
                  {source.url && (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>
                    </div>
                  )}
                  {source.upload_path && (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      {source.upload_path}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveSource(source.id)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
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
          onClick={onNext}
          disabled={sources.length === 0}
          style={{
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: sources.length === 0 ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: sources.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          Next: Generate Content
        </button>
      </div>
    </div>
  );
}
