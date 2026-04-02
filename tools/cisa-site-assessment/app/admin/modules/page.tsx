"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { shouldShowJsonImport } from '@/app/lib/modules/module_workflow_flags';

const actionBarStyle = {
  display: 'flex' as const,
  gap: 'var(--spacing-md)',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  marginBottom: 'var(--spacing-lg)',
};

const primaryBtn = {
  padding: 'var(--spacing-sm) var(--spacing-lg)',
  backgroundColor: 'var(--cisa-blue)',
  color: 'white',
  textDecoration: 'none' as const,
  borderRadius: 'var(--border-radius)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
};

const secondaryBtn = {
  padding: 'var(--spacing-sm) var(--spacing-lg)',
  border: '1px solid var(--cisa-gray-light)',
  borderRadius: 'var(--border-radius)',
  fontSize: 'var(--font-size-sm)',
  color: 'inherit',
  textDecoration: 'none' as const,
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: '#fff',
};

interface ModuleQuestion {
  module_question_id?: string;
  canon_id?: string;
  question_text: string;
  discipline_code?: string;
  subtype_code?: string | null;
  asset_or_location?: string | null;
  event_trigger?: string | null;
  response_enum?: string[];
  question_intent?: string | null;
  order?: number;
}

interface ModuleBreakdown {
  module_code: string;
  module_name?: string;
  description?: string;
  question_codes: string[];
  questions: ModuleQuestion[];
  question_count: number;
  chunk_count?: number;
}

interface BreakdownResponse {
  modules: ModuleBreakdown[];
  total_modules: number;
  total_questions: number;
}

export default function ModulesPage() {
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBreakdown();
  }, []);

  const fetchBreakdown = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use the library endpoint which uses the new database tables
      const response = await fetch('/api/admin/modules/library');
      if (!response.ok) {
        // Try to read error details from response
        let errorMessage = 'Failed to fetch module breakdown';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('[ModulesPage] API Error:', errorData);
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      
      // Transform to match expected format
      const transformed = {
        modules: data.modules.map((m: Record<string, unknown>) => ({
          module_code: m.module_code,
          module_name: m.module_name,
          description: m.description,
          question_codes: (m.questions as Array<Record<string, unknown>>).map((q) => String(q.module_question_id ?? q.canon_id ?? '')),
          questions: m.questions,
          question_count: m.question_count,
          chunk_count: typeof m.chunk_count === 'number' ? m.chunk_count : 0
        })),
        total_modules: data.total,
        total_questions: data.modules.reduce((sum: number, m: Record<string, unknown>) => sum + Number(m.question_count ?? 0), 0)
      };
      
      setBreakdown(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatModuleName = (moduleCode: string): string => {
    return moduleCode
      .replace('MODULE_', '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading) {
    return (
      <section className="section active">
        <div className="card">
          <p>Loading module breakdown...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div className="card" style={{ backgroundColor: '#fee', borderColor: '#fcc' }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchBreakdown} style={{ marginTop: '1rem' }}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Module Breakdown</h1>
        <p style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--cisa-gray)', 
          lineHeight: 1.6, 
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          Overview of all modules and their associated questions. Only modules with questions in the database are shown.
        </p>
      </div>

      {breakdown && (
        <>
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <strong>Total Modules:</strong> {breakdown.total_modules}
              </div>
              <div>
                <strong>Total Questions:</strong> {breakdown.total_questions}
              </div>
            </div>
          </div>

          <div style={actionBarStyle}>
            <Link href="/admin/modules/new" style={primaryBtn}>
              + New Module
            </Link>
            {shouldShowJsonImport() && (
              <Link href="/admin/modules/import" style={secondaryBtn}>
                Import from JSON
              </Link>
            )}
            <button
              type="button"
              onClick={fetchBreakdown}
              style={{
                ...secondaryBtn,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Refresh
            </button>
          </div>

          {breakdown.modules.length === 0 ? (
            <div className="card">
              <p>No modules with questions found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {breakdown.modules.map((module) => (
                <div key={module.module_code} className="card">
                  <h2 style={{ 
                    fontSize: 'var(--font-size-xl)', 
                    marginTop: 0,
                    marginBottom: 'var(--spacing-md)',
                    color: 'var(--cisa-blue)'
                  }}>
                    {module.module_name || formatModuleName(module.module_code)}
                  </h2>
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <strong>Module Code:</strong> <code>{module.module_code}</code>
                  </div>
                  {module.description && (
                    <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--cisa-gray)' }}>
                      {module.description}
                    </div>
                  )}
                  <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span><strong>Question Count:</strong> {module.question_count}</span>
                    <span><strong># Chunks:</strong> {module.chunk_count ?? 0}</span>
                  </div>
                  
                  <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                    <Link 
                      href={`/admin/modules/${encodeURIComponent(module.module_code)}`}
                      style={{
                        display: 'inline-block',
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        backgroundColor: 'var(--cisa-blue)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: 'var(--font-size-sm)'
                      }}
                    >
                      View Details →
                    </Link>
                  </div>
                  
                  <div style={{ marginTop: 'var(--spacing-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
                      Questions ({module.questions.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                      {module.questions.map((question) => {
                        const questionId = question.module_question_id || question.canon_id || 'N/A';
                        return (
                          <div 
                            key={questionId}
                            style={{
                              padding: 'var(--spacing-md)',
                              backgroundColor: '#f9fafb',
                              borderLeft: '3px solid var(--cisa-blue)',
                              borderRadius: '4px'
                            }}
                          >
                            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                              <strong>Question Code:</strong> <code>{questionId}</code>
                            </div>
                            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                              <strong>Question Text:</strong> {question.question_text}
                            </div>
                            {(question.discipline_code || question.asset_or_location || question.event_trigger) && (
                              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                                {question.discipline_code && (
                                  <span><strong>Discipline:</strong> {question.discipline_code}</span>
                                )}
                                {question.subtype_code && (
                                  <span style={{ marginLeft: 'var(--spacing-md)' }}>
                                    <strong>Subtype:</strong> {question.subtype_code}
                                  </span>
                                )}
                                {question.asset_or_location && (
                                  <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                    <strong>Asset/Location:</strong> {question.asset_or_location}
                                  </div>
                                )}
                                {question.event_trigger && (
                                  <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                    <strong>Event Trigger:</strong> {question.event_trigger}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {module.question_codes.length > module.questions.length && (
                    <div style={{ 
                      marginTop: 'var(--spacing-md)',
                      padding: 'var(--spacing-md)',
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '4px'
                    }}>
                      <strong>Warning:</strong> {module.question_codes.length - module.questions.length} question code(s) 
                      not found in database: {module.question_codes
                        .filter(code => !module.questions.some(q => (q.module_question_id || q.canon_id) === code))
                        .join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
