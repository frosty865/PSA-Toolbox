'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { isTechSelectorDiscipline } from '@/app/lib/capabilitySelectorConfig';
import { shouldRenderSpineAsQuestion } from '@/app/lib/assessment/questionPresentation';
import { getDisciplineGate } from '@/app/lib/assessment/disciplineGates';
import { getDisciplineChecklist, usesDisciplineChecklist, getComSubtypeTags, COM_SUBTYPE_TO_TAG } from '@/app/lib/disciplineChecklistConfig';
import CapabilitySelector from './CapabilitySelector';
import CapabilityChecklist from './CapabilityChecklist';
import SubtypeQuestionBlock from './SubtypeQuestionBlock';
import QuestionHelp from './QuestionHelp';
import type { SubtypeChecklist } from '@/app/lib/types/checklist';
// Client-safe helper to format subtype code into display name
function formatSubtypeName(subtypeCode: string | null | undefined): string {
  if (!subtypeCode) return '';
  // Convert ACS_BIOMETRIC_ACCESS -> Biometric Access
  return subtypeCode
    .replace(/^[A-Z]+_/, '') // Remove discipline prefix (ACS_, VSS_, etc.)
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
}

interface QuestionDTO {
  canon_id: string;
  question_text: string;
  discipline_code?: string;
  subtype_code?: string | null;
  subtype_name?: string | null; // May be provided by API
  discipline_subtype_id?: string | null; // UUID reference to discipline_subtypes.id
  subtype_guidance?: unknown | null; // SubtypeGuidance for fallback display
  depth?: number;
  response_enum?: ("YES" | "NO" | "N_A")[];
  current_response?: "YES" | "NO" | "N/A" | "N_A" | string | null;
  checklist?: SubtypeChecklist | null;
  depth2_tags?: string[];
  parent_spine_canon_id?: string;
  response_type?: "YES_NO_NA" | "CHECKLIST" | "ENUM";
  response_options?: Array<{ value: string; label: string }>;
}

interface DisciplineSectionBlockProps {
  disciplineCode: string;
  disciplineName: string;
  sectionId?: string;
  questionsDepth1: QuestionDTO[];
  questionsDepth2: QuestionDTO[];
  responsesByCanonId: Map<string, string>;
  checklistIndexBySubtype: (subtype_code: string) => SubtypeChecklist | null;
  depth2TagsIndexByCanonId?: (canon_id: string) => string[];
  onWriteResponse: (canon_id: string, value: "YES" | "NO" | "N_A") => Promise<void>;
  onResponseChange: (canon_id: string, response: "YES" | "NO" | "N/A" | "N_A" | string) => void;
  saving?: Record<string, boolean>;
  isReadOnly?: boolean;
  assessmentId?: string;
}

/**
 * DisciplineSectionBlock Component
 * 
 * Renders a discipline section with:
 * - Discipline-level questions (subtype_code = null) always shown
 * - For capability selector disciplines: capability selector instead of individual subtype spines
 * - For non-capability selector disciplines: individual subtype spine questions
 * - Follow-on questions (depth-2) based on selections
 */
