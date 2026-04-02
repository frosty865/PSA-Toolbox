"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QuestionFocusPage {
  discipline: string;
  subtype: string;
  path: string;
}

interface DisciplineSubtype {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

interface Discipline {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  discipline_subtypes?: DisciplineSubtype[];
}

export default function QuestionFocusPage() {
  const [pages, setPages] = useState<QuestionFocusPage[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load all disciplines
        const disciplinesResponse = await fetch('/api/reference/disciplines?active=true', { cache: 'no-store' });
        if (!disciplinesResponse.ok) {
          throw new Error('Failed to load disciplines');
        }
        const disciplinesData = await disciplinesResponse.json();
        const allDisciplines = (disciplinesData.disciplines || []).filter((d: any) => d.is_active !== false);
        setDisciplines(allDisciplines);
        
        // Load question focus pages
        const pagesResponse = await fetch('/api/reference/question-focus', { cache: 'no-store' });
        if (!pagesResponse.ok) {
          throw new Error('Failed to load question focus pages');
        }
        const pagesData = await pagesResponse.json();
        setPages(pagesData.pages || []);
        
        setError(null);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const toggleDiscipline = (discipline: string) => {
    const newExpanded = new Set(expandedDisciplines);
    if (newExpanded.has(discipline)) {
      newExpanded.delete(discipline);
    } else {
      newExpanded.add(discipline);
    }
    setExpandedDisciplines(newExpanded);
  };

  const expandAll = () => {
    const allDisciplineCodes = new Set(filteredDisciplines.map(d => d.code));
    setExpandedDisciplines(allDisciplineCodes);
  };

  const collapseAll = () => {
    setExpandedDisciplines(new Set());
  };

  // Group pages by discipline code and subtype code (normalize to uppercase for matching)
  const pagesByDisciplineCode = pages.reduce((acc, page) => {
    const normalizedDiscipline = page.discipline.toUpperCase();
    const normalizedSubtype = page.subtype.toUpperCase();
    if (!acc[normalizedDiscipline]) {
      acc[normalizedDiscipline] = {};
    }
    acc[normalizedDiscipline][normalizedSubtype] = page;
    return acc;
  }, {} as Record<string, Record<string, QuestionFocusPage>>);
  
  // Helper to check if a subtype has a question focus page
  // Match by subtype code (normalized to uppercase)
  const hasQuestionFocusPage = (disciplineCode: string, subtype: DisciplineSubtype): boolean => {
    const normalizedDisciplineCode = disciplineCode.toUpperCase();
    const normalizedSubtypeCode = (subtype.code || '').toUpperCase();
    
    const disciplinePages = pagesByDisciplineCode[normalizedDisciplineCode] || {};
    return !!disciplinePages[normalizedSubtypeCode];
  };
  
  // Helper to get question focus page for a subtype
  const getQuestionFocusPage = (disciplineCode: string, subtype: DisciplineSubtype): QuestionFocusPage | null => {
    const normalizedDisciplineCode = disciplineCode.toUpperCase();
    const normalizedSubtypeCode = (subtype.code || '').toUpperCase();
    
    const disciplinePages = pagesByDisciplineCode[normalizedDisciplineCode] || {};
    return disciplinePages[normalizedSubtypeCode] || null;
  };

  // Filter disciplines based on search term
  const filteredDisciplines = searchTerm
    ? disciplines.filter(d => {
        const matchesName = d.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCode = d.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubtype = (d.discipline_subtypes || []).some((st: any) =>
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesName || matchesCode || matchesSubtype;
      })
    : disciplines;

  // Calculate statistics
  const totalSubtypes = disciplines.reduce((sum, d) => {
    const activeSubtypes = (d.discipline_subtypes || []).filter((st: any) => st.is_active !== false);
    return sum + activeSubtypes.length;
  }, 0);
  
  const stats = {
    totalPages: pages.length,
    totalDisciplines: disciplines.length,
    totalSubtypes: totalSubtypes,
    disciplinesWithPages: Object.keys(pagesByDisciplineCode).length
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
          <p>Loading question focus pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          color: '#991b1b'
        }}>
          <h2 style={{ marginTop: 0 }}>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{
          fontSize: 'var(--font-size-xxl)',
          fontWeight: 700,
          color: 'var(--cisa-blue)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          Question Focus Pages
        </h1>
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray)',
          lineHeight: '1.6',
          marginBottom: 'var(--spacing-md)'
        }}>
          These pages describe the focus and intent of baseline questions.
        </p>
        
