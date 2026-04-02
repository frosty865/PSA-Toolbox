'use client';

import { useState, useEffect, useMemo } from 'react';
import CapabilityChecklist from './CapabilityChecklist';
import QuestionHelp from './QuestionHelp';
import FollowupQuestions from './FollowupQuestions';
import type { SubtypeChecklist } from '@/app/lib/types/checklist';

interface Question {
  canon_id: string;
  question_text: string;
  discipline_code?: string;
  subtype_code?: string | null; // Allow null to match RequiredElement and QuestionDTO
  subtype_name?: string | null; // Match QuestionDTO
  discipline_subtype_id?: string | null; // UUID reference to discipline_subtypes.id
  subtype_guidance?: unknown | null; // SubtypeGuidance for fallback display
  depth?: number;
  response_enum?: ("YES" | "NO" | "N_A" | "PAPER" | "DIGITAL" | "HYBRID")[];
  response_type?: "YES_NO_NA" | "CHECKLIST" | "ENUM";
  allows_multiple?: boolean;
  response_options?: Array<{ value: string; label: string }>;
  current_response?: "YES" | "NO" | "N/A" | "N_A" | "PAPER" | "DIGITAL" | "HYBRID" | string | string[] | null; // Accept both UI and API formats
  checklist?: SubtypeChecklist | null;
  depth2_tags?: string[];
  parent_spine_canon_id?: string;
}

interface SubtypeQuestionBlockProps {
  spineQuestion: Question; // Depth-1 question
  spineResponse: "YES" | "NO" | "N/A" | "N_A" | null;
  depth2Questions: Question[]; // All depth-2 questions for this subtype
  depth2Responses: Map<string, string>;
  onSpineAnswer: (canonId: string, response: "YES" | "NO" | "N/A" | "N_A") => void;
  onDepth2Answer: (canonId: string, response: "YES" | "NO" | "N/A" | "N_A" | "PAPER" | "DIGITAL" | "HYBRID" | string | null) => void;
  saving?: Record<string, boolean>;
  isReadOnly?: boolean;
  assessmentId?: string; // For localStorage key
  parentResponseId?: string | null; // Response ID for follow-up questions
  subtypeLabel?: string | null; // Human-readable subtype title shown above the question prompt
}

/**
 * SubtypeQuestionBlock Component
 * 
 * Renders a subtype's questions with checklist-driven branching:
 * - Always shows Depth-1 spine question
 * - If spine = YES: shows checklist and reveals depth-2 questions based on selections
 * - If spine = NO or N/A: hides checklist and depth-2 questions
 */