export default function DisciplineSectionBlock({
  disciplineCode,
  disciplineName,
  sectionId,
  questionsDepth1,
  questionsDepth2,
  responsesByCanonId,
  checklistIndexBySubtype,
  depth2TagsIndexByCanonId,
  onWriteResponse,
  onResponseChange,
  saving = {},
  isReadOnly = false,
  assessmentId,
}: DisciplineSectionBlockProps) {
  // Get the gate definition for this discipline
  const gateDef = getDisciplineGate(disciplineCode);
  
  // Find the gate question object
  const gateQuestion = useMemo(() => {
    if (!gateDef) {
      return null;
    }
    return questionsDepth1.find(q => q.canon_id === gateDef.gate_canon_id) || null;
  }, [questionsDepth1, gateDef]);

  // Get gate response value directly (stable for dependency tracking)
  const gateResponseValue = gateDef ? (responsesByCanonId.get(gateDef.gate_canon_id) || null) : null;
  
  // Check if gate is satisfied (must be computed before useMemos that depend on it)
  // Use the gate response value directly instead of the Map to avoid re-render loops
  const gateOk = useMemo(() => {
    if (!gateDef) {
      return true; // No gate = always satisfied
    }
    // Normalize N/A to N_A for comparison
    const normalizedResponse = gateResponseValue === 'N/A' || gateResponseValue === 'N_A' ? 'N_A' : gateResponseValue;
    // Gate is satisfied only if response is exactly "YES"
    return normalizedResponse === 'YES';
  }, [gateDef, gateResponseValue]);
  
  // Get gate answer for dev strip
  const gateAnswer = gateDef ? (gateResponseValue || 'unset') : 'N/A';

  // Separate discipline-level questions (subtype_code = null) from subtype spines
  // Exclude the gate question from other discipline-level questions
  // Also filter out depth-2 questions that might have been incorrectly included
  // Deduplicate by canon_id to prevent duplicate rendering
  const otherDisciplineLevelQuestions = useMemo(() => {
    const gateCanonId = gateDef?.gate_canon_id;
    const filtered = questionsDepth1.filter(q => 
      !q.subtype_code && 
      q.depth !== 2 &&
      !q.parent_spine_canon_id &&
      q.canon_id !== gateCanonId // Exclude gate question
    );
    // Deduplicate by canon_id (keep first occurrence)
    const seen = new Set<string>();
    return filtered.filter(q => {
      if (seen.has(q.canon_id)) {
        return false;
      }
      seen.add(q.canon_id);
      return true;
    });
  }, [questionsDepth1, gateDef]);

  // Check if discipline uses discipline-level checklist (e.g., COM)
  const usesDisciplineChecklistMemo = usesDisciplineChecklist(disciplineCode);
  const disciplineChecklistItems = useMemo(() => {
    if (!usesDisciplineChecklistMemo) return null;
    return getDisciplineChecklist(disciplineCode);
  }, [disciplineCode, usesDisciplineChecklistMemo]);

  // State for discipline-level checklist selections (for COM)
  const [selectedDisciplineTags, setSelectedDisciplineTags] = useState<string[]>([]);

  // Load discipline checklist selections from localStorage and sync with subtype responses
  const hydratedDisciplineChecklistRef = useRef(false);
  useEffect(() => {
    if (!usesDisciplineChecklistMemo || !assessmentId || !gateOk || hydratedDisciplineChecklistRef.current) return;
    const storageKey = `psa_discipline_checklist:${assessmentId}:${disciplineCode}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedDisciplineTags(parsed);
          // Sync: if tags are selected, ensure corresponding subtypes are YES
          for (const tag of parsed) {
            for (const [subtypeCode, subtypeTags] of Object.entries(COM_SUBTYPE_TO_TAG)) {
              if (subtypeTags.includes(tag)) {
                const spine = hiddenSubtypeSpines.find(s => s.subtype_code === subtypeCode);
                if (spine) {
                  const currentResponse = responsesByCanonId.get(spine.canon_id);
                  if (currentResponse !== 'YES') {
                    // Auto-set to YES if tag is selected
                    onResponseChange(spine.canon_id, 'YES');
                    if (assessmentId) {
                      onWriteResponse(spine.canon_id, 'YES').catch(() => {});
                    }
                  }
                }
              }
            }
          }
        }
        hydratedDisciplineChecklistRef.current = true;
      } else {
        // No saved checklist - infer tags from current subtype responses
        const inferredTags = new Set<string>();
        for (const spine of hiddenSubtypeSpines) {
          const response = responsesByCanonId.get(spine.canon_id);
          if (response === 'YES' && spine.subtype_code) {
            const subtypeTags = getComSubtypeTags(spine.subtype_code);
            subtypeTags.forEach(tag => inferredTags.add(tag));
          }
        }
        if (inferredTags.size > 0) {
          setSelectedDisciplineTags(Array.from(inferredTags));
        }
        hydratedDisciplineChecklistRef.current = true;
      }
    } catch {
      // Ignore localStorage errors
      hydratedDisciplineChecklistRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usesDisciplineChecklistMemo, assessmentId, disciplineCode, gateOk]);

  // Save discipline checklist selections to localStorage
  useEffect(() => {
    if (!usesDisciplineChecklistMemo || !assessmentId) return;
    const storageKey = `psa_discipline_checklist:${assessmentId}:${disciplineCode}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(selectedDisciplineTags));
    } catch {
      // Ignore localStorage errors
    }
  }, [selectedDisciplineTags, usesDisciplineChecklistMemo, assessmentId, disciplineCode]);

  // Determine if we should use capability selector
  // For tech disciplines: use selector when gate is satisfied AND not using discipline checklist
  // For non-tech disciplines: use selector when gate is satisfied (if they have subtype spines)
  const isTechForMemo = isTechSelectorDiscipline(disciplineCode);
  const shouldUseSelectorForMemo = isTechForMemo && gateOk && !usesDisciplineChecklistMemo;

  const gateCanonId = gateDef?.gate_canon_id;

  // Subtype spines that should be shown as individual question cards
  // Only shown for non-tech disciplines when gate is satisfied
  const subtypeSpines = useMemo(() => {
    if (!gateOk) {
      // Gate not satisfied - don't show any subtype spines
      return [];
    }
    if (shouldUseSelectorForMemo) {
      // If using selector, don't show individual cards
      return [];
    }
    // For non-tech disciplines, show as individual question cards when gate is satisfied
    const filtered = questionsDepth1.filter(q => 
      q.subtype_code && 
      q.depth !== 2 && // Exclude depth-2 questions
      !q.parent_spine_canon_id &&
      (gateCanonId ? q.canon_id !== gateCanonId : true) &&
      shouldRenderSpineAsQuestion(disciplineCode, q.subtype_code)
    );
    
    // TEMP DEBUG: Log Rekeying Procedures in subtypeSpines
    const rekeyingSpine = filtered.find(q => q.canon_id === 'BASE-KEY-KEY_REKEYING_PROCEDURES');
    if (rekeyingSpine) {
       
      console.debug('[DisciplineSectionBlock] Rekeying Procedures in subtypeSpines', {
        canon_id: rekeyingSpine.canon_id,
        discipline_subtype_id: rekeyingSpine.discipline_subtype_id,
        subtype_code: rekeyingSpine.subtype_code,
        all_keys: Object.keys(rekeyingSpine),
      });
    }
    
    return filtered;
  }, [questionsDepth1, disciplineCode, shouldUseSelectorForMemo, gateOk, gateCanonId]);

  // Hidden subtype spines: these will be shown in capability selector
  // Only populated when we're using the capability selector AND gate is satisfied
  const hiddenSubtypeSpines = useMemo(() => {
    if (!gateOk || !shouldUseSelectorForMemo) {
      // Gate not satisfied or not using selector - don't populate hidden spines
      return [];
    }
    // For disciplines using selector, include subtype spines (not the gate spine — avoids duplicate rows)
    return questionsDepth1.filter(q => {
      if (!q.subtype_code || q.depth === 2 || q.parent_spine_canon_id) {
        return false; // Exclude non-subtype and depth-2 questions
      }
      if (gateCanonId && q.canon_id === gateCanonId) {
        return false;
      }
      return true;
    });
  }, [questionsDepth1, shouldUseSelectorForMemo, gateOk, gateCanonId]);

  // Group depth-2 questions by subtype
  const depth2BySubtype = useMemo(() => {
    const grouped = new Map<string, QuestionDTO[]>();
    for (const d2q of questionsDepth2) {
      const subtypeCode = d2q.subtype_code || 'UNKNOWN';
      if (!grouped.has(subtypeCode)) {
        grouped.set(subtypeCode, []);
      }
      grouped.get(subtypeCode)!.push(d2q);
    }
    return grouped;
  }, [questionsDepth2]);

  // Build capability selector items from hidden subtype spines
  // Only build when gate is satisfied (hiddenSubtypeSpines is empty otherwise)
  const capabilitySelectorItems = useMemo(() => {
    if (!gateOk) {
      return []; // Gate not satisfied - no selector items
    }
    const bySubtype = new Map<string, { subtype_code: string; label: string; description?: string }>();
    for (const spine of hiddenSubtypeSpines) {
      const subtypeCode = spine.subtype_code!;
      if (bySubtype.has(subtypeCode)) {
        continue;
      }
      // Use subtype_name from API if available, otherwise format from code
      const label = spine.subtype_name || formatSubtypeName(subtypeCode);

      // Extract description from question text if available
      let description: string | undefined;
      if (spine.question_text) {
        const match = spine.question_text.match(/Is a (.+?) capability implemented\?/i);
        if (match && match[1]) {
          description = `${match[1]} capability`;
        }
      }

      bySubtype.set(subtypeCode, {
        subtype_code: subtypeCode,
        label,
        description,
      });
    }
    return Array.from(bySubtype.values());
  }, [hiddenSubtypeSpines, gateOk]);

  // Get selected subtype codes (those with YES response)
  // For COM with discipline checklist: filter by selected tags
  // For other disciplines: use YES responses
  const selectedSubtypeCodes = useMemo(() => {
    if (!gateOk) {
      return []; // Gate not satisfied - no selections
    }
    
    // If using discipline checklist (COM), filter subtypes by selected tags
    if (usesDisciplineChecklistMemo && selectedDisciplineTags.length > 0) {
      return hiddenSubtypeSpines
        .filter(spine => {
          const subtypeCode = spine.subtype_code!;
          const subtypeTags = getComSubtypeTags(subtypeCode);
          // Include if any tag matches selected tags
          return subtypeTags.some(tag => selectedDisciplineTags.includes(tag));
        })
        .map(spine => spine.subtype_code!)
        .filter(Boolean);
    }
    
    // Default: use YES responses
    return hiddenSubtypeSpines
      .filter(spine => {
        const response = responsesByCanonId.get(spine.canon_id);
        // Selected if response is YES (N/A means not selected)
        return response === 'YES';
      })
      .map(spine => spine.subtype_code!)
      .filter(Boolean);
  }, [hiddenSubtypeSpines, responsesByCanonId, gateOk, usesDisciplineChecklistMemo, selectedDisciplineTags]);

  // Handle capability toggle
  const handleToggleSubtype = async (subtypeCode: string, nextSelected: boolean) => {
    if (isReadOnly) return;

    // Find the hidden spine for this subtype
    const spine = hiddenSubtypeSpines.find(s => s.subtype_code === subtypeCode);
    if (!spine) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DisciplineSectionBlock] No spine found for subtype ${subtypeCode}`);
      }
      return;
    }

    // Write response: YES if selected, N_A if unselected
    const responseValue: "YES" | "N_A" = nextSelected ? 'YES' : 'N_A';
    
    try {
      // Update local state immediately for responsive UI
      onResponseChange(spine.canon_id, responseValue === 'YES' ? 'YES' : 'N_A');
      
      // Persist to backend
      if (assessmentId) {
        await onWriteResponse(spine.canon_id, responseValue);
      }
    } catch (error) {
      console.error(`[DisciplineSectionBlock] Failed to write response for ${spine.canon_id}:`, error);
      // Revert on error
      onResponseChange(spine.canon_id, nextSelected ? 'N_A' : 'YES');
    }
  };


  // Get selected tags for a subtype (from checklist selections) — reserved for future use
   
  const _getSelectedTagsForSubtype = (_subtypeCode: string): string[] => {
    return [];
  };

  // Filter depth-2 questions for a subtype based on selected tags — reserved for future use
   
  const _getVisibleDepth2ForSubtype = (subtypeCode: string, selectedTags: string[]): QuestionDTO[] => {
    const depth2Questions = depth2BySubtype.get(subtypeCode) || [];
    
    // If no tag index function provided, show all depth-2 questions for selected subtypes (fallback v1)
    if (!depth2TagsIndexByCanonId) {
      return depth2Questions;
    }

    // If tags are provided, filter by intersection
    if (selectedTags.length === 0) {
      return [];
    }

    return depth2Questions.filter(q => {
      const questionTags = depth2TagsIndexByCanonId(q.canon_id) || q.depth2_tags || [];
      return questionTags.some(tag => selectedTags.includes(tag));
    });
  };

  const isTechDiscipline = isTechSelectorDiscipline(disciplineCode);
  const selectedCount = selectedSubtypeCodes.length;
  
  // Determine if we should use capability selector:
  // - Tech disciplines: use selector when gate is satisfied
  // - Non-tech disciplines: use individual question cards (not selector)
  const shouldUseCapabilitySelector = isTechDiscipline && gateOk;

  return (
    <div
      id={sectionId}
      style={{
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--cisa-gray-light)',
        borderRadius: 'var(--border-radius)',
        backgroundColor: '#ffffff',
        position: 'relative',
        scrollMarginTop: '120px',
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
          [DEV] gate={gateDef?.gate_canon_id || 'NONE'} gateAnswer={gateAnswer} gateOk={gateOk ? 'true' : 'false'}
          {' | '}selected={selectedCount} | hiddenSpines={hiddenSubtypeSpines.length}
        </div>
      )}

      {/* HARD FAIL: Missing Gate Question (DEV ONLY) */}
      {process.env.NODE_ENV !== 'production' && gateDef && !gateQuestion && (
        <div
          style={{
            marginBottom: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            backgroundColor: '#fee',
            border: '2px solid #d13212',
            borderRadius: 'var(--border-radius)',
            color: '#d13212',
            fontWeight: 600,
          }}
        >
          ⚠️ Missing gate question: {gateDef.gate_canon_id}
          <br />
          <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>
            This discipline requires a gate question that was not found in the questions payload.
          </span>
        </div>
      )}

      {/* Discipline Header */}
      <h2
        style={{
          margin: '0 0 var(--spacing-md) 0',
          fontSize: '1.25rem',
          color: '#1b1b1b',
          fontWeight: 600,
        }}
      >
        {disciplineName} ({disciplineCode})
      </h2>

      {/* Gate Question (always shown first): full subtype block when gate is a subtype spine (e.g. VSS), else compact radios */}
      {gateQuestion && gateQuestion.subtype_code && (() => {
        const currentResponse = responsesByCanonId.get(gateQuestion.canon_id) || gateQuestion.current_response || null;
        const normalizedSpineResponse = currentResponse === 'N/A' || currentResponse === 'N_A'
          ? 'N_A'
          : (currentResponse === 'YES' || currentResponse === 'NO' ? currentResponse : null) as "YES" | "NO" | "N_A" | null;
        const gateD2 = depth2BySubtype.get(gateQuestion.subtype_code) || [];
        const gateDepth2Responses = new Map<string, string>();
        for (const d2q of gateD2) {
          const resp = responsesByCanonId.get(d2q.canon_id) || d2q.current_response || null;
          if (typeof resp === 'string' && resp.trim().length > 0) {
            gateDepth2Responses.set(d2q.canon_id, resp === 'N/A' ? 'N_A' : resp);
          }
        }
        return (
          <div
            key={gateQuestion.canon_id}
            style={{
              marginBottom: 'var(--spacing-md)',
              paddingBottom: 'var(--spacing-md)',
              borderBottom: gateOk ? '1px solid #e5e7eb' : '2px solid #005ea2',
            }}
          >
            <SubtypeQuestionBlock
              spineQuestion={gateQuestion}
              spineResponse={normalizedSpineResponse}
              depth2Questions={gateD2}
              depth2Responses={gateDepth2Responses}
              onSpineAnswer={onResponseChange}
              onDepth2Answer={(canonId: string, response: string | null) => {
                if (!response || response === 'PAPER' || response === 'DIGITAL' || response === 'HYBRID') {
                  onResponseChange(canonId, 'N_A');
                } else if (response === 'N/A') {
                  onResponseChange(canonId, 'N/A');
                } else {
                  onResponseChange(canonId, response);
                }
              }}
              saving={saving}
              isReadOnly={isReadOnly}
              assessmentId={assessmentId}
              subtypeLabel={gateQuestion.subtype_name || formatSubtypeName(gateQuestion.subtype_code)}
            />
          </div>
        );
      })()}

      {gateQuestion && !gateQuestion.subtype_code && (() => {
        const currentResponse = responsesByCanonId.get(gateQuestion.canon_id) || gateQuestion.current_response || null;
        const normalizedResponse = currentResponse === 'N/A' || currentResponse === 'N_A' 
          ? 'N_A' 
          : (currentResponse === 'YES' || currentResponse === 'NO' ? currentResponse : null) as "YES" | "NO" | "N_A" | null;
        const isSaving = saving[gateQuestion.canon_id];

        return (
          <div
            key={gateQuestion.canon_id}
            style={{
              marginBottom: 'var(--spacing-md)',
              paddingBottom: 'var(--spacing-md)',
              borderBottom: gateOk ? '1px solid #e5e7eb' : '2px solid #005ea2',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#1b1b1b', lineHeight: '1.4' }}>
                  {gateQuestion.question_text}
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
                {gateQuestion.canon_id}
              </span>
            </div>

            <QuestionHelp
              questionId={gateQuestion.canon_id}
              disciplineSubtypeId={gateQuestion.discipline_subtype_id}
              subtypeCode={gateQuestion.subtype_code}
              subtypeGuidance={gateQuestion.subtype_guidance || null}
            />

            <fieldset className="usa-fieldset" disabled={isReadOnly || isSaving} style={{ marginTop: '0.75rem', padding: 0, border: 'none' }}>
              <legend style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>{gateQuestion.question_text}</legend>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {(gateQuestion.response_enum || ['YES', 'NO', 'N_A']).map((option) => {
                  const optionValue = option === 'N_A' ? 'N/A' : option;
                  const normalizedOption = option === 'N_A' ? 'N_A' : option;
                  const isSelected = normalizedResponse === normalizedOption;
                  return (
                    <div key={option} className="usa-radio" style={{ margin: 0 }}>
                      <input
                        className="usa-radio__input usa-radio__input--tile"
                        id={`${gateQuestion.canon_id}-${option}`}
                        type="radio"
                        name={`response-${gateQuestion.canon_id}`}
                        value={optionValue}
                        checked={isSelected}
                        onChange={() => {
                          if (!isReadOnly && !isSaving) {
                            const normalizedValue = optionValue === 'N/A' ? 'N_A' : optionValue;
                            onResponseChange(gateQuestion.canon_id, normalizedValue as "YES" | "NO" | "N_A");
                          }
                        }}
                        disabled={isReadOnly || isSaving}
                      />
                      <label
                        className="usa-radio__label"
                        htmlFor={`${gateQuestion.canon_id}-${option}`}
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
            </fieldset>
          </div>
        );
      })()}

      {/* Gate Not Satisfied Message */}
      {gateQuestion && !gateOk && (
        <div
          style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: '#f0f0f0',
            border: '1px solid #dfe1e2',
            borderRadius: 'var(--border-radius)',
            fontSize: '0.875rem',
            color: '#565c65',
            fontStyle: 'italic',
          }}
        >
          Additional questions in this area are available when the gate is YES.
        </div>
      )}

      {/* Other Discipline-Level Questions (shown only when gate is satisfied) */}
      {gateOk && otherDisciplineLevelQuestions.map((question) => {
        const currentResponse = responsesByCanonId.get(question.canon_id) || question.current_response || null;
        const normalizedResponse = currentResponse === 'N/A' || currentResponse === 'N_A' 
          ? 'N_A' 
          : (currentResponse === 'YES' || currentResponse === 'NO' ? currentResponse : null) as "YES" | "NO" | "N_A" | null;
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
                <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#1b1b1b', lineHeight: '1.4' }}>
                  {question.question_text}
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
                {question.canon_id}
              </span>
            </div>

            <QuestionHelp
              questionId={question.canon_id}
              disciplineSubtypeId={question.discipline_subtype_id}
              subtypeCode={question.subtype_code}
              subtypeGuidance={question.subtype_guidance || null}
            />

            <fieldset className="usa-fieldset" disabled={isReadOnly || isSaving} style={{ marginTop: '0.75rem', padding: 0, border: 'none' }}>
              <legend style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>{question.question_text}</legend>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {(question.response_enum || ['YES', 'NO', 'N_A']).map((option) => {
                  const optionValue = option === 'N_A' ? 'N/A' : option;
                  const normalizedOption = option === 'N_A' ? 'N_A' : option;
                  const isSelected = normalizedResponse === normalizedOption;
                  return (
                    <div key={option} className="usa-radio" style={{ margin: 0 }}>
                      <input
                        className="usa-radio__input usa-radio__input--tile"
                        id={`${question.canon_id}-${option}`}
                        type="radio"
                        name={`response-${question.canon_id}`}
                        value={optionValue}
                        checked={isSelected}
                        onChange={() => {
                          if (!isReadOnly && !isSaving) {
                            const normalizedValue = optionValue === 'N/A' ? 'N_A' : optionValue;
                            onResponseChange(question.canon_id, normalizedValue as "YES" | "NO" | "N_A");
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
            </fieldset>
          </div>
        );
      })}

      {/* Discipline-Level Checklist (for COM when gate is satisfied) */}
      {gateOk && usesDisciplineChecklistMemo && disciplineChecklistItems && (
        <div
          style={{
            border: '1px solid var(--cisa-gray-light)',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--spacing-md)',
            marginTop: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-md)',
            backgroundColor: '#f9fafb',
          }}
        >
          <h4
            style={{
              margin: '0 0 var(--spacing-sm) 0',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--cisa-gray-dark)',
            }}
          >
            Select applicable capabilities
          </h4>
          <p
            style={{
              margin: '0 0 var(--spacing-md) 0',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--cisa-gray)',
              fontStyle: 'italic',
            }}
          >
            Select the capabilities that are implemented. Follow-on questions will appear based on your selections.
          </p>
          <CapabilityChecklist
            items={disciplineChecklistItems}
            selected={selectedDisciplineTags}
            onChange={(newTags) => {
              // Update tags
              setSelectedDisciplineTags(newTags);
              
              // For COM: automatically set subtype spines based on checklist selection
              if (disciplineCode === 'COM' && assessmentId) {
                // Determine which tags were added/removed
                const addedTags = newTags.filter(tag => !selectedDisciplineTags.includes(tag));
                const removedTags = selectedDisciplineTags.filter(tag => !newTags.includes(tag));

                // Set subtypes to YES when their tag is added
                for (const tag of addedTags) {
                  for (const [subtypeCode, subtypeTags] of Object.entries(COM_SUBTYPE_TO_TAG)) {
                    if (subtypeTags.includes(tag)) {
                      const spine = hiddenSubtypeSpines.find(s => s.subtype_code === subtypeCode);
                      if (spine) {
                        try {
                          onResponseChange(spine.canon_id, 'YES');
                          if (assessmentId) {
                            onWriteResponse(spine.canon_id, 'YES').catch(err => {
                              console.error(`[DisciplineSectionBlock] Failed to set ${subtypeCode} to YES:`, err);
                            });
                          }
                        } catch (error) {
                          console.error(`[DisciplineSectionBlock] Failed to set ${subtypeCode} to YES:`, error);
                        }
                      }
                    }
                  }
                }

                // Set subtypes to N_A when their tag is removed
                for (const tag of removedTags) {
                  for (const [subtypeCode, subtypeTags] of Object.entries(COM_SUBTYPE_TO_TAG)) {
                    if (subtypeTags.includes(tag)) {
                      const spine = hiddenSubtypeSpines.find(s => s.subtype_code === subtypeCode);
                      if (spine) {
                        try {
                          onResponseChange(spine.canon_id, 'N_A');
                          if (assessmentId) {
                            onWriteResponse(spine.canon_id, 'N_A').catch(err => {
                              console.error(`[DisciplineSectionBlock] Failed to set ${subtypeCode} to N_A:`, err);
                            });
                          }
                        } catch (error) {
                          console.error(`[DisciplineSectionBlock] Failed to set ${subtypeCode} to N_A:`, error);
                        }
                      }
                    }
                  }
                }
              }
            }}
          />
        </div>
      )}

      {/* Capability Selector (for other tech disciplines when gate is satisfied) */}
      {gateOk && shouldUseCapabilitySelector && !usesDisciplineChecklistMemo && capabilitySelectorItems.length > 0 && (
        <CapabilitySelector
          disciplineCode={disciplineCode}
          items={capabilitySelectorItems}
          selectedSubtypeCodes={selectedSubtypeCodes}
          onToggleSubtype={handleToggleSubtype}
        />
      )}

      {/* Subtype Spine Questions (for non-tech disciplines when gate is satisfied) */}
      {gateOk && !shouldUseCapabilitySelector && subtypeSpines.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          {subtypeSpines.map((spine) => {
            const subtypeCode = spine.subtype_code!;
            const depth2Questions = depth2BySubtype.get(subtypeCode) || [];
            const spineResponse = responsesByCanonId.get(spine.canon_id) || spine.current_response || null;
            const normalizedSpineResponse = spineResponse === 'N/A' || spineResponse === 'N_A' 
              ? 'N_A' 
              : (spineResponse === 'YES' || spineResponse === 'NO' ? spineResponse : null) as "YES" | "NO" | "N_A" | null;

            const depth2Responses = new Map<string, string>();
            for (const d2q of depth2Questions) {
              const resp = responsesByCanonId.get(d2q.canon_id) || d2q.current_response || null;
              if (typeof resp === 'string' && resp.trim().length > 0) {
                depth2Responses.set(d2q.canon_id, resp === 'N/A' ? 'N_A' : resp);
              }
            }

            return (
              <SubtypeQuestionBlock
                key={subtypeCode}
                spineQuestion={spine}
                spineResponse={normalizedSpineResponse}
                depth2Questions={depth2Questions}
                depth2Responses={depth2Responses}
                onSpineAnswer={onResponseChange}
                onDepth2Answer={(canonId: string, response: string | null) => {
                  // Convert depth-2 responses to the format expected by onResponseChange.
                  // Preserve explicit enum answers and only collapse placeholders to N_A.
                  if (!response || response === 'PAPER' || response === 'DIGITAL' || response === 'HYBRID') {
                    onResponseChange(canonId, 'N_A');
                  } else if (response === 'N/A') {
                    onResponseChange(canonId, 'N/A');
                  } else {
                    onResponseChange(canonId, response);
                  }
                }}
                saving={saving}
                isReadOnly={isReadOnly}
                assessmentId={assessmentId}
                subtypeLabel={spine.subtype_name || formatSubtypeName(subtypeCode)}
              />
            );
          })}
        </div>
      )}

      {/* Selected Capabilities and Follow-ons (when using capability selector or discipline checklist and gate is satisfied) */}
      {gateOk && (shouldUseCapabilitySelector || usesDisciplineChecklistMemo) && selectedSubtypeCodes.length > 0 && 
        selectedSubtypeCodes.map((subtypeCode) => {
        const spine = hiddenSubtypeSpines.find(s => s.subtype_code === subtypeCode);
        if (!spine) return null;

        const checklist = checklistIndexBySubtype(subtypeCode);
        const depth2Questions = depth2BySubtype.get(subtypeCode) || [];
        // Get subtype name from spine if available, otherwise format from code
        const subtypeName = spine.subtype_name || formatSubtypeName(subtypeCode);

        // Filter depth-2 questions based on discipline checklist tags (for COM)
        let visibleDepth2 = depth2Questions;
        if (usesDisciplineChecklistMemo && selectedDisciplineTags.length > 0 && depth2TagsIndexByCanonId) {
          visibleDepth2 = depth2Questions.filter(q => {
            const questionTags = depth2TagsIndexByCanonId(q.canon_id) || q.depth2_tags || [];
            // Include if question has any tag that matches selected discipline tags
            return questionTags.some(tag => selectedDisciplineTags.includes(tag));
          });
        }

        // Skip empty shells so conditional sections do not appear before they can show content.
        if (!checklist && visibleDepth2.length === 0) {
          return null;
        }

        return (
          <div
            key={subtypeCode}
            style={{
              marginTop: 'var(--spacing-md)',
              paddingTop: 'var(--spacing-md)',
              borderTop: '2px solid var(--cisa-gray-light)',
            }}
          >
            {/* DEV-ONLY Debug */}
            {process.env.NODE_ENV !== 'production' && (
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#666',
                  fontFamily: 'monospace',
                  marginBottom: '0.5rem',
                }}
              >
                [DEV] {subtypeCode} | spine={spine.canon_id} response=YES | depth2_shown={visibleDepth2.length}
              </div>
            )}

            <h3
              style={{
                margin: '0 0 var(--spacing-md) 0',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1b1b1b',
              }}
            >
              {subtypeName}
            </h3>

            {/* Capability Checklist */}
            {checklist && checklist.items.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <CapabilityChecklist
                  items={checklist.items}
                  selected={[]} // Tags will be managed per-subtype in v2
                  onChange={() => {}} // Placeholder - will be wired up in v2 with tag filtering
                />
              </div>
            )}

            {/* Depth-2 Questions */}
            {visibleDepth2.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <h4
                  style={{
                    margin: '0 0 var(--spacing-md) 0',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--cisa-gray-dark)',
                  }}
                >
                  Follow-on Questions ({visibleDepth2.length})
                </h4>

                {visibleDepth2.map((question) => {
                  const currentResponse = responsesByCanonId.get(question.canon_id) || question.current_response || null;
                  const normalizedCurrentResp = currentResponse === 'N/A' || currentResponse === 'N_A' 
                    ? 'N_A' 
                    : (currentResponse === 'YES' || currentResponse === 'NO' ? currentResponse : null);
                  const currentEnumResponse = typeof currentResponse === 'string' ? currentResponse : null;
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

                      <QuestionHelp
                        questionId={question.canon_id}
                        disciplineSubtypeId={question.discipline_subtype_id}
                        subtypeCode={question.subtype_code}
                        subtypeGuidance={question.subtype_guidance || null}
                      />

                      <fieldset className="usa-fieldset" disabled={isReadOnly || isSaving} style={{ marginTop: '0.5rem', padding: 0, border: 'none' }}>
                        <legend style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>{question.question_text}</legend>
                        {question.response_type === 'ENUM' && question.response_options ? (
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {question.response_options.map((option) => {
                              const optionValue = option.value;
                              const isSelected = currentEnumResponse === optionValue;
                              return (
                                <div key={optionValue} className="usa-radio" style={{ margin: 0 }}>
                                  <input
                                    className="usa-radio__input usa-radio__input--tile"
                                    id={`${question.canon_id}-${optionValue}`}
                                    type="radio"
                                    name={`response-${question.canon_id}`}
                                    value={optionValue}
                                    checked={isSelected}
                                    onChange={() => {
                                      if (!isReadOnly && !isSaving) {
                                        onResponseChange(question.canon_id, optionValue);
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
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {(question.response_enum || ['YES', 'NO', 'N_A']).map((option) => {
                              const optionValue = option === 'N_A' ? 'N/A' : option;
                              const normalizedOption = option === 'N_A' ? 'N_A' : option;
                              const isSelected = normalizedCurrentResp === normalizedOption;
                              return (
                                <div key={option} className="usa-radio" style={{ margin: 0 }}>
                                  <input
                                    className="usa-radio__input usa-radio__input--tile"
                                    id={`${question.canon_id}-${option}`}
                                    type="radio"
                                    name={`response-${question.canon_id}`}
                                    value={optionValue}
                                    checked={isSelected}
                                    onChange={() => {
                                      if (!isReadOnly && !isSaving) {
                                        const normalizedValue = optionValue === 'N/A' ? 'N_A' : optionValue;
                                        onResponseChange(question.canon_id, normalizedValue as "YES" | "NO" | "N_A");
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
          </div>
        );
      })}
    </div>
  );
}
