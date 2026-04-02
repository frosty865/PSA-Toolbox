"use client";

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

type ToolCategory = 'watchers' | 'database' | 'ingestion' | 'diagnostics' | 'maintenance';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  command: string;
  requiresParams?: boolean;
  params?: Array<{ name: string; label: string; type: string; placeholder?: string }>;
}

const tools: Tool[] = [
  // Watchers
  {
    id: 'module-watch',
    name: 'Module Ingestion Watcher',
    description: 'Watches storage/module_sources/incoming/ for PDFs and ingests them into RUNTIME',
    category: 'watchers',
    command: 'module:watch',
  },
  {
    id: 'corpus-watch-general',
    name: 'General Corpus Watcher',
    description: 'Watches storage/corpus_sources/incoming/ for general corpus ingestion',
    category: 'watchers',
    command: 'corpus:watch:general',
  },
  {
    id: 'corpus-watch-technology',
    name: 'Technology Library Watcher',
    description: 'Watches storage/corpus_sources/incoming/technology/ for Technology Library ingestion',
    category: 'watchers',
    command: 'corpus:watch:technology',
  },
  // Database Tools
  {
    id: 'db-audit',
    name: 'Database Pool Audit',
    description: 'Audit CORPUS vs RUNTIME database separation',
    category: 'database',
    command: 'db:audit',
  },
  {
    id: 'db-review-schema',
    name: 'Review Schema',
    description: 'Comprehensive database schema review',
    category: 'database',
    command: 'db:review-schema',
  },
  {
    id: 'db-debug-ingestion',
    name: 'Debug Module Ingestion',
    description: 'Check module ingestion status and debug issues',
    category: 'database',
    command: 'db:debug-ingestion',
    requiresParams: true,
    params: [{ name: 'moduleCode', label: 'Module Code', type: 'text', placeholder: 'MODULE_EV_PARKING' }],
  },
  
  // Ingestion Tools
  {
    id: 'corpus-remediate',
    name: 'Remediate Untraceables',
    description: 'Remediate untraceable corpus documents',
    category: 'ingestion',
    command: 'corpus:remediate-untraceables',
  },
  {
    id: 'corpus-backfill',
    name: 'Backfill Source Registry IDs',
    description: 'Backfill missing source_registry_id in corpus documents',
    category: 'ingestion',
    command: 'corpus:backfill-sr-id',
  },
  
  // Diagnostics
  {
    id: 'scope-filter',
    name: 'PSA Scope Filter',
    description: 'Test text against PSA scope (deep network cyber, convergence-only, forbidden plan-element prefix)',
    category: 'diagnostics',
    command: 'diagnostics:scope-filter',
    requiresParams: true,
    params: [{ name: 'text', label: 'Text to test', type: 'textarea', placeholder: 'Paste text to check...' }],
  },
  {
    id: 'verify-file-paths',
    name: 'Verify File Paths',
    description: 'Verify file paths in corpus documents',
    category: 'diagnostics',
    command: 'diagnostics:verify-paths',
  },
  {
    id: 'diagnose-reprocess',
    name: 'Diagnose Reprocess Queue',
    description: 'Diagnose issues in corpus reprocess queue',
    category: 'diagnostics',
    command: 'diagnostics:reprocess-queue',
  },
  
  // Maintenance
  {
    id: 'sync-table-map',
    name: 'Sync Table Map',
    description: 'Sync db_table_map.json with db_ownership.json',
    category: 'maintenance',
    command: 'maintenance:sync-table-map',
  },
  {
    id: 'map-all-tables',
    name: 'Map All Tables',
    description: 'Auto-map unmapped tables to ownership config',
    category: 'maintenance',
    command: 'maintenance:map-tables',
  },
];

