"use client";

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import IntentPanel from '@/app/components/IntentPanel';
import OFCReviewQueue from '@/app/components/OFCReviewQueue';
import ReviewerQuestionCard from '@/app/components/ReviewerQuestionCard';
import { assertNoLegacyIntent } from '@/app/lib/invariants/noLegacyIntent';

type TabId = 'assessments' | 'questions' | 'ofcs' | 'ofc-review';

interface Assessment {
  assessment_id: string;
  name: string;
  sector_id?: string;
  sector_name?: string;
  subsector_id?: string;
  subsector_name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  submitted_by?: string;
  submitted_at?: string;
  locked_by?: string;
  locked_at?: string;
}

interface SubtypeGuidance {
  overview?: string;
  indicators_of_risk?: string[];
  common_failures?: string[];
  mitigation_guidance?: string[];
  standards_references?: string[];
  psa_notes?: string;
}

interface Question {
  canon_id?: string;
  question_code: string;
  question_text: string;
  discipline_code?: string;
  subtype_code?: string;
  discipline_subtype_id?: string | null; // Gating: only signal for Help availability in baseline
  subtype_name?: string | null;
  subtype_guidance?: SubtypeGuidance | null;
  scope_type?: string;
  scope_code?: string;
  expansion_version?: string;
  is_active?: boolean;
}

interface OFC {
  ofc_id: string;
  scope: string;
  sector?: string;
  subsector?: string;
  link_type?: string;
  link_key?: string;
  trigger_response?: string;
  ofc_text: string;
  solution_role?: string;
  status: string;
  citation_count?: number;
  created_at?: string;
  updated_at?: string;
}

function AssessmentManagementInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('assessments');

  // Sync activeTab from ?tab= (e.g. /admin/assessments?tab=ofc-review)
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['assessments', 'questions', 'ofcs', 'ofc-review'].includes(t)) {
      setActiveTab(t as TabId);
    }
  }, [searchParams]);

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    router.replace(`/admin/assessments?tab=${id}`, { scroll: false });
  };
  
  // Assessment state
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [includeQA, setIncludeQA] = useState(false);
  
  // Questions state
  const [baseQuestions, setBaseQuestions] = useState<Question[]>([]);
  const [expansionQuestions, setExpansionQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionUniverse, setQuestionUniverse] = useState<'ALL' | 'BASE' | 'EXPANSION'>('ALL');
  const [selectedHelpQuestion, setSelectedHelpQuestion] = useState<Question | null>(null);
  const [reviewerView, setReviewerView] = useState(false);
  
  // OFC state
  const [ofcs, setOfcs] = useState<OFC[]>([]);
  const [loadingOfcs, setLoadingOfcs] = useState(false);
  const [ofcError, setOfcError] = useState<string | null>(null);
  const [ofcStatusFilter, setOfcStatusFilter] = useState<string>('ACTIVE');
  const [ofcScopeFilter, setOfcScopeFilter] = useState<string>('');

  // Load assessments when tab is assessments (intentionally not including loadAssessments to avoid refetch on every render)
  useEffect(() => {
    if (activeTab === 'assessments') {
      loadAssessments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when tab or includeQA changes
  }, [activeTab, includeQA]);

  // Load questions when tab is questions
  useEffect(() => {
    if (activeTab === 'questions') {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when tab or questionUniverse changes
  }, [activeTab, questionUniverse]);

  // Load OFCs when tab is ofcs
  useEffect(() => {
    if (activeTab === 'ofcs') {
      loadOfcs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when tab or filters change
  }, [activeTab, ofcStatusFilter, ofcScopeFilter]);

  const loadAssessments = async () => {
    try {
      setLoadingAssessments(true);
      setAssessmentError(null);
      
      const url = `/api/runtime/assessments${includeQA ? '?include_qa=true' : ''}`;
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to load assessments');
      }
      
      setAssessments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading assessments:', err);
      setAssessmentError(err instanceof Error ? err.message : 'Failed to load assessments');
      setAssessments([]);
    } finally {
      setLoadingAssessments(false);
    }
  };

  const loadQuestions = async () => {
    try {
      setLoadingQuestions(true);
      setQuestionError(null);
      
      const url = `/api/runtime/questions?universe=${questionUniverse}`;
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to load questions');
      }

      assertNoLegacyIntent(data, 'admin/assessments loadQuestions');

      setBaseQuestions(data.base_questions || data.questions || []);
      setExpansionQuestions(data.expansion_questions || []);
    } catch (err) {
      console.error('Error loading questions:', err);
      setQuestionError(err instanceof Error ? err.message : 'Failed to load questions');
      setBaseQuestions([]);
      setExpansionQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const loadOfcs = async () => {
    try {
      setLoadingOfcs(true);
      setOfcError(null);
      
      const params = new URLSearchParams();
      if (ofcStatusFilter) {
        params.append('status', ofcStatusFilter);
      }
      if (ofcScopeFilter) {
        params.append('scope', ofcScopeFilter);
      }
      
      const url = `/api/runtime/ofc-library?${params.toString()}`;
      const response = await fetch(url, { cache: 'no-store' });
      
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error('Failed to parse response from server');
      }
      
      const body = data as { ok?: boolean; ofcs?: unknown[]; error?: { message?: string }; requestId?: string; message?: string };
      if (!response.ok) {
        // Handle standardized error envelope
        if (body.ok === false && body.error) {
          const errorMsg = (body.error as { message?: string }).message ?? 'Failed to load OFCs';
          const requestId = body.requestId ? ` (Request ID: ${body.requestId})` : '';
          throw new Error(`${errorMsg}${requestId}`);
        }
        // Fallback for non-standardized errors
        throw new Error(String(body.error ?? body.message ?? 'Failed to load OFCs'));
      }
      
      // Handle both standardized ({ ok, ofcs }) and legacy (array) response formats
      let ofcsArray: OFC[] = [];
      if (body.ok === true && Array.isArray(body.ofcs)) {
        ofcsArray = body.ofcs as OFC[];
      } else if (Array.isArray(body)) {
        ofcsArray = body as OFC[];
      } else if (body.ofcs && Array.isArray(body.ofcs)) {
        ofcsArray = body.ofcs as OFC[];
      }
      
      setOfcs(ofcsArray);
    } catch (err) {
      console.error('Error loading OFCs:', err);
      setOfcError(err instanceof Error ? err.message : 'Failed to load OFCs');
      setOfcs([]);
    } finally {
      setLoadingOfcs(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeColor = (status: string | undefined) => {
    if (!status) return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
      case 'IN_PROGRESS':
        return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
      case 'SUBMITTED':
        return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
      case 'LOCKED':
        return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      case 'ACTIVE':
        return { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' };
      case 'RETIRED':
        return { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' };
      default:
        return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    }
  };

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Assessment Management</h1>
        <p style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--cisa-gray)', 
          lineHeight: 1.6, 
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          Manage assessments, view questions, and browse the OFC library.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        borderBottom: '2px solid var(--cisa-gray-light)',
        marginBottom: 'var(--spacing-lg)'
      }}>
        {[
          { id: 'assessments', label: 'Assessments', icon: '📋' },
          { id: 'questions', label: 'Questions', icon: '❓' },
          { id: 'ofcs', label: 'OFC Library', icon: '📚' },
          { id: 'ofc-review', label: 'OFC Review', icon: '📋' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id as TabId)}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: activeTab === tab.id ? 'var(--cisa-blue)' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'var(--cisa-gray-dark)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--cisa-blue)' : '2px solid transparent',
              borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
              fontSize: 'var(--font-size-sm)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Assessments Tab */}
      {activeTab === 'assessments' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>
                Assessment List ({assessments.length})
              </h2>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={includeQA}
                    onChange={(e) => setIncludeQA(e.target.checked)}
                  />
                  Include QA
                </label>
                <button
                  onClick={loadAssessments}
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                  disabled={loadingAssessments}
                >
                  {loadingAssessments ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {assessmentError && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--border-radius)',
                color: '#991b1b',
                marginBottom: 'var(--spacing-md)',
                fontSize: 'var(--font-size-sm)'
              }}>
                Error: {assessmentError}
              </div>
            )}

            {loadingAssessments && assessments.length === 0 ? (
              <p>Loading assessments...</p>
            ) : assessments.length === 0 ? (
              <p style={{ color: 'var(--cisa-gray)', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                No assessments found
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--cisa-gray-light)' }}>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Sector</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Subsector</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Created</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((assessment) => {
                      const statusColors = getStatusBadgeColor(assessment.status);
                      return (
                        <tr key={assessment.assessment_id} style={{ borderBottom: '1px solid var(--cisa-gray-light)' }}>
                          <td style={{ padding: 'var(--spacing-sm)' }}>{assessment.name}</td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: statusColors.bg,
                              color: statusColors.color,
                              border: `1px solid ${statusColors.border}`
                            }}>
                              {assessment.status || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>{assessment.sector_name || assessment.sector_id || 'N/A'}</td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>{assessment.subsector_name || assessment.subsector_id || 'N/A'}</td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>{formatDate(assessment.created_at)}</td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>
                            <Link
                              href={`/assessments/${assessment.assessment_id}`}
                              style={{
                                padding: '4px 12px',
                                backgroundColor: 'var(--cisa-blue)',
                                color: '#ffffff',
                                textDecoration: 'none',
                                borderRadius: 'var(--border-radius)',
                                fontSize: 'var(--font-size-sm)',
                                display: 'inline-block'
                              }}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>
                Questions ({baseQuestions.length + expansionQuestions.length} total)
              </h2>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={reviewerView}
                    onChange={(e) => setReviewerView(e.target.checked)}
                  />
                  Reviewer View
                </label>
                <select
                  value={questionUniverse}
                  onChange={(e) => setQuestionUniverse((e.target.value as string) as 'ALL' | 'BASE' | 'EXPANSION')}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--cisa-gray-light)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <option value="ALL">All Questions</option>
                  <option value="BASE">Base Only</option>
                  <option value="EXPANSION">Expansion Only</option>
                </select>
                <button
                  onClick={loadQuestions}
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                  disabled={loadingQuestions}
                >
                  {loadingQuestions ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {questionError && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--border-radius)',
                color: '#991b1b',
                marginBottom: 'var(--spacing-md)',
                fontSize: 'var(--font-size-sm)'
              }}>
                Error: {questionError}
              </div>
            )}

            {loadingQuestions && baseQuestions.length === 0 && expansionQuestions.length === 0 ? (
              <p>Loading questions...</p>
            ) : baseQuestions.length === 0 && expansionQuestions.length === 0 ? (
              <p style={{ color: 'var(--cisa-gray)', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                No questions found
              </p>
            ) : reviewerView ? (
              <div>
                {(questionUniverse === 'ALL' || questionUniverse === 'BASE') && baseQuestions.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                      Base Questions ({baseQuestions.length})
                    </h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      {baseQuestions.map((q) => (
                        <ReviewerQuestionCard
                          key={q.question_code || q.canon_id}
                          question={{
                            canon_id: q.canon_id || q.question_code,
                            question_text: q.question_text,
                            discipline_code: q.discipline_code,
                            subtype_code: q.subtype_code,
                            discipline_subtype_id: q.discipline_subtype_id ?? null,
                            depth: 1,
                          }}
                          defaultOpenIntent={false}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {(questionUniverse === 'ALL' || questionUniverse === 'EXPANSION') && expansionQuestions.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                      Expansion Questions ({expansionQuestions.length})
                    </h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      {expansionQuestions.map((q) => (
                        <ReviewerQuestionCard
                          key={q.question_code}
                          question={{
                            canon_id: q.question_code,
                            question_text: q.question_text,
                            discipline_code: q.discipline_code,
                            subtype_code: q.scope_code,
                            discipline_subtype_id: (q as { discipline_subtype_id?: string | null }).discipline_subtype_id ?? null,
                            depth: 2,
                          }}
                          defaultOpenIntent={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {(questionUniverse === 'ALL' || questionUniverse === 'BASE') && baseQuestions.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
                      Base Questions ({baseQuestions.length})
                    </h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--cisa-gray-light)', position: 'sticky', top: 0, backgroundColor: '#ffffff' }}>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Code</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Text</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Help</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Discipline</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Subtype</th>
                          </tr>
                        </thead>
                        <tbody>
                          {baseQuestions.map((q, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--cisa-gray-light)' }}>
                              <td style={{ padding: 'var(--spacing-sm)', fontFamily: 'monospace' }}>{q.question_code}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>{q.question_text}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>
                                {Boolean(q.discipline_subtype_id) ? (
                                  <button
                                    onClick={() => setSelectedHelpQuestion(q)}
                                    style={{
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      color: 'var(--cisa-blue)',
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      fontSize: 'inherit',
                                      fontFamily: 'inherit'
                                    }}
                                  >
                                    View Help
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--cisa-gray)', fontStyle: 'italic' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>{q.discipline_code || 'N/A'}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>{q.subtype_code || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(questionUniverse === 'ALL' || questionUniverse === 'EXPANSION') && expansionQuestions.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
                      Expansion Questions ({expansionQuestions.length})
                    </h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--cisa-gray-light)', position: 'sticky', top: 0, backgroundColor: '#ffffff' }}>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Code</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Text</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Scope</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Version</th>
                            <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expansionQuestions.map((q, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--cisa-gray-light)' }}>
                              <td style={{ padding: 'var(--spacing-sm)', fontFamily: 'monospace' }}>{q.question_code}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>{q.question_text}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>{q.scope_code || 'N/A'}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>{q.expansion_version || 'N/A'}</td>
                              <td style={{ padding: 'var(--spacing-sm)' }}>
                                {q.is_active ? '✓' : '✗'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OFC Library Tab */}
      {activeTab === 'ofcs' && (
        <div>
          <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>
                OFC Library ({ofcs.length})
              </h2>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={ofcStatusFilter}
                  onChange={(e) => setOfcStatusFilter(e.target.value)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--cisa-gray-light)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="RETIRED">Retired</option>
                </select>
                <select
                  value={ofcScopeFilter}
                  onChange={(e) => setOfcScopeFilter(e.target.value)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--cisa-gray-light)',
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <option value="">All Scopes</option>
                  <option value="BASELINE">Baseline</option>
                  <option value="SECTOR">Sector</option>
                  <option value="SUBSECTOR">Subsector</option>
                </select>
                <button
                  onClick={loadOfcs}
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                  disabled={loadingOfcs}
                >
                  {loadingOfcs ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {ofcError && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--border-radius)',
                color: '#991b1b',
                marginBottom: 'var(--spacing-md)',
                fontSize: 'var(--font-size-sm)'
              }}>
                Error: {ofcError}
              </div>
            )}

            {loadingOfcs && ofcs.length === 0 ? (
              <p>Loading OFCs...</p>
            ) : ofcs.length === 0 ? (
              <p style={{ color: 'var(--cisa-gray)', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                No OFCs found
              </p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--cisa-gray-light)', position: 'sticky', top: 0, backgroundColor: '#ffffff' }}>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>OFC ID</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Text</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Scope</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Link Key</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', fontWeight: 600 }}>Citations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofcs.map((ofc) => {
                      const statusColors = getStatusBadgeColor(ofc.status);
                      return (
                        <tr key={ofc.ofc_id} style={{ borderBottom: '1px solid var(--cisa-gray-light)' }}>
                          <td style={{ padding: 'var(--spacing-sm)', fontFamily: 'monospace', fontSize: '11px' }}>
                            {ofc.ofc_id.substring(0, 8)}...
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', maxWidth: '300px' }}>
                            <div style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {ofc.ofc_text || 'N/A'}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>{ofc.scope || 'N/A'}</td>
                          <td style={{ padding: 'var(--spacing-sm)', fontFamily: 'monospace', fontSize: '11px' }}>
                            {ofc.link_key || 'N/A'}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: statusColors.bg,
                              color: statusColors.color,
                              border: `1px solid ${statusColors.border}`
                            }}>
                              {ofc.status}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)' }}>{ofc.citation_count || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OFC Review Tab */}
      {activeTab === 'ofc-review' && (
        <div>
          <OFCReviewQueue />
        </div>
      )}

      {/* Help Modal */}
      {selectedHelpQuestion && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedHelpQuestion(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-lg)',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                {selectedHelpQuestion.canon_id || selectedHelpQuestion.question_code}
              </h3>
              <button
                onClick={() => setSelectedHelpQuestion(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 'var(--font-size-xl)',
                  cursor: 'pointer',
                  padding: 'var(--spacing-xs)',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--cisa-gray-light)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray-dark)', fontWeight: 600 }}>
                Question:
              </p>
              <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray-dark)' }}>
                {selectedHelpQuestion.question_text}
              </p>
            </div>

            <IntentPanel
              defaultOpen={true}
              disciplineSubtypeId={selectedHelpQuestion.discipline_subtype_id ?? null}
              subtypeCode={selectedHelpQuestion.subtype_code ?? null}
              subtypeGuidance={selectedHelpQuestion.subtype_guidance ?? null}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default function AssessmentManagementPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>Loading...</div>}>
      <AssessmentManagementInner />
    </Suspense>
  );
}
