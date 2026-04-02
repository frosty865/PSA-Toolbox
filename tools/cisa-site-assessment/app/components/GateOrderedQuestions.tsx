"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { evaluateGatesForSubtype, getGateOrderIndex, type GateType } from "@/app/lib/gateMetadataClient";
import TechnologyProfilePanel from "@/app/components/TechnologyProfilePanel";
import { useKeyboardNavigation } from "@/app/hooks/useKeyboardNavigation";
import DisciplineNav from "@/app/components/DisciplineNav";
import QuestionHelp from "@/app/components/QuestionHelp";
import SubtypeQuestionBlock from "@/app/components/SubtypeQuestionBlock";
import type { BaselineSpineUI } from "@/app/lib/types/uiBaseline";
import type { SubtypeChecklist } from "@/app/lib/types/checklist";
import { apiUrl } from "@/app/lib/apiUrl";
import { readResponseJson } from "@/app/lib/http/responseJson";

interface RequiredElement extends BaselineSpineUI {
  [key: string]: unknown;
  // For baseline questions, canon_id is the primary identifier
  // Legacy fields kept for compatibility during migration
  element_id?: string; // deprecated - use canon_id
  layer?: "baseline" | "sector" | "subsector";
  order_index?: number;
  context?: string;
  explanation?: string;
  depth?: number; // 1 for spine, 2 for depth-2
  checklist?: SubtypeChecklist | null;
  depth2_tags?: string[]; // Tags for depth-2 questions
  parent_spine_canon_id?: string; // For depth-2 questions
  subtype_guidance?: unknown; // For QuestionHelp fallback
}

interface GateOrderedQuestionsProps {
  elements: RequiredElement[];
  responses: Map<string, string>;
  onResponseChange: (canonId: string, response: "YES" | "NO" | "N/A" | "N_A" | string) => void;
  saving: Record<string, boolean>;
  isReadOnly: boolean;
  assessmentId?: string; // For technology profile selector
}

// Reserved for future gate UI labels/descriptions
const _GATE_LABELS: Record<GateType, string> = {
  CONTROL_EXISTS: "Control Exists",
  CONTROL_OPERABLE: "Control Operable",
  CONTROL_RESILIENCE: "Control Resilient",
};
const _GATE_DESCRIPTIONS: Record<GateType, string> = {
  CONTROL_EXISTS: "Does the control exist?",
  CONTROL_OPERABLE: "Is the control operable? (Only shown if Control Exists = YES)",
  CONTROL_RESILIENCE: "Is the control resilient? (Only shown if Control Exists = YES and Control Operable = YES)",
};
void _GATE_LABELS;
void _GATE_DESCRIPTIONS;

