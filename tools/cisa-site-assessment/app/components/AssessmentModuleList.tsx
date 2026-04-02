"use client";

import { useState, useEffect } from 'react';

interface ModuleInstance {
  module_code: string;
  module_name: string;
  description: string | null;
  enabled_at: string;
  is_locked: boolean;
  attached_via: 'USER' | 'SUBSECTOR_DEFAULT' | 'SUBSECTOR_REQUIRED';
}

interface AssessmentModuleListProps {
  assessmentId: string;
  onModuleToggle?: (moduleCode: string, enabled: boolean) => void;
}

export default function AssessmentModuleList({ assessmentId, onModuleToggle }: AssessmentModuleListProps) {
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [availableModules, setAvailableModules] = useState<ModuleInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
    fetchAvailableModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + assessmentId only; fetchModules/fetchAvailableModules are stable
  }, [assessmentId]);

  const fetchModules = async () => {
    try {
      const response = await fetch(`/api/runtime/assessments/${assessmentId}/modules`);
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }
      const data = await response.json();
      setModules(data.modules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModules = async () => {
    try {
      const response = await fetch('/api/admin/modules/library');
      if (response.ok) {
        const data = await response.json();
        setAvailableModules(data.modules || []);
      }
    } catch {
      // Ignore - available modules are optional
    }
  };

  const handleRemoveModule = async (moduleCode: string) => {
    try {
      const response = await fetch(
        `/api/runtime/assessments/${assessmentId}/modules?module_code=${encodeURIComponent(moduleCode)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          alert(errorData.error || 'This module is required by the subsector and cannot be removed');
          return;
        }
        throw new Error(errorData.error || 'Failed to remove module');
      }

      await fetchModules();
      onModuleToggle?.(moduleCode, false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove module');
    }
  };

  const handleAddModule = async (moduleCode: string) => {
    try {
      const response = await fetch(
        `/api/runtime/assessments/${assessmentId}/modules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module_code: moduleCode })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add module');
      }

      await fetchModules();
      onModuleToggle?.(moduleCode, true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add module');
    }
  };

  // Group modules
  const requiredModules = modules.filter(m => m.attached_via === 'SUBSECTOR_REQUIRED');
  const includedModules = modules.filter(m => m.attached_via === 'SUBSECTOR_DEFAULT');
  const optionalModules = modules.filter(m => m.attached_via === 'USER');
  
  // Available modules not yet attached
  const attachedModuleCodes = new Set(modules.map(m => m.module_code));
  const availableToAdd = availableModules.filter(m => !attachedModuleCodes.has(m.module_code));

  const getBadgeColor = (attachedVia: string) => {
    switch (attachedVia) {
      case 'SUBSECTOR_REQUIRED':
        return { bg: '#fee', border: '#fcc', text: '#c00', label: 'Required by subsector' };
      case 'SUBSECTOR_DEFAULT':
        return { bg: '#e3f2fd', border: '#90caf9', text: '#1976d2', label: 'Included by subsector' };
      case 'USER':
        return { bg: '#f5f5f5', border: '#ddd', text: '#666', label: 'Optional' };
      default:
        return { bg: '#f5f5f5', border: '#ddd', text: '#666', label: 'Unknown' };
    }
  };

  if (loading) {
    return <div>Loading modules...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Required Modules */}
      {requiredModules.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-md)' }}>
            Required Modules ({requiredModules.length})
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
            These modules are required by your subsector and cannot be removed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {requiredModules.map((module) => {
              const badge = getBadgeColor(module.attached_via);
              return (
                <div
                  key={module.module_code}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: `1px solid ${badge.border}`,
                    borderRadius: '4px',
                    backgroundColor: badge.bg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      <strong>{module.module_name}</strong>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: badge.border,
                          color: badge.text,
                          fontWeight: 'bold'
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      <code>{module.module_code}</code>
                    </div>
                    {module.description && (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                        {module.description}
                      </div>
                    )}
                  </div>
                  <button
                    disabled
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      backgroundColor: '#ccc',
                      color: '#666',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'not-allowed',
                      fontSize: 'var(--font-size-sm)'
                    }}
                  >
                    Locked
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Included Modules */}
      {includedModules.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-md)' }}>
            Included Modules ({includedModules.length})
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
            These modules are automatically included by your subsector but can be removed if needed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {includedModules.map((module) => {
              const badge = getBadgeColor(module.attached_via);
              return (
                <div
                  key={module.module_code}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: `1px solid ${badge.border}`,
                    borderRadius: '4px',
                    backgroundColor: badge.bg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      <strong>{module.module_name}</strong>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: badge.border,
                          color: badge.text,
                          fontWeight: 'bold'
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      <code>{module.module_code}</code>
                    </div>
                    {module.description && (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                        {module.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveModule(module.module_code)}
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
              );
            })}
          </div>
        </div>
      )}

      {/* Optional Modules */}
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-md)' }}>
          Optional Modules ({optionalModules.length} attached, {availableToAdd.length} available)
        </h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
          These modules were manually added and can be removed at any time.
        </p>
        
        {optionalModules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            {optionalModules.map((module) => {
              const badge = getBadgeColor(module.attached_via);
              return (
                <div
                  key={module.module_code}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: `1px solid ${badge.border}`,
                    borderRadius: '4px',
                    backgroundColor: badge.bg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      <strong>{module.module_name}</strong>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: badge.border,
                          color: badge.text,
                          fontWeight: 'bold'
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      <code>{module.module_code}</code>
                    </div>
                    {module.description && (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                        {module.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveModule(module.module_code)}
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
              );
            })}
          </div>
        )}

        {availableToAdd.length > 0 && (
          <div>
            <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Add Optional Module</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {availableToAdd.map((module) => (
                <div
                  key={module.module_code}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{module.module_name}</strong>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                      <code>{module.module_code}</code>
                    </div>
                    {module.description && (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                        {module.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddModule(module.module_code)}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      backgroundColor: 'var(--cisa-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)'
                    }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {availableToAdd.length === 0 && optionalModules.length === 0 && (
          <p style={{ color: 'var(--cisa-gray)', fontStyle: 'italic' }}>
            No optional modules available.
          </p>
        )}
      </div>
    </div>
  );
}