export default function ServerToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('watchers');
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set());
  const [toolOutputs, setToolOutputs] = useState<Record<string, string>>({});
  const [toolParams, setToolParams] = useState<Record<string, Record<string, string>>>({});
  const [toolStatuses, setToolStatuses] = useState<Record<string, boolean>>({});
  const [checkingStatus, setCheckingStatus] = useState<Set<string>>(new Set());

  // Check watcher status
  const checkToolStatus = async (toolId: string) => {
    if (checkingStatus.has(toolId)) return;
    
    setCheckingStatus(prev => new Set(prev).add(toolId));
    try {
      const response = await fetch(`/api/admin/server-tools/status?toolId=${toolId}`);
      const data = await response.json();
      setToolStatuses(prev => ({ ...prev, [toolId]: data.running || false }));
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setCheckingStatus(prev => {
        const next = new Set(prev);
        next.delete(toolId);
        return next;
      });
    }
  };

  // Check status for watchers on mount and periodically
  useEffect(() => {
    const watcherTools = tools.filter(t => t.category === 'watchers');
    watcherTools.forEach(tool => checkToolStatus(tool.id));
    
    const interval = setInterval(() => {
      watcherTools.forEach(tool => checkToolStatus(tool.id));
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories: Array<{ id: ToolCategory; label: string; icon: string }> = [
    { id: 'watchers', label: 'Watchers', icon: '👁️' },
    { id: 'database', label: 'Database', icon: '💾' },
    { id: 'ingestion', label: 'Ingestion', icon: '📥' },
    { id: 'diagnostics', label: 'Diagnostics', icon: '🔍' },
    { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
  ];

  const filteredTools = tools.filter(t => t.category === activeTab);

  const handleRunTool = async (tool: Tool) => {
    if (runningTools.has(tool.id)) {
      toast.error('Tool is already running');
      return;
    }

    setRunningTools(prev => new Set(prev).add(tool.id));
    setToolOutputs(prev => ({ ...prev, [tool.id]: 'Starting...\n' }));

    try {
      const params = toolParams[tool.id] || {};
      const response = await fetch('/api/admin/server-tools/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          command: tool.command,
          params,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Tool execution failed');
      }

      setToolOutputs(prev => ({
        ...prev,
        [tool.id]: data.output || data.message || 'Tool completed successfully',
      }));

      toast.success(data.running ? `${tool.name} started` : `${tool.name} completed`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setToolOutputs(prev => ({
        ...prev,
        [tool.id]: `Error: ${msg}\n${prev[tool.id] || ''}`,
      }));
      toast.error(`Failed to run ${tool.name}`);
    } finally {
      setRunningTools(prev => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  const updateParam = (toolId: string, paramName: string, value: string) => {
    setToolParams(prev => ({
      ...prev,
      [toolId]: {
        ...(prev[toolId] || {}),
        [paramName]: value,
      },
    }));
  };

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Server Tools</h1>
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray)',
          lineHeight: 1.6,
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px',
        }}>
          Run server-side scripts and tools for database management, ingestion monitoring, and system diagnostics.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        borderBottom: '2px solid var(--cisa-gray-light)',
        marginBottom: 'var(--spacing-lg)',
      }}>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveTab(category.id)}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: activeTab === category.id ? 'var(--cisa-blue)' : 'transparent',
              color: activeTab === category.id ? '#ffffff' : 'var(--cisa-gray-dark)',
              border: 'none',
              borderBottom: `3px solid ${activeTab === category.id ? 'var(--cisa-blue)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: activeTab === category.id ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ marginRight: 'var(--spacing-xs)' }}>{category.icon}</span>
            {category.label}
          </button>
        ))}
      </div>

      {/* Tools List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {filteredTools.length === 0 ? (
          <div className="card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
            <p style={{ color: 'var(--cisa-gray)', fontSize: 'var(--font-size-base)' }}>
              No tools available in this category.
            </p>
          </div>
        ) : (
          filteredTools.map((tool) => (
            <div key={tool.id} className="card" style={{ padding: 'var(--spacing-lg)' }}>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 600,
                  color: 'var(--cisa-gray-dark)',
                  margin: '0 0 var(--spacing-xs) 0',
                }}>
                  {tool.name}
                </h3>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--cisa-gray)',
                  margin: 0,
                }}>
                  {tool.description}
                </p>
                <code style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--cisa-gray)',
                  backgroundColor: '#f3f4f6',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  marginTop: 'var(--spacing-xs)',
                  display: 'inline-block',
                }}>
                  {tool.command}
                </code>
              </div>

              {/* Parameters */}
              {tool.requiresParams && tool.params && (
                <div style={{
                  marginBottom: 'var(--spacing-md)',
                  padding: 'var(--spacing-md)',
                  backgroundColor: '#f9fafb',
                  borderRadius: 'var(--border-radius)',
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    marginBottom: 'var(--spacing-sm)',
                    color: 'var(--cisa-gray-dark)',
                  }}>
                    Parameters:
                  </label>
                  {tool.params.map((param) => (
                    <div key={param.name} style={{ marginBottom: 'var(--spacing-sm)' }}>
                      <label style={{
                        display: 'block',
                        fontSize: 'var(--font-size-xs)',
                        marginBottom: '4px',
                        color: 'var(--cisa-gray)',
                      }}>
                        {param.label}:
                      </label>
                      {param.type === 'textarea' ? (
                        <textarea
                          placeholder={param.placeholder}
                          value={toolParams[tool.id]?.[param.name] || ''}
                          onChange={(e) => updateParam(tool.id, param.name, e.target.value)}
                          rows={6}
                          style={{
                            width: '100%',
                            maxWidth: '600px',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            border: '1px solid var(--cisa-gray-light)',
                            borderRadius: 'var(--border-radius)',
                            fontSize: 'var(--font-size-sm)',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                          }}
                        />
                      ) : (
                        <input
                          type={param.type}
                          placeholder={param.placeholder}
                          value={toolParams[tool.id]?.[param.name] || ''}
                          onChange={(e) => updateParam(tool.id, param.name, e.target.value)}
                          style={{
                            width: '100%',
                            maxWidth: '400px',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            border: '1px solid var(--cisa-gray-light)',
                            borderRadius: 'var(--border-radius)',
                            fontSize: 'var(--font-size-sm)',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Status Badge (for watchers) */}
              {tool.category === 'watchers' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  <button
                    onClick={() => checkToolStatus(tool.id)}
                    disabled={checkingStatus.has(tool.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'transparent',
                      color: 'var(--cisa-gray)',
                      border: '1px solid var(--cisa-gray-light)',
                      borderRadius: 'var(--border-radius)',
                      cursor: checkingStatus.has(tool.id) ? 'not-allowed' : 'pointer',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    {checkingStatus.has(tool.id) ? 'Checking...' : 'Check Status'}
                  </button>
                  {toolStatuses[tool.id] !== undefined && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: toolStatuses[tool.id] ? '#10b981' : '#ef4444',
                      color: '#ffffff',
                      borderRadius: 'var(--border-radius)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 500,
                    }}>
                      {toolStatuses[tool.id] ? '● Running' : '○ Stopped'}
                    </span>
                  )}
                </div>
              )}

              {/* Run Button */}
              <button
                onClick={() => handleRunTool(tool)}
                disabled={runningTools.has(tool.id) || (tool.category === 'watchers' && toolStatuses[tool.id] === true)}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: runningTools.has(tool.id) || (tool.category === 'watchers' && toolStatuses[tool.id] === true)
                    ? 'var(--cisa-gray)'
                    : 'var(--cisa-blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: runningTools.has(tool.id) || (tool.category === 'watchers' && toolStatuses[tool.id] === true)
                    ? 'not-allowed'
                    : 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  opacity: runningTools.has(tool.id) || (tool.category === 'watchers' && toolStatuses[tool.id] === true) ? 0.6 : 1,
                }}
              >
                {runningTools.has(tool.id)
                  ? 'Running...'
                  : tool.category === 'watchers' && toolStatuses[tool.id] === true
                  ? 'Already Running'
                  : 'Run Tool'}
              </button>

              {/* Output */}
              {toolOutputs[tool.id] && (
                <div style={{
                  marginTop: 'var(--spacing-md)',
                  padding: 'var(--spacing-md)',
                  backgroundColor: '#1f2937',
                  color: '#f3f4f6',
                  borderRadius: 'var(--border-radius)',
                  fontFamily: 'monospace',
                  fontSize: 'var(--font-size-xs)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}>
                  {toolOutputs[tool.id]}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