export default function SubtypeQuestionBlock({
  spineQuestion,
  spineResponse,
  depth2Questions,
  depth2Responses,
  onSpineAnswer,
  onDepth2Answer,
  saving = {},
  isReadOnly = false,
  assessmentId,
  parentResponseId,
  subtypeLabel = null,
}: SubtypeQuestionBlockProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  type RefImplBranchingQuestion = {
    id?: string;
    question_text?: string;
    response_type?: string;
    response_enum?: string[];
  };
  type RefImplShape = {
    section3?: { descriptive_branching_yes_only?: RefImplBranchingQuestion[] };
    section_3_descriptive_branching_yes_only?: RefImplBranchingQuestion[];
  };
  const [referenceImpl, setReferenceImpl] = useState<RefImplShape | null>(null);
  const [loadingRefImpl, setLoadingRefImpl] = useState(false);

  // Normalize spine response: "N/A" -> "N_A" for internal consistency
  const normalizedSpineResponse = spineResponse === 'N/A' || spineResponse === 'N_A' 
    ? 'N_A' 
    : (spineResponse === 'YES' || spineResponse === 'NO' ? spineResponse : null) as "YES" | "NO" | "N_A" | null;

  // Load reference implementation when YES is selected (use database-backed API)
  useEffect(() => {
    if (normalizedSpineResponse === 'YES' && spineQuestion.discipline_subtype_id && assessmentId) {
      setLoadingRefImpl(true);
      fetch(`/api/reference/discipline-subtypes/${encodeURIComponent(spineQuestion.discipline_subtype_id)}/reference-impl`)
        .then((res) => {
          if (res.status === 404) {
            // No reference implementation exists yet
            setReferenceImpl(null);
            return null;
          }
          if (!res.ok) {
            throw new Error(`Failed to load: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data && data.ok && data.reference_impl) {
            setReferenceImpl(data.reference_impl as RefImplShape);
          } else {
            setReferenceImpl(null);
          }
        })
        .catch((err) => {
          console.error('Failed to load reference implementation:', err);
          setReferenceImpl(null);
        })
        .finally(() => setLoadingRefImpl(false));
    } else {
      setReferenceImpl(null);
    }
  }, [normalizedSpineResponse, spineQuestion.discipline_subtype_id, assessmentId]);

  // Get follow-up questions from reference implementation
  const followupQuestions = useMemo(() => {
    // Support both section3 (database format) and section_3_descriptive_branching_yes_only (file format)
    const branchingQuestions = referenceImpl?.section3?.descriptive_branching_yes_only || 
                                referenceImpl?.section_3_descriptive_branching_yes_only || [];
    
    if (!branchingQuestions || branchingQuestions.length === 0) {
      return [];
    }
    
    return branchingQuestions.map((q: RefImplBranchingQuestion, idx: number) => {
      // Map response_type from reference impl format to component format
      let mappedResponseType: 'TEXT' | 'ENUM' | 'MULTISELECT' = 'TEXT';
      const rawType = (q.response_type ?? '').toUpperCase();
      if (rawType === 'ENUM') {
        mappedResponseType = 'ENUM';
      } else if (rawType === 'MULTISELECT' || rawType === 'MULTI_SELECT') {
        mappedResponseType = 'MULTISELECT';
      } else if (rawType === 'MULTI_SELECT_OR_TEXT') {
        // MULTI_SELECT_OR_TEXT maps to TEXT (free-form text input)
        mappedResponseType = 'TEXT';
      }
      
        return {
        followup_key: q.id ?? `followup_${idx}`,
        followup_text: q.question_text ?? '',
        response_type: mappedResponseType,
        response_enum: q.response_enum ?? undefined,
      };
    });
  }, [referenceImpl]);

  // Save follow-up responses
  const handleSaveFollowups = async (followups: Array<{ followup_key: string; followup_text: string; response_type: string; value: unknown }>) => {
    if (!assessmentId || !parentResponseId || !spineQuestion.discipline_subtype_id) {
      return;
    }

    try {
      const response = await fetch(`/api/runtime/assessments/${assessmentId}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_response_id: parentResponseId,
          discipline_subtype_id: spineQuestion.discipline_subtype_id,
          followups,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save followups: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to save followup responses:', error);
      throw error;
    }
  };

  // Load selected tags from localStorage (keyed by assessmentId+subtype_code)
  const storageKey = `psa_checklist:${assessmentId || 'unknown'}:${spineQuestion.subtype_code || 'unknown'}`;

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedTags(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  // Save to localStorage when selectedTags changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selectedTags));
    } catch {
      // Ignore localStorage errors
    }
  }, [selectedTags, storageKey]);

  // Clear selections when spine response changes to NO or N_A
  useEffect(() => {
    if (normalizedSpineResponse !== 'YES') {
      setSelectedTags([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [normalizedSpineResponse, storageKey]);

  const checklist = spineQuestion.checklist;

  // Filter depth-2 questions based on selected tags (when tags exist); otherwise show all follow-ons for YES
  const visibleDepth2Questions = useMemo(() => {
    if (normalizedSpineResponse !== 'YES' || depth2Questions.length === 0) {
      return [];
    }

    const anyQuestionHasTags = depth2Questions.some(
      (q) => Array.isArray(q.depth2_tags) && q.depth2_tags.length > 0
    );
    const hasChecklist = Boolean(checklist && checklist.items.length > 0);

    if (!hasChecklist || !anyQuestionHasTags) {
      return depth2Questions;
    }

    if (selectedTags.length === 0) {
      return [];
    }

    return depth2Questions.filter((q) => {
      const questionTags = q.depth2_tags || [];
      return questionTags.some((tag) => selectedTags.includes(tag));
    });
  }, [depth2Questions, selectedTags, normalizedSpineResponse, checklist]);
  const _showChecklist = normalizedSpineResponse === 'YES' && checklist && checklist.items.length > 0;
  void _showChecklist;
  const checklistItemsCount = checklist?.items?.length || 0;
  const normalizedQuestionText = spineQuestion.question_text.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedSubtypeLabel = (subtypeLabel || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const showSubtypeLabel =
    Boolean(normalizedSubtypeLabel) &&
    normalizedSubtypeLabel !== normalizedQuestionText &&
    !normalizedQuestionText.includes(normalizedSubtypeLabel);
  const visuallyHiddenStyle = {
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    border: 0,
  };

  return (
    <div
      style={{
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--cisa-gray-light)',
        borderRadius: 'var(--border-radius)',
        backgroundColor: '#ffffff',
        position: 'relative',
      }}
    >
      {/* DEV-ONLY Debug Strip */}
      {process.env.NODE_ENV !== 'production' && (
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            fontSize: '0.7rem',
            color: '#666',
            backgroundColor: '#f0f0f0',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontFamily: 'monospace',
            zIndex: 10,
          }}
        >
          [DEV] {spineQuestion.subtype_code || 'unknown'} | spine={normalizedSpineResponse || 'null'} | checklistItems={checklistItemsCount}
        </div>
      )}
      {/* Depth-1 Spine Question */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        {showSubtypeLabel && (
          <div
            style={{
              marginBottom: '0.35rem',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: 'var(--cisa-gray)',
            }}
          >
            {subtypeLabel}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#1b1b1b', lineHeight: '1.4' }}>
              {spineQuestion.question_text}
            </h5>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: '#71767a',
              backgroundColor: '#f3f4f6',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {spineQuestion.canon_id}
          </span>
        </div>

        {/* Question Help */}
        <QuestionHelp
          questionId={spineQuestion.canon_id}
          disciplineSubtypeId={spineQuestion.discipline_subtype_id}
          subtypeCode={spineQuestion.subtype_code}
          subtypeGuidance={spineQuestion.subtype_guidance || null}
        />

        {/* Response Options */}
        <fieldset className="usa-fieldset" disabled={isReadOnly || saving[spineQuestion.canon_id]} style={{ marginTop: '0.75rem', padding: 0, border: 'none' }}>
          <legend style={visuallyHiddenStyle}>{spineQuestion.question_text}</legend>
          <div className="usa-radio" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {(spineQuestion.response_enum || ['YES', 'NO', 'N_A']).map((option) => {
              const optionValue = option === 'N_A' ? 'N/A' : option;
              // Compare normalized: convert both to internal format for comparison
              const normalizedOption = option === 'N_A' ? 'N_A' : option;
              const isSelected = normalizedSpineResponse === normalizedOption;
              return (
                <div key={option} className="usa-radio__input usa-radio__input--tile" style={{ margin: 0 }}>
                  <input
                    className="usa-radio__input"
                    id={`${spineQuestion.canon_id}-${option}`}
                    type="radio"
                    name={`response-${spineQuestion.canon_id}`}
                    value={optionValue}
                    checked={isSelected}
                        onChange={() => {
                          if (!isReadOnly && !saving[spineQuestion.canon_id]) {
                            // Normalize: UI shows "N/A" but we store "N_A" internally
                            const normalizedValue = optionValue === 'N/A' ? 'N_A' : optionValue;
                            onSpineAnswer(spineQuestion.canon_id, normalizedValue as "YES" | "NO" | "N_A");
                          }
                        }}
                    disabled={isReadOnly || saving[spineQuestion.canon_id]}
                  />
                  <label
                    className="usa-radio__label"
                    htmlFor={`${spineQuestion.canon_id}-${option}`}
                    style={{
                      padding: '0.75rem 1rem',
                      border: isSelected ? '2px solid #005ea2' : '2px solid #dfe1e2',
                      borderRadius: '0.25rem',
                      backgroundColor: isSelected ? '#e7f3f8' : 'white',
                      cursor: isReadOnly || saving[spineQuestion.canon_id] ? 'not-allowed' : 'pointer',
                      opacity: isReadOnly || saving[spineQuestion.canon_id] ? 0.6 : 1,
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    {optionValue}
                    {saving[spineQuestion.canon_id] && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>(saving...)</span>}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Capability Checklist (only shown if spine = YES) */}
      {normalizedSpineResponse === 'YES' && (
        <>
          {checklist && checklist.items.length > 0 ? (
            <CapabilityChecklist
              items={checklist.items}
              selected={selectedTags}
              onChange={setSelectedTags}
            />
          ) : (
            <div
              style={{
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)',
                backgroundColor: '#f9fafb',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--cisa-gray)',
                fontStyle: 'italic',
              }}
            >
              No capability checklist configured for this subtype.
            </div>
          )}

          {/* Follow-up Questions (YES-only descriptive branching from reference implementation) */}
          {parentResponseId && spineQuestion.discipline_subtype_id && (
            <>
              {loadingRefImpl ? (
                <div
                  style={{
                    marginTop: 'var(--spacing-md)',
                    padding: 'var(--spacing-sm)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--cisa-gray)',
                    fontStyle: 'italic',
                  }}
                >
                  Loading follow-up questions...
                </div>
              ) : followupQuestions.length > 0 ? (
                <FollowupQuestions
                  assessmentId={assessmentId!}
                  parentResponseId={parentResponseId}
                  disciplineSubtypeId={spineQuestion.discipline_subtype_id}
                  followups={followupQuestions}
                  onSave={handleSaveFollowups}
                  isReadOnly={isReadOnly}
                />
              ) : null}
            </>
          )}
        </>
      )}

      {/* Depth-2 Questions (only shown if spine = YES and tags selected) */}
      {normalizedSpineResponse === 'YES' && visibleDepth2Questions.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--cisa-gray-light)' }}>
          <h4
            style={{
              margin: '0 0 var(--spacing-md) 0',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--cisa-gray-dark)',
            }}
          >
            Follow-on Questions ({visibleDepth2Questions.length})
          </h4>

          {visibleDepth2Questions.map((question) => {
            // For CHECKLIST questions, current_response might be a string (PAPER, DIGITAL, HYBRID)
            // For YES/NO/N_A questions, it's YES, NO, or N_A
            const rawResponse = depth2Responses.get(question.canon_id) || question.current_response || null;
            const currentResponse = rawResponse;
            const isSaving = saving[question.canon_id];

            return (
              <div
                key={question.canon_id}
                style={{
                  marginBottom: 'var(--spacing-md)',
                  paddingBottom: 'var(--spacing-md)',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#1b1b1b', lineHeight: '1.4' }}>
                      {question.question_text}
                    </h5>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: '#71767a',
                      backgroundColor: '#f3f4f6',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '0.25rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {question.canon_id}
                  </span>
                </div>

                {/* Question Help */}
                <QuestionHelp
                  questionId={question.canon_id}
                  disciplineSubtypeId={spineQuestion.discipline_subtype_id} // Depth-2 inherits from spine
                  subtypeCode={spineQuestion.subtype_code}
                  subtypeGuidance={spineQuestion.subtype_guidance || null}
                />

                {/* Response Options */}
                <fieldset className="usa-fieldset" disabled={isReadOnly || isSaving} style={{ marginTop: '0.5rem', padding: 0, border: 'none' }}>
                  <legend style={visuallyHiddenStyle}>{question.question_text}</legend>
                  {question.response_type === 'CHECKLIST' && question.response_options ? (
                    // CHECKLIST: Single-select checkbox group
                    <div className="usa-checkbox" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {question.response_options.map((option) => {
                        // For CHECKLIST, current_response can be a string or array
                        const currentRespArray = Array.isArray(currentResponse) 
                          ? currentResponse 
                          : (currentResponse ? [currentResponse] : []);
                        const isSelected = currentRespArray.includes(option.value);
                        return (
                          <div key={option.value} className="usa-checkbox__input usa-checkbox__input--tile" style={{ margin: 0 }}>
                            <input
                              className="usa-checkbox__input"
                              id={`${question.canon_id}-${option.value}`}
                              type="checkbox"
                              name={`response-${question.canon_id}`}
                              value={option.value}
                              checked={isSelected}
                              onChange={(e) => {
                                if (!isReadOnly && !isSaving) {
                                  // Single-select: if allows_multiple is false, only one can be selected
                                  if (!question.allows_multiple) {
                                    // If this option is being checked, set it as the only selected value
                                    // If it's being unchecked, clear the selection
                                    if (e.target.checked) {
                                      // Uncheck all other options by storing only this value
                                      onDepth2Answer(question.canon_id, option.value);
                                    } else {
                                      // If unchecking, clear the selection (store null/empty)
                                      onDepth2Answer(question.canon_id, null);
                                    }
                                  } else {
                                    // Multi-select logic (not used for this question, but included for completeness)
                                    const currentSet = new Set(currentRespArray);
                                    if (e.target.checked) {
                                      currentSet.add(option.value);
                                    } else {
                                      currentSet.delete(option.value);
                                    }
                                    const newResponse = Array.from(currentSet);
                                    // For multi-select, store first value (or null if empty)
                                    // In future, could store as JSON in detail field
                                    onDepth2Answer(question.canon_id, newResponse.length > 0 ? newResponse[0] : null);
                                  }
                                }
                              }}
                              disabled={isReadOnly || isSaving}
                            />
                            <label
                              className="usa-checkbox__label"
                              htmlFor={`${question.canon_id}-${option.value}`}
                              style={{
                                padding: '0.75rem 1rem',
                                border: isSelected ? '2px solid #005ea2' : '2px solid #dfe1e2',
                                borderRadius: '0.25rem',
                                backgroundColor: isSelected ? '#e7f3f8' : 'white',
                                cursor: isReadOnly || isSaving ? 'not-allowed' : 'pointer',
                                opacity: isReadOnly || isSaving ? 0.6 : 1,
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                margin: 0,
                              }}
                            >
                              {option.label}
                              {isSaving && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>(saving...)</span>}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : question.response_type === 'ENUM' && question.response_options ? (
                    // ENUM: Single-select radio group for non-binary questions
                    <div className="usa-radio" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {question.response_options.map((option) => {
                        const optionValue = option.value;
                        const isSelected = currentResponse === optionValue;
                        return (
                          <div key={optionValue} className="usa-radio__input usa-radio__input--tile" style={{ margin: 0 }}>
                            <input
                              className="usa-radio__input"
                              id={`${question.canon_id}-${optionValue}`}
                              type="radio"
                              name={`response-${question.canon_id}`}
                              value={optionValue}
                              checked={isSelected}
                              onChange={() => {
                                if (!isReadOnly && !isSaving) {
                                  onDepth2Answer(question.canon_id, optionValue);
                                }
                              }}
                              disabled={isReadOnly || isSaving}
                            />
                            <label
                              className="usa-radio__label"
                              htmlFor={`${question.canon_id}-${optionValue}`}
                              style={{
                                padding: '0.75rem 1rem',
                                border: isSelected ? '2px solid #005ea2' : '2px solid #dfe1e2',
                                borderRadius: '0.25rem',
                                backgroundColor: isSelected ? '#e7f3f8' : 'white',
                                cursor: isReadOnly || isSaving ? 'not-allowed' : 'pointer',
                                opacity: isReadOnly || isSaving ? 0.6 : 1,
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                margin: 0,
                              }}
                            >
                              {option.label}
                              {isSaving && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>(saving...)</span>}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // YES/NO/N/A: Radio buttons (default)
                    <div className="usa-radio" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {(question.response_enum || ['YES', 'NO', 'N_A']).map((option) => {
                        const optionValue = option === 'N_A' ? 'N/A' : option;
                        // Normalize current response for comparison
                        const normalizedCurrentResp = currentResponse === 'N/A' || currentResponse === 'N_A' 
                          ? 'N_A' 
                          : (currentResponse === 'YES' || currentResponse === 'NO' ? currentResponse : null);
                        const normalizedOption = option === 'N_A' ? 'N_A' : option;
                        const isSelected = normalizedCurrentResp === normalizedOption;
                        return (
                          <div key={option} className="usa-radio__input usa-radio__input--tile" style={{ margin: 0 }}>
                            <input
                              className="usa-radio__input"
                              id={`${question.canon_id}-${option}`}
                              type="radio"
                              name={`response-${question.canon_id}`}
                              value={optionValue}
                              checked={isSelected}
                              onChange={() => {
                                if (!isReadOnly && !isSaving) {
                                  // Normalize: UI shows "N/A" but we store "N_A" internally
                                  const normalizedValue = optionValue === 'N/A' ? 'N_A' : optionValue;
                                  onDepth2Answer(question.canon_id, normalizedValue as "YES" | "NO" | "N_A");
                                }
                              }}
                              disabled={isReadOnly || isSaving}
                            />
                            <label
                              className="usa-radio__label"
                              htmlFor={`${question.canon_id}-${option}`}
                              style={{
                                padding: '0.75rem 1rem',
                                border: isSelected ? '2px solid #005ea2' : '2px solid #dfe1e2',
                                borderRadius: '0.25rem',
                                backgroundColor: isSelected ? '#e7f3f8' : 'white',
                                cursor: isReadOnly || isSaving ? 'not-allowed' : 'pointer',
                                opacity: isReadOnly || isSaving ? 0.6 : 1,
                                display: 'inline-block',
                                whiteSpace: 'nowrap',
                                margin: 0,
                              }}
                            >
                              {optionValue}
                              {isSaving && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>(saving...)</span>}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              </div>
            );
          })}
        </div>
      )}

      {/* Hint when checklist exists but no items selected */}
      {normalizedSpineResponse === 'YES' && checklist && checklist.items.length > 0 && selectedTags.length === 0 && (
        <div
          style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-sm)',
            backgroundColor: '#f0f7ff',
            border: '1px solid #b3d9e6',
            borderRadius: 'var(--border-radius)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--cisa-gray-dark)',
            fontStyle: 'italic',
          }}
        >
          Select capabilities above to see follow-on questions.
        </div>
      )}
    </div>
  );
}