export default function GateOrderedQuestions({
  elements,
  responses,
  onResponseChange,
  saving,
  isReadOnly,
  assessmentId,
}: GateOrderedQuestionsProps) {
  // Get assessment_instance_id (from assessment detail if available)
  const [assessmentInstanceId, setAssessmentInstanceId] = useState<string | null>(null);
  
  // Keyboard navigation state
  const [focusedQuestionIndex, setFocusedQuestionIndex] = useState<number>(0);
  const questionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Flatten all elements for keyboard navigation
  const allElements = useMemo(() => {
    const flattened: RequiredElement[] = [];
    // Group by subtype first
    const bySubtype = new Map<string, RequiredElement[]>();
    for (const element of elements) {
      const subtypeId = element.discipline_subtype_id || element.subtype_code || "unknown";
      if (!bySubtype.has(subtypeId)) {
        bySubtype.set(subtypeId, []);
      }
      bySubtype.get(subtypeId)!.push(element);
    }
    // Flatten maintaining order (use canon_id for stable sorting)
    for (const subtypeElements of bySubtype.values()) {
      flattened.push(...subtypeElements.sort((a, b) => {
        // Sort by canon_id (deterministic)
        return a.canon_id.localeCompare(b.canon_id);
      }));
    }
    return flattened;
  }, [elements]);

  // Keyboard navigation
  const { containerRef } = useKeyboardNavigation({
    enabled: !isReadOnly,
    currentIndex: focusedQuestionIndex,
    totalItems: allElements.length,
    onNext: () => {
      if (focusedQuestionIndex < allElements.length - 1) {
        const nextIndex = focusedQuestionIndex + 1;
        setFocusedQuestionIndex(nextIndex);
        const nextElement = allElements[nextIndex];
        const nextRef = questionRefs.current.get(nextElement.canon_id);
        if (nextRef) {
          nextRef.scrollIntoView({ behavior: "smooth", block: "center" });
          // Focus first radio button
          setTimeout(() => {
            const firstRadio = nextRef.querySelector('input[type="radio"]') as HTMLInputElement;
            if (firstRadio) {
              firstRadio.focus();
            }
          }, 100);
        }
      }
    },
    onPrevious: () => {
      if (focusedQuestionIndex > 0) {
        const prevIndex = focusedQuestionIndex - 1;
        setFocusedQuestionIndex(prevIndex);
        const prevElement = allElements[prevIndex];
        const prevRef = questionRefs.current.get(prevElement.canon_id);
        if (prevRef) {
          prevRef.scrollIntoView({ behavior: "smooth", block: "center" });
          // Focus first radio button
          setTimeout(() => {
            const firstRadio = prevRef.querySelector('input[type="radio"]') as HTMLInputElement;
            if (firstRadio) {
              firstRadio.focus();
            }
          }, 100);
        }
      }
    },
    onSelect: (value: "YES" | "NO" | "N/A") => {
      if (focusedQuestionIndex >= 0 && focusedQuestionIndex < allElements.length) {
        const element = allElements[focusedQuestionIndex];
        onResponseChange(element.canon_id, value);
      }
    },
  });
  
  // Update focused index when element is clicked
  const handleElementClick = useCallback((canonId: string) => {
    const index = allElements.findIndex(e => e.canon_id === canonId);
    if (index >= 0) {
      setFocusedQuestionIndex(index);
    }
  }, [allElements]);

  useEffect(() => {
    if (!assessmentId) return;

    const loadAssessmentDetail = async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/runtime/assessments/${assessmentId}`),
          { cache: "no-store", credentials: "same-origin" }
        );
        if (response.ok) {
          const data = await readResponseJson(response) as { assessment_instance_id?: string | null };
          setAssessmentInstanceId(data.assessment_instance_id || null);
        }
      } catch (err) {
        console.error("Error loading assessment detail:", err);
      }
    };

    loadAssessmentDetail();
  }, [assessmentId]);

  // Group elements by discipline (not subtype)
  const elementsByDiscipline = useMemo(() => {
    const grouped = new Map<string, RequiredElement[]>();
    for (const element of elements) {
      const disciplineName = element.discipline_name || "Unknown Discipline";
      if (!grouped.has(disciplineName)) {
        grouped.set(disciplineName, []);
      }
      grouped.get(disciplineName)!.push(element);
    }
    return grouped;
  }, [elements]);

  // Also keep subtype grouping for internal organization (reserved for future use)
  const _elementsBySubtype = useMemo(() => {
    const grouped = new Map<string, RequiredElement[]>();
    for (const element of elements) {
      const subtypeId = element.discipline_subtype_id || element.subtype_code || "unknown";
      if (!grouped.has(subtypeId)) {
        grouped.set(subtypeId, []);
      }
      grouped.get(subtypeId)!.push(element);
    }
    return grouped;
  }, [elements]);
  void _elementsBySubtype;

  // Memoize the onUpdate callback to prevent infinite re-renders
  const handleTechProfileUpdate = useCallback(() => {
    // Trigger reload if needed for conditional question variants
    window.dispatchEvent(new Event('tech-profile-updated'));
  }, []);

  // Extract discipline info for navigation
  const disciplineNavItems = useMemo(() => {
    return Array.from(elementsByDiscipline.entries()).map(([disciplineName, disciplineElements]) => {
      const disciplineId = `discipline-${disciplineName.replace(/\s+/g, '-').toLowerCase()}`;
      return {
        id: disciplineId,
        name: disciplineName,
        questionCount: disciplineElements.length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [elementsByDiscipline]);

  // Render questions for a discipline in a card
  const renderDisciplineCard = (disciplineName: string, disciplineElements: RequiredElement[]) => {
    // Group elements by subtype within this discipline
    const elementsBySubtypeInDiscipline = new Map<string, RequiredElement[]>();
    for (const element of disciplineElements) {
      const subtypeId = element.discipline_subtype_id || element.subtype_code || "unknown";
      if (!elementsBySubtypeInDiscipline.has(subtypeId)) {
        elementsBySubtypeInDiscipline.set(subtypeId, []);
      }
      elementsBySubtypeInDiscipline.get(subtypeId)!.push(element);
    }

    const disciplineId = `discipline-${disciplineName.replace(/\s+/g, '-').toLowerCase()}`;
    const totalQuestions = disciplineElements.length;

    return (
      <div
        key={disciplineId}
        id={disciplineId}
        className="discipline-card"
        style={{
          marginBottom: "2rem",
          backgroundColor: "white",
          border: "1px solid #dfe1e2",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          scrollMarginTop: "120px",
        }}
      >
        {/* Discipline Header */}
        <div 
          className="discipline-header"
          style={{ 
            marginBottom: "1.5rem",
            paddingBottom: "1rem",
            borderBottom: "2px solid #e6e6e6",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: "1.25rem", 
              color: "#1b1b1b", 
              fontWeight: "600" 
            }}>
              {disciplineName}
            </h2>
            <span 
              className="question-count"
              style={{
                fontSize: "0.875rem",
                color: "#565c65",
                backgroundColor: "#f0f0f0",
                padding: "0.25rem 0.75rem",
                borderRadius: "0.25rem",
                fontWeight: 500,
              }}
            >
              {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Render all questions grouped by subtype within this discipline */}
        {Array.from(elementsBySubtypeInDiscipline.entries()).map(([subtypeId, subtypeElements]) =>
          renderSubtypeQuestions(subtypeId, subtypeElements, true)
        )}
      </div>
    );
  };

  // Render questions for a subtype using SubtypeQuestionBlock (checklist-driven branching)
   
  const renderSubtypeQuestions = (subtypeId: string, subtypeElements: RequiredElement[], _isWithinDisciplineCard: boolean = false) => {
    // Separate spine (depth-1) from depth-2 questions
    const spineQuestion = subtypeElements.find(el => !el.depth || el.depth === 1);
    const depth2Questions = subtypeElements.filter(el => el.depth === 2);

    // If no spine question, skip (shouldn't happen, but handle gracefully)
    if (!spineQuestion) {
      console.warn(`[GateOrderedQuestions] No spine question found for subtype ${subtypeId}`);
      return null;
    }

    // Get spine response and normalize: "N/A" -> "N_A" for internal consistency
    const spineResponseRaw = responses.get(spineQuestion.canon_id) || spineQuestion.current_response || null;
    const normalizedSpineResponse = spineResponseRaw === 'N/A' || spineResponseRaw === 'N_A' 
      ? 'N_A' 
      : (spineResponseRaw === 'YES' || spineResponseRaw === 'NO' ? spineResponseRaw : null) as "YES" | "NO" | "N_A" | null;

    // Build depth-2 responses map (normalize N/A -> N_A)
    const depth2Responses = new Map<string, string>();
    for (const d2q of depth2Questions) {
      const resp = responses.get(d2q.canon_id) || d2q.current_response || null;
      if (typeof resp === 'string' && resp.trim().length > 0) {
        depth2Responses.set(d2q.canon_id, resp === 'N/A' ? 'N_A' : resp);
      }
    }

    // Render using SubtypeQuestionBlock
    return (
      <SubtypeQuestionBlock
        key={subtypeId}
        spineQuestion={spineQuestion}
        spineResponse={normalizedSpineResponse}
        depth2Questions={depth2Questions}
        depth2Responses={depth2Responses}
        onSpineAnswer={onResponseChange}
        onDepth2Answer={(canonId: string, response: string | null) => {
          // Convert depth-2 responses to the format expected by onResponseChange.
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
      />
    );
  };

  // Legacy render function (kept for reference, but not used with checklist branching)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for reference
  const renderSubtypeQuestionsLegacy = (subtypeId: string, subtypeElements: RequiredElement[], _isWithinDisciplineCard: boolean = false) => {
    // Evaluate gates for this subtype
    const gateResults = evaluateGatesForSubtype(subtypeElements, responses);
    
    // Group elements by gate
    const elementsByGate = new Map<GateType | null, RequiredElement[]>();
    for (const element of subtypeElements) {
      const gate = element.mapped_gate || null;
      if (!elementsByGate.has(gate)) {
        elementsByGate.set(gate, []);
      }
      elementsByGate.get(gate)!.push(element);
    }

    // Get subtype name and ID (from first element)
    // Check multiple fields for subtype name, and handle discipline-level questions (no subtype_code)
    const firstElement = subtypeElements[0];
    const hasSubtypeCode = firstElement?.subtype_code || firstElement?.discipline_subtype_id;
    const subtypeName = hasSubtypeCode 
      ? (firstElement?.discipline_subtype_name || firstElement?.subtype_name || "Unknown Subtype")
      : null; // Discipline-level questions don't have subtypes
    const disciplineName = firstElement?.discipline_name || "Unknown Discipline";
    const disciplineSubtypeId = firstElement?.discipline_subtype_id || subtypeId;

    // Sort gates by order
    const gates: (GateType | null)[] = Array.from(elementsByGate.keys()).sort((a, b) => {
      return getGateOrderIndex(a) - getGateOrderIndex(b);
    });

    // If within a discipline card, show subtype as a subsection; otherwise show full header
    if (_isWithinDisciplineCard) {
      return (
        <div
          key={subtypeId}
          className="subtype-section"
          style={{
            marginBottom: "2rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {subtypeName && (
            <h3 style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "1rem", 
              color: "#565c65", 
              fontWeight: "600" 
            }}>
              {subtypeName}
            </h3>
          )}
        
        {/* Technology Profile Panel - Always visible, metadata only */}
        {assessmentId && (
          <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <TechnologyProfilePanel
              assessmentId={assessmentId}
              assessmentInstanceId={assessmentInstanceId}
              disciplineSubtypeId={disciplineSubtypeId}
              disciplineSubtypeName={subtypeName || undefined}
              onUpdate={handleTechProfileUpdate}
            />
          </div>
        )}
        
        {/* Render gates in order */}
        {gates.map((gate) => {
          const gateElements = elementsByGate.get(gate) || [];
          if (gateElements.length === 0) return null;

          // Determine if this gate should be shown
          let shouldShow = true;
          let skipReason = "";

          if (gate === "CONTROL_OPERABLE") {
            if (gateResults.CONTROL_EXISTS === "NO") {
              shouldShow = false;
              skipReason = "Control Exists = NO (gate skipped)";
            }
          } else if (gate === "CONTROL_RESILIENCE") {
            if (gateResults.CONTROL_EXISTS === "NO" || gateResults.CONTROL_OPERABLE === "NO") {
              shouldShow = false;
              if (gateResults.CONTROL_EXISTS === "NO") {
                skipReason = "Control Exists = NO (gate skipped)";
              } else {
                skipReason = "Control Operable = NO (gate skipped)";
              }
            }
          }

          // Sort elements within gate by canon_id (deterministic)
          const sortedElements = [...gateElements].sort((a, b) => a.canon_id.localeCompare(b.canon_id));

          return (
            <div
              key={gate || "no-gate"}
              style={{
                marginTop: shouldShow ? "1rem" : "0.5rem",
                padding: shouldShow ? "0.5rem 0" : "0.5rem",
                backgroundColor: shouldShow ? "transparent" : "#f9fafb",
                border: shouldShow ? "none" : "1px dashed #cbd5e1",
                borderRadius: "0.25rem",
              }}
            >
              {/* Gate headers removed for cleaner UX */}

              {!shouldShow && (
                <div
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "#fef3c7",
                    border: "1px solid #fbbf24",
                    borderRadius: "0.25rem",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                    color: "#92400e",
                  }}
                >
                  <strong>Gate Skipped:</strong> {skipReason}
                  {gate === "CONTROL_OPERABLE" && gateResults.CONTROL_EXISTS === "NO" && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <em>Answer &quot;YES&quot; to Control Exists to enable this gate.</em>
                    </div>
                  )}
                  {gate === "CONTROL_RESILIENCE" && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <em>
                        Answer &quot;YES&quot; to both Control Exists and Control Operable to enable this gate.
                      </em>
                    </div>
                  )}
                </div>
              )}

              {shouldShow &&
                sortedElements.map((element) => {
                  const canonId = element.canon_id;
                  const currentResponse = responses.get(canonId) || element.current_response;
                  const isSaving = saving[canonId];
                  const elementIndex = allElements.findIndex(e => e.canon_id === canonId);
                  const isFocused = elementIndex === focusedQuestionIndex;

                  return (
                    <div
                      key={canonId}
                      ref={(el) => {
                        if (el) {
                          questionRefs.current.set(canonId, el);
                        } else {
                          questionRefs.current.delete(canonId);
                        }
                      }}
                      data-question-index={elementIndex}
                      data-canon-id={canonId}
                      onClick={() => handleElementClick(canonId)}
                      style={{
                        marginBottom: "1.5rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid #e5e7eb",
                        position: "relative",
                        zIndex: 1,
                        outline: isFocused ? "2px solid #005ea2" : "none",
                        outlineOffset: "2px",
                        borderRadius: isFocused ? "4px" : "0",
                        padding: isFocused ? "1rem" : "0 0 1rem 0",
                        backgroundColor: isFocused ? "#f0f7ff" : "transparent",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                      tabIndex={-1}
                    >
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem", gap: "1rem" }}>
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600", color: "#1b1b1b", lineHeight: "1.4" }}>
                              {element.question_text}
                            </h5>
                          </div>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#71767a",
                              backgroundColor: "#f3f4f6",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {element.canon_id}
                          </span>
                        </div>
                        {/* Question Help Component */}
                        <QuestionHelp
                          questionId={canonId}
                          disciplineSubtypeId={element.discipline_subtype_id}
                          subtypeCode={element.subtype_code}
                          subtypeGuidance={element.subtype_guidance || null}
                        />
                      </div>

                      <fieldset className="usa-fieldset" disabled={isReadOnly || isSaving} style={{ margin: 0, padding: 0, border: "none" }}>
                        <legend className="usa-sr-only">{element.question_text}</legend>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                          {(element.response_enum || ["YES", "NO", "N/A"]).map((option) => {
                            const optionValue = option === "N_A" ? "N/A" : option;
                            const isSelected = currentResponse === optionValue;
                            return (
                              <div key={option} className="usa-radio" style={{ margin: 0 }}>
                                <input
                                  className="usa-radio__input usa-radio__input--tile"
                                  id={`${canonId}-${option}`}
                                  type="radio"
                                  name={`response-${canonId}`}
                                  value={optionValue}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (!isReadOnly && !isSaving) {
                                      onResponseChange(canonId, optionValue as "YES" | "NO" | "N/A");
                                    }
                                  }}
                                  disabled={isReadOnly || isSaving}
                                />
                                <label
                                  className="usa-radio__label"
                                  htmlFor={`${canonId}-${option}`}
                                  style={{
                                    padding: "0.75rem 1rem",
                                    border: isSelected ? "2px solid #005ea2" : "2px solid #dfe1e2",
                                    borderRadius: "0.25rem",
                                    backgroundColor: isSelected ? "#e7f3f8" : "white",
                                    cursor: isReadOnly || isSaving ? "not-allowed" : "pointer",
                                    opacity: isReadOnly || isSaving ? 0.6 : 1,
                                    display: "inline-block",
                                    whiteSpace: "nowrap",
                                    margin: 0,
                                  }}
                                >
                                  {optionValue}
                                  {isSaving && <span style={{ marginLeft: "0.5rem", fontSize: "0.875rem" }}>(saving...)</span>}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>
                  );
                })}
            </div>
          );
        })}
        </div>
      );
    }

    // Original full section rendering (when not in discipline card)
    const navId = `discipline-${subtypeId}`;
    
    return (
      <div
        key={subtypeId}
        id={navId}
        className="discipline-section"
        style={{
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "2px solid #dfe1e2",
          backgroundColor: "transparent",
          scrollMarginTop: "120px",
        }}
      >
        <div 
          className="discipline-header"
          style={{ 
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid #e6e6e6",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: "1.1rem", 
              color: "#1b1b1b", 
              fontWeight: "600" 
            }}>
              {disciplineName}{subtypeName ? ` - ${subtypeName}` : ''}
            </h3>
            <span 
              className="question-count"
              style={{
                fontSize: "0.875rem",
                color: "#565c65",
                backgroundColor: "#f0f0f0",
                padding: "0.25rem 0.75rem",
                borderRadius: "0.25rem",
                fontWeight: 500,
              }}
            >
              {subtypeElements.length} question{subtypeElements.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="discipline-divider" style={{ marginBottom: "1rem" }} />
        
        {/* Technology Profile Panel - Always visible, metadata only */}
        {assessmentId && (
          <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <TechnologyProfilePanel
              assessmentId={assessmentId}
              assessmentInstanceId={assessmentInstanceId}
              disciplineSubtypeId={disciplineSubtypeId}
              disciplineSubtypeName={subtypeName || undefined}
              onUpdate={handleTechProfileUpdate}
            />
          </div>
        )}

        {/* Render gates in order */}
        {gates.map((gate) => {
          const gateElements = elementsByGate.get(gate) || [];
          if (gateElements.length === 0) return null;

          // Determine if this gate should be shown
          let shouldShow = true;
          let skipReason = "";

          if (gate === "CONTROL_OPERABLE") {
            if (gateResults.CONTROL_EXISTS === "NO") {
              shouldShow = false;
              skipReason = "Control Exists = NO (gate skipped)";
            }
          } else if (gate === "CONTROL_RESILIENCE") {
            if (gateResults.CONTROL_EXISTS === "NO" || gateResults.CONTROL_OPERABLE === "NO") {
              shouldShow = false;
              if (gateResults.CONTROL_EXISTS === "NO") {
                skipReason = "Control Exists = NO (gate skipped)";
              } else {
                skipReason = "Control Operable = NO (gate skipped)";
              }
            }
          }

          // Sort elements within gate by canon_id (deterministic)
          const sortedElements = [...gateElements].sort((a, b) => a.canon_id.localeCompare(b.canon_id));

          return (
            <div
              key={gate || "no-gate"}
              style={{
                marginTop: shouldShow ? "1rem" : "0.5rem",
                padding: shouldShow ? "0.5rem 0" : "0.5rem",
                backgroundColor: shouldShow ? "transparent" : "#f9fafb",
                border: shouldShow ? "none" : "1px dashed #cbd5e1",
                borderRadius: "0.25rem",
              }}
            >
              {/* Gate headers removed for cleaner UX */}

              {!shouldShow && (
                <div
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "#fef3c7",
                    border: "1px solid #fbbf24",
                    borderRadius: "0.25rem",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                    color: "#92400e",
                  }}
                >
                  <strong>Gate Skipped:</strong> {skipReason}
                  {gate === "CONTROL_OPERABLE" && gateResults.CONTROL_EXISTS === "NO" && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <em>Answer &quot;YES&quot; to Control Exists to enable this gate.</em>
                    </div>
                  )}
                  {gate === "CONTROL_RESILIENCE" && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <em>
                        Answer &quot;YES&quot; to both Control Exists and Control Operable to enable this gate.
                      </em>
                    </div>
                  )}
                </div>
              )}

              {shouldShow &&
                sortedElements.map((element) => {
                  const canonId = element.canon_id;
                  const currentResponse = responses.get(canonId) || element.current_response;
                  const isSaving = saving[canonId];
                  const elementIndex = allElements.findIndex(e => e.canon_id === canonId);
                  const isFocused = elementIndex === focusedQuestionIndex;

                  return (
                    <div
                      key={canonId}
                      ref={(el) => {
                        if (el) {
                          questionRefs.current.set(canonId, el);
                        } else {
                          questionRefs.current.delete(canonId);
                        }
                      }}
                      data-question-index={elementIndex}
                      data-canon-id={canonId}
                      onClick={() => handleElementClick(canonId)}
                      style={{
                        marginBottom: "1.5rem",
                        paddingBottom: "1rem",
                        borderBottom: "1px solid #e5e7eb",
                        position: "relative",
                        zIndex: 1,
                        outline: isFocused ? "2px solid #005ea2" : "none",
                        outlineOffset: "2px",
                        borderRadius: isFocused ? "4px" : "0",
                        padding: isFocused ? "1rem" : "0 0 1rem 0",
                        backgroundColor: isFocused ? "#f0f7ff" : "transparent",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                      tabIndex={-1}
                    >
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem", gap: "1rem" }}>
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600", color: "#1b1b1b", lineHeight: "1.4" }}>
                              {element.question_text}
                            </h5>
                          </div>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#71767a",
                              backgroundColor: "#f3f4f6",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {element.canon_id}
                          </span>
                        </div>
                        {/* Question Help Component */}
                        <QuestionHelp
                          questionId={canonId}
                          disciplineSubtypeId={element.discipline_subtype_id}
                          subtypeCode={element.subtype_code}
                          subtypeGuidance={element.subtype_guidance || null}
                        />
                      </div>

                      <fieldset className="usa-fieldset" disabled={isReadOnly || isSaving} style={{ margin: 0, padding: 0, border: "none" }}>
                        <legend className="usa-sr-only">{element.question_text}</legend>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                          {(element.response_enum || ["YES", "NO", "N/A"]).map((option) => {
                            const optionValue = option === "N_A" ? "N/A" : option;
                            const isSelected = currentResponse === optionValue;
                            return (
                              <div key={option} className="usa-radio" style={{ margin: 0 }}>
                                <input
                                  className="usa-radio__input usa-radio__input--tile"
                                  id={`${canonId}-${option}`}
                                  type="radio"
                                  name={`response-${canonId}`}
                                  value={optionValue}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (!isReadOnly && !isSaving) {
                                      onResponseChange(canonId, optionValue as "YES" | "NO" | "N/A");
                                    }
                                  }}
                                  disabled={isReadOnly || isSaving}
                                />
                                <label
                                  className="usa-radio__label"
                                  htmlFor={`${canonId}-${option}`}
                                  style={{
                                    padding: "0.75rem 1rem",
                                    border: isSelected ? "2px solid #005ea2" : "2px solid #dfe1e2",
                                    borderRadius: "0.25rem",
                                    backgroundColor: isSelected ? "#e7f3f8" : "white",
                                    cursor: isReadOnly || isSaving ? "not-allowed" : "pointer",
                                    opacity: isReadOnly || isSaving ? 0.6 : 1,
                                    display: "inline-block",
                                    whiteSpace: "nowrap",
                                    margin: 0,
                                  }}
                                >
                                  {optionValue}
                                  {isSaving && <span style={{ marginLeft: "0.5rem", fontSize: "0.875rem" }}>(saving...)</span>}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={containerRef}>
      {/* Discipline Navigation */}
      {disciplineNavItems.length > 1 && (
        <DisciplineNav disciplines={disciplineNavItems} />
      )}
      
      {/* Questions grouped by discipline in cards */}
      {Array.from(elementsByDiscipline.entries()).map(([disciplineName, disciplineElements]) =>
        renderDisciplineCard(disciplineName, disciplineElements)
      )}
    </div>
  );
}
