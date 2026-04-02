"use client";

import { useState, useEffect, useMemo } from 'react';
import { apiUrl } from '@/app/lib/apiUrl';
import { readResponseJson, tryReadResponseJson } from '@/app/lib/http/responseJson';

interface BaselineQuestion {
  canon_id: string;
  discipline_code: string;
  subtype_code?: string | null;
  question_text: string;
  response_enum: string[];
  // Optional fields for compatibility
  discipline_id?: string | null;
  discipline_name?: string | null;
  discipline_subtype_id?: string | null;
  discipline_subtype_name?: string | null;
  discipline_subtype_code?: string | null;
  capability_dimension?: string | null;
}

interface CoverageByDiscipline {
  discipline_id: string;
  discipline_name: string;
  subtype_count: number;
  question_count: number;
  capability_dimensions: string[];
}

interface CoverageBySubtype {
  subtype_id: string;
  subtype_name: string;
  subtype_code: string;
  discipline_id: string;
  discipline_name: string;
  question_count: number;
  capability_dimensions: string[];
}

interface Metadata {
  baseline_version: string;
  status: string;
  total_questions: number;
  subtype_count: number;
  capability_dimensions: string[];
  filtered_count?: number;
}

export default function BaselineQuestionsPage() {
  const [questions, setQuestions] = useState<BaselineQuestion[]>([]);
  const [coverageByDiscipline, setCoverageByDiscipline] = useState<CoverageByDiscipline[]>([]);
  const [coverageBySubtype, setCoverageBySubtype] = useState<CoverageBySubtype[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [disciplineFilter, setDisciplineFilter] = useState<string>('');
  const [subtypeFilter, setSubtypeFilter] = useState<string>('');
  // Note: capability_dimension filter removed (not in spine format)
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (disciplineFilter) params.set('discipline_code', disciplineFilter);
        if (subtypeFilter) params.set('subtype_code', subtypeFilter);
        // Note: capability_dimension filter removed (not in spine format)

        const response = await fetch(
          apiUrl(`/api/reference/baseline-questions?${params.toString()}`),
          { cache: 'no-store', credentials: 'same-origin' }
        );

        if (!response.ok) {
          const errBody = await tryReadResponseJson(response);
          const detail =
            (errBody && typeof errBody.message === 'string' && errBody.message) ||
            (errBody && typeof errBody.error === 'string' && errBody.error) ||
            '';
          throw new Error(
            detail
              ? `Failed to load baseline questions (${response.status}): ${detail}`
              : `Failed to load baseline questions: ${response.status}`
          );
        }

        const data = (await readResponseJson(response)) as {
          success?: boolean;
          spines?: BaselineQuestion[];
          questions?: BaselineQuestion[];
          coverage?: { by_discipline?: CoverageByDiscipline[]; by_subtype?: CoverageBySubtype[] };
          metadata?: Metadata;
        };
        const rows = data.spines ?? data.questions ?? [];
        const hasFilters = Boolean(disciplineFilter || subtypeFilter);
        if (data.success === false) {
          throw new Error('Baseline questions API reported failure.');
        }
        // Unfiltered empty list means DB/config issue; filtered empty is valid (no matches).
        if (!hasFilters && Array.isArray(rows) && rows.length === 0) {
          throw new Error(
            'No baseline questions returned. Ensure RUNTIME_DATABASE_URL is set and baseline_spines_runtime is seeded (see .env.example and docs).'
          );
        }
        setQuestions(rows);
        setCoverageByDiscipline(data.coverage?.by_discipline || []);
        setCoverageBySubtype(data.coverage?.by_subtype || []);
        setMetadata(data.metadata ?? null);
      } catch (err: unknown) {
        console.error('Error loading baseline questions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load baseline questions');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [disciplineFilter, subtypeFilter]);

  // Filter questions by search term
  const filteredQuestions = searchTerm
    ? questions.filter(q => 
        q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.canon_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.discipline_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.discipline_subtype_name || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : questions;

  // Options use API params (discipline_code, subtype_code). After a filter refetch, `questions` only
  // contains matching rows — without "pinning" the active filter, the controlled <select> has no matching
  // <option> and the browser blocks changing the selection.
  const disciplineOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of questions) {
      const code = q.discipline_code?.trim();
      if (!code) continue;
      const label = (q.discipline_name && q.discipline_name.trim()) || code;
      map.set(code, label);
    }
    if (disciplineFilter && !map.has(disciplineFilter)) {
      map.set(disciplineFilter, disciplineFilter);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [questions, disciplineFilter]);

  const subtypeOptions = useMemo(() => {
    const map = new Map<string, { code: string; label: string }>();
    for (const q of questions) {
      const code = q.subtype_code?.trim();
      if (!code) continue;
      if (!map.has(code)) {
        map.set(code, {
          code,
          label: (q.discipline_subtype_name && q.discipline_subtype_name.trim()) || code,
        });
      }
    }
    if (subtypeFilter && !map.has(subtypeFilter)) {
      map.set(subtypeFilter, { code: subtypeFilter, label: subtypeFilter });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [questions, subtypeFilter]);
  // Note: capability_dimension not in spine format - reserved for future filter
  const _uniqueCapabilityDimensions: string[] = [];
  void _uniqueCapabilityDimensions;

  if (loading) {
    return (
      <section className="section active">
        <div className="card" style={{ 
          padding: 'var(--spacing-xl)',
          textAlign: 'center' 
        }}>
          <div className="spinner" style={{ margin: '0 auto var(--spacing-md)' }}></div>
          <p style={{ color: 'var(--cisa-gray)', fontSize: 'var(--font-size-base)' }}>
            Loading baseline questions...
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div className="card" style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--border-radius)',
          color: '#991b1b'
        }}>
          <h2 style={{ marginTop: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Error</h2>
          <p style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Baseline Question Coverage</h1>
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray)',
          lineHeight: '1.6',
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          View baseline questions and their coverage across disciplines and subtypes.{' '}
          <strong>Total Questions</strong> here counts <strong>depth-1</strong> rows from the baseline catalog (active spines in{' '}
          <code style={{ fontSize: '0.9em' }}>baseline_spines_runtime</code>
          ). An assessment run can show a larger number because it also loads depth-2 follow-ups, sector/subsector overlays, and expansion questions.
        </p>
      </div>

      {/* Frozen Status Indicator */}
      {metadata && (
        <div className="card" style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 'var(--border-radius)'
        }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            color: '#0369a1',
            fontWeight: 500
          }}>
            <strong>Baseline Version:</strong> {metadata.baseline_version}
            {metadata.status ? ` (${metadata.status})` : ''} •<strong> Total Questions:</strong>{' '}
            {metadata.total_questions ?? '—'} •<strong> Subtypes:</strong> {metadata.subtype_count ?? '—'} •
            {/* Note: capability_dimensions not in spine format - removed */}
          </p>
        </div>
      )}

      {/* Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
            {metadata?.filtered_count ?? metadata?.total_questions ?? questions.length}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
            Questions {disciplineFilter || subtypeFilter ? '(Filtered)' : ''}
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
            {coverageByDiscipline.length}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
            Disciplines
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
            {coverageBySubtype.length}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
            Subtypes
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
            {metadata?.capability_dimensions?.length ? metadata.capability_dimensions.length : '—'}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
            Capability Dimensions
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{ 
          fontSize: 'var(--font-size-base)', 
          fontWeight: 600, 
          marginBottom: 'var(--spacing-md)',
          color: 'var(--cisa-blue)'
        }}>
          Filters
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 'var(--spacing-md)' 
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500
            }}>
              Discipline
            </label>
            <select
              value={disciplineFilter}
              onChange={(e) => {
                setDisciplineFilter(e.target.value);
                setSubtypeFilter('');
              }}
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              <option value="">All Disciplines</option>
              {disciplineOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500
            }}>
              Subtype
            </label>
            <select
              value={subtypeFilter}
              onChange={(e) => setSubtypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              <option value="">All Subtypes</option>
              {subtypeOptions.map((o) => (
                <option key={`${o.code}`} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500
            }}>
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          </div>
        </div>
        {(disciplineFilter || subtypeFilter || searchTerm) && (
          <button
            onClick={() => {
              setDisciplineFilter('');
              setSubtypeFilter('');
              setSearchTerm('');
            }}
            style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'var(--cisa-gray-light)',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Coverage by Discipline */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{ 
          fontSize: 'var(--font-size-lg)', 
          fontWeight: 600, 
          color: 'var(--cisa-blue)',
          marginBottom: 'var(--spacing-md)'
        }}>
          Coverage by Discipline
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: 'var(--font-size-sm)'
          }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--cisa-blue)', color: 'white' }}>
                <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Discipline</th>
                <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Subtypes</th>
                <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Questions</th>
                <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Capability Dimensions</th>
              </tr>
            </thead>
            <tbody>
              {coverageByDiscipline
                .sort((a, b) => a.discipline_name.localeCompare(b.discipline_name))
                .map((d) => (
                  <tr key={d.discipline_id} style={{ borderBottom: '1px solid var(--cisa-gray-light)' }}>
                    <td style={{ padding: 'var(--spacing-md)' }}>{d.discipline_name}</td>
                    <td style={{ padding: 'var(--spacing-md)' }}>{d.subtype_count}</td>
                    <td style={{ padding: 'var(--spacing-md)' }}>{d.question_count}</td>
                    <td style={{ padding: 'var(--spacing-md)' }}>
                      {/* Note: capability_dimensions removed - not in spine format */}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Questions List */}
      <div className="card">
        <h3 style={{ 
          fontSize: 'var(--font-size-lg)', 
          fontWeight: 600, 
          color: 'var(--cisa-blue)',
          marginBottom: 'var(--spacing-md)'
        }}>
          Questions ({filteredQuestions.length})
        </h3>
        {filteredQuestions.length === 0 ? (
          <p style={{ color: 'var(--cisa-gray)', fontSize: 'var(--font-size-base)', fontStyle: 'italic' }}>
            No questions found matching filters.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {filteredQuestions.map((q) => (
              <div
                key={q.canon_id}
                style={{
                  padding: 'var(--spacing-md)',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-xs)' }}>
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--cisa-blue)' }}>
                      {q.canon_id}: {q.question_text}
                    </strong>
                  </div>
                  <span style={{
                    padding: '2px 6px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '3px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500
                  }}>
                    {q.discipline_code}
                  </span>
                </div>
                <p style={{ 
                  margin: 'var(--spacing-xs) 0',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--cisa-gray-dark)'
                }}>
                  {q.question_text}
                </p>
                <div style={{ 
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--cisa-gray)',
                  marginTop: 'var(--spacing-xs)'
                }}>
                  <span><strong>Discipline:</strong> {q.discipline_name}</span>
                  {' • '}
                  <span><strong>Subtype:</strong> {q.discipline_subtype_name}</span>
                  {' • '}
                  <span><strong>Responses:</strong> {q.response_enum.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