        {/* Baseline Reference Indicator */}
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--cisa-gray)'
        }}>
          <strong>Baseline Reference:</strong> This page explains the focus of baseline questions. It does not affect scoring.
        </div>

        {/* Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.totalPages}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              Total Pages
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.totalDisciplines}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              Total Disciplines
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.disciplinesWithPages}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              With Pages
            </div>
          </div>
          <div className="card" style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--cisa-blue)' }}>
              {stats.totalSubtypes}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
              Subtypes
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="card" style={{ padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search by discipline or subtype..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                  fontSize: 'var(--font-size-base)'
                }}
              />
            </div>
            <button
              onClick={expandAll}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--cisa-blue)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)'
              }}
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--cisa-gray)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)'
              }}
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Discipline List */}
      {filteredDisciplines.length === 0 ? (
        <div className="card" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <p style={{ color: 'var(--cisa-gray)', fontSize: 'var(--font-size-base)' }}>
            No disciplines found matching your search criteria.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {filteredDisciplines
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((discipline) => {
              const disciplineCode = discipline.code;
              const allSubtypes = (discipline.discipline_subtypes || []).filter((st: any) => st.is_active !== false);
              const isExpanded = expandedDisciplines.has(disciplineCode);
              
              return (
                <div
                  key={discipline.id}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--cisa-gray-light)'
                  }}
                >
                  {/* Discipline Header */}
                  <div style={{
                    backgroundColor: 'var(--cisa-blue)',
                    color: 'white',
                    padding: 'var(--spacing-lg)'
                  }}>
                    <button
                      onClick={() => toggleDiscipline(disciplineCode)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        color: 'inherit',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: 'var(--font-size-xl)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-xs)'
                        }}>
                          {discipline.name}
                        </h3>
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          opacity: 0.95,
                          fontWeight: 400
                        }}>
                          {allSubtypes.length} {allSubtypes.length === 1 ? 'subtype' : 'subtypes'}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 600,
                        marginLeft: 'var(--spacing-md)'
                      }}>
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div style={{
                      padding: 'var(--spacing-lg)',
                      backgroundColor: 'var(--cisa-gray-lighter)',
                      borderTop: '1px solid var(--cisa-gray-light)'
                    }}>
                      {allSubtypes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          {allSubtypes
                            .sort((a: any, b: any) => (a.name || a.code || '').localeCompare(b.name || b.code || ''))
                            .map((subtype: any) => {
                              const hasPage = hasQuestionFocusPage(disciplineCode, subtype);
                              const page = getQuestionFocusPage(disciplineCode, subtype);
                              
                              if (hasPage && page) {
                                return (
                                  <Link
                                    key={subtype.id || subtype.code}
                                    href={`/reference/question-focus/${page.discipline}/${page.subtype}`}
                                    style={{
                                      display: 'block',
                                      padding: 'var(--spacing-sm) var(--spacing-md)',
                                      color: 'var(--cisa-blue)',
                                      textDecoration: 'none',
                                      borderRadius: 'var(--border-radius)',
                                      transition: 'background-color 0.2s',
                                      fontSize: 'var(--font-size-base)',
                                      backgroundColor: 'white',
                                      border: '1px solid var(--cisa-gray-light)'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#eff6ff';
                                      e.currentTarget.style.borderColor = 'var(--cisa-blue)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'white';
                                      e.currentTarget.style.borderColor = 'var(--cisa-gray-light)';
                                    }}
                                  >
                                    {subtype.name || subtype.code}
                                  </Link>
                                );
                              } else {
                                return (
                                  <div
                                    key={subtype.id || subtype.code}
                                    style={{
                                      display: 'block',
                                      padding: 'var(--spacing-sm) var(--spacing-md)',
                                      color: 'var(--cisa-gray)',
                                      fontSize: 'var(--font-size-base)',
                                      backgroundColor: 'white',
                                      border: '1px solid var(--cisa-gray-light)',
                                      borderRadius: 'var(--border-radius)',
                                      opacity: 0.7,
                                      fontStyle: 'italic'
                                    }}
                                  >
                                    {subtype.name || subtype.code} <span style={{ fontSize: 'var(--font-size-sm)' }}>(page not available)</span>
                                  </div>
                                );
                              }
                            })}
                        </div>
                      ) : (
                        <p style={{ 
                          color: 'var(--cisa-gray)',
                          fontSize: 'var(--font-size-base)',
                          fontStyle: 'italic'
                        }}>
                          No subtypes available for this discipline.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

