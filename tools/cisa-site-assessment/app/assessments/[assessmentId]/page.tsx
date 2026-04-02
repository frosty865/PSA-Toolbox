"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ProgressBar from "@/app/components/ProgressBar";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import StickyNav from "@/app/components/StickyNav";
import DisciplineNav from "@/app/components/DisciplineNav";
import QuestionSearch from "@/app/components/QuestionSearch";
import AutoSaveIndicator from "@/app/components/AutoSaveIndicator";
import DisciplineSkeleton from "@/app/components/DisciplineSkeleton";
import UndoButton from "@/app/components/UndoButton";
import { useResponseHistory } from "@/app/hooks/useResponseHistory";
import { useDraftAutosave } from "@/app/hooks/useDraftAutosave";
import { clearDraft, loadDraft, downloadDraftAsFile, readDraftFile, saveDraft, type DraftResponses } from "@/app/lib/draftStorage";
import OfcDisplay from "@/app_broken/components/OfcDisplay";
import SubmitLockActions from "./components/SubmitLockActions";
import DisciplineSectionBlock from "@/app/components/DisciplineSectionBlock";
import ExpansionProfileSelector from "@/app/components/expansion/ExpansionProfileSelector";
import ExpansionQuestionList from "@/app/components/expansion/ExpansionQuestionList";
import { writeResponse } from "@/app/lib/assessment/useAssessmentResponseWriter";
import OfcCandidatesPanel from "@/app/components/assessment/OfcCandidatesPanel";
import { assertNoLegacyIntent } from "@/app/lib/invariants/noLegacyIntent";
import type { SubtypeChecklist } from "@/app/lib/types/checklist";

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isSubtypeChecklist(value: unknown): value is SubtypeChecklist {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<SubtypeChecklist>;
  return c.version === "1.0" && typeof c.subtype_code === "string" && typeof c.discipline_code === "string" && typeof c.title === "string" && Array.isArray(c.items);
}

// Use API routes instead of direct data provider for client component
async function getAssessmentDetail(assessmentId: string) {
  const response = await fetch(`/api/runtime/assessments/${assessmentId}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch assessment: ${response.status}`);
  return response.json();
}

async function getRequiredElements(assessmentId: string) {
  try {
    const response = await fetch(`/api/runtime/assessments/${assessmentId}/questions`, { cache: 'no-store' });
    if (!response.ok) {
      console.error(`[getRequiredElements] API returned ${response.status}:`, await response.text().catch(() => ''));
      return [];
    }
    const data = await response.json();
    assertNoLegacyIntent(data, 'assessments/[assessmentId] getRequiredElements');
    console.log(`[getRequiredElements] API response:`, { 
      total: data.total, 
      questionsCount: data.questions?.length || 0,
      metadata: data.metadata 
    });
    // API now returns questions array with canon_id (spines format)
    const questions = data.questions || [];
    console.log(`[getRequiredElements] Mapped ${questions.length} questions`);
    // Map to RequiredElement format (canon_id is primary, element_id/element_code for legacy compatibility)
    // Help is gated by discipline_subtype_id only; legacy intent removed.
    return questions.map((q: Record<string, unknown>) => ({
      ...q,
      canon_id: q.canon_id,
      element_id: q.canon_id, // Map canon_id to element_id for backward compatibility
      element_code: q.canon_id, // Map canon_id to element_code for backward compatibility
      discipline_subtype_id: q.discipline_subtype_id ?? null,
      subtype_code: q.subtype_code ?? null,
      subtype_guidance: q.subtype_guidance ?? null,
    }));
  } catch (error) {
    console.error('[getRequiredElements] Error fetching questions:', error);
    return [];
  }
}

async function getResponses(assessmentId: string) {
  // Use responses endpoint
  const response = await fetch(`/api/runtime/assessments/${assessmentId}/responses`, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  // Transform to expected format
  // Support both canon_id (new) and question_template_id (legacy)
  // Normalize response: API returns "N_A" but UI uses "N/A" for display
  return (data.responses || []).map((r: Record<string, unknown>) => {
    const apiResponse = r.response || r.response_enum;
    // Convert "N_A" from API to "N/A" for UI display consistency
    const uiResponse = apiResponse === 'N_A' ? 'N/A' : apiResponse;
    const canonId = r.question_canon_id || r.question_template_id || r.question_code;
    return {
      element_id: canonId || r.element_id,
      canon_id: canonId,
      response: uiResponse,
      response_id: r.id || r.response_id, // Include response ID if available
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for direct save path
async function saveResponseProvider(assessmentId: string, canonId: string, response: "YES" | "NO" | "N/A") {
  // Convert 'N/A' to 'N_A' for API
  const responseEnum = response === 'N/A' ? 'N_A' : response;
  
  const res = await fetch(`/api/runtime/assessments/${assessmentId}/responses`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
      items: [{ 
        question_canon_id: canonId,
        question_template_id: canonId, // Legacy field for backward compatibility
        response_enum: responseEnum as 'YES' | 'NO' | 'N_A'
      }] 
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save response: ${res.status}`);
  }
  return res.json();
}

async function getOfcs(assessmentId: string) {
  const response = await fetch(`/api/runtime/assessments/${assessmentId}/ofcs`, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  return data.ofcs || [];
}

async function getComponentCapabilityQuestions(assessmentId: string) {
  const response = await fetch(`/api/runtime/assessments/${assessmentId}/component-capability/questions`, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  const rows: unknown[] = Array.isArray(data.questions) ? data.questions : [];
  return rows
    .map((row): ComponentQuestion | null => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const component_code = asString(record.component_code);
      const question_text = asString(record.question_text);
      if (!component_code || !question_text) return null;
      return {
        component_code,
        question_text,
        component_name: asString(record.component_name),
      };
    })
    .filter((row): row is ComponentQuestion => row !== null);
}

async function getComponentCapabilityResponses(assessmentId: string) {
  const response = await fetch(`/api/runtime/assessments/${assessmentId}/component-capability/responses`, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  const rows: unknown[] = Array.isArray(data.responses) ? data.responses : [];
  return rows
    .map((row): ComponentResponseRow | null => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const component_code = asString(record.component_code);
      const responseValue = record.response;
      if (!component_code || (responseValue !== "YES" && responseValue !== "NO" && responseValue !== "N/A")) return null;
      return { component_code, response: responseValue };
    })
    .filter((row): row is ComponentResponseRow => row !== null);
}

async function saveComponentCapabilityResponse(assessmentId: string, componentCode: string, response: 'YES' | 'NO' | 'N/A') {
  const res = await fetch(`/api/runtime/assessments/${assessmentId}/component-capability/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ component_code: componentCode, response }),
  });
  if (!res.ok) throw new Error(`Failed to save component response: ${res.status}`);
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for status updates
async function updateAssessmentStatus(assessmentId: string, status: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "LOCKED") {
  const res = await fetch(`/api/runtime/assessments/${assessmentId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Failed to update status: ${res.status}`);
  }
  return res.json();
}

interface RequiredElement {
  // Primary identifier: canon_id (for baseline questions)
  canon_id: string;
  discipline_code: string; // Required - all spines have discipline_code
  question_text: string;
  response_enum: ["YES","NO","N_A"]; // Required - all spines have response_enum
  // Legacy fields for compatibility during migration
  element_id?: string; // deprecated - use canon_id
  element_code?: string; // deprecated - use canon_id
  layer?: "baseline" | "sector" | "subsector";
  order_index?: number;
  current_response?: "YES" | "NO" | "N/A" | "N_A" | string | null; // UI accepts both "N/A" and "N_A" plus non-binary enum answers
  mapped_gate?: "CONTROL_EXISTS" | "CONTROL_OPERABLE" | "CONTROL_RESILIENCE" | null;
  discipline_name?: string;
  discipline_subtype_name?: string;
  discipline_subtype_id?: string;
  subtype_code?: string | null; // Keep null to match API data
  // Additional properties from API
  depth?: number;
  checklist?: SubtypeChecklist | null;
  depth2_tags?: string[];
  subtype_name?: string;
}

interface ComponentQuestion {
  component_code: string;
  component_name: string | null;
  question_text: string;
}

interface ComponentResponseRow {
  component_code: string;
  response: "YES" | "NO" | "N/A";
}

interface AssessmentDetail {
  assessment_id: string;
  name: string;
  facility_name?: string; // Optional for compatibility
  sector_name?: string; // Optional for compatibility
  subsector_name?: string; // Optional for compatibility
  facility: {
    sector_id: string | null;
    sector_name: string | null;
    subsector_id: string | null;
    subsector_name: string | null;
  };
  status: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "LOCKED";
  // Audit trail
  created_by?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  locked_by?: string | null;
  locked_at?: string | null;
  // Doctrine versions
  baseline_version?: string;
  sector_version?: string;
  subsector_version?: string;
  ofc_version?: string;
}

export default function AssessmentExecutionPage() {
  const params = useParams();
  const _router = useRouter();
  const assessmentId = params?.assessmentId as string;
  void _router;

  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [elements, setElements] = useState<RequiredElement[]>([]);
  const [ofcs, setOfcs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [responsesMap, setResponsesMap] = useState<Map<string, string>>(new Map());
  const [responseIdMap, setResponseIdMap] = useState<Map<string, string>>(new Map()); // canon_id -> response_id
  const [_submitting, setSubmitting] = useState(false);
  void _submitting;
  void setSubmitting;
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [serverResponsesForDraft, setServerResponsesForDraft] = useState<DraftResponses | undefined>(undefined);
  
  // Response history for undo functionality
  const { addToHistory, undoLast, canUndo } = useResponseHistory({ maxHistory: 20 });

  // Draft persistence: Convert Map to Record for draft storage
  const draftResponses = useMemo<DraftResponses>(() => {
    const record: DraftResponses = {};
    responsesMap.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }, [responsesMap]);

  const setDraftResponses = (next: DraftResponses) => {
    const newMap = new Map<string, string>();
    Object.entries(next).forEach(([key, value]) => {
      if (typeof value === 'string') {
        newMap.set(key, value);
      }
    });
    setResponsesMap(newMap);
    // Also update elements with loaded responses
    setElements((prev) =>
      prev.map((el) => {
        const canonId = el.canon_id || el.element_code || el.element_id || '';
        const loadedResponse = next[canonId];
        if (loadedResponse && typeof loadedResponse === 'string' && (loadedResponse === 'YES' || loadedResponse === 'NO' || loadedResponse === 'N/A')) {
          return { ...el, current_response: loadedResponse as "YES" | "NO" | "N/A" };
        }
        return el;
      })
    );
  };
  
  // Component Capability Layer state
  const [componentQuestions, setComponentQuestions] = useState<ComponentQuestion[]>([]);
  const [componentResponses, setComponentResponses] = useState<Record<string, 'YES' | 'NO' | 'N/A'>>({});
  const [showComponentLayer, setShowComponentLayer] = useState(false);
  const [savingComponent, setSavingComponent] = useState<Record<string, boolean>>({});

  // Fetch assessment data
  useEffect(() => {
    if (!assessmentId) {
      setLoading(false);
      setError("Assessment ID is required");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load detail, elements, responses, OFCs, and component capability data in parallel
        const [detailData, elementsData, responsesData, ofcsData, componentQuestionsData, componentResponsesData] = await Promise.all([
          getAssessmentDetail(assessmentId),
          getRequiredElements(assessmentId),
          getResponses(assessmentId),
          getOfcs(assessmentId),
          getComponentCapabilityQuestions(assessmentId),
          getComponentCapabilityResponses(assessmentId),
        ]);

        // Temporary diagnostic (remove after verification)
        console.log("Assessment detail:", detailData);
        console.log("Required elements:", elementsData);
        console.log("Required elements count:", elementsData?.length || 0);
        console.log("Responses:", responsesData);

        if (!detailData) {
          console.error("[Assessment Page] No detail data found");
          setError("not_found");
          return;
        }

        if (!elementsData || elementsData.length === 0) {
          console.error("[Assessment Page] No elements found. elementsData:", elementsData);
          console.error("[Assessment Page] This may indicate the questions API returned empty array or failed");
          // Don't set error - allow page to render with empty questions (might be loading)
          // setError("No required elements found for this assessment");
          // return;
        }

        setDetail(detailData);

        // Load component capability questions and responses
        if (componentQuestionsData && componentQuestionsData.length > 0) {
          setComponentQuestions(componentQuestionsData);
          setShowComponentLayer(true); // Auto-show if questions available
        }
        
        // Build component responses map
        const componentResponseMap: Record<string, 'YES' | 'NO' | 'N/A'> = {};
        if (componentResponsesData && Array.isArray(componentResponsesData)) {
          componentResponsesData.forEach((r) => {
            const componentCode = r.component_code;
            const response = r.response;
            if (componentCode && response) {
              componentResponseMap[componentCode] = response;
            }
          });
        }
        setComponentResponses(componentResponseMap);

        // Merge responses into elements
        // Responses from getResponses() take precedence, but preserve existing current_response if no response found
        // Support both canon_id (new) and element_id (legacy) for response matching
        const responseMap = new Map<string, string>();
        for (const r of responsesData) {
          const key = r.canon_id || r.element_id;
          if (key && r.response) {
            responseMap.set(key, r.response);
          }
        }

        // Build responses map for GateOrderedQuestions component (keyed by canon_id)
        // Normalize responses: API returns "N_A" but UI uses "N/A" for display
        const responsesMapForGate = new Map<string, string>();
        const responseIdMapForGate = new Map<string, string>(); // canon_id -> response_id
        for (const r of responsesData) {
          const key = r.canon_id || r.element_id;
          if (key && typeof r.response === 'string') {
            // Normalize "N_A" from API to "N/A" for UI consistency
            // Preserve any other response strings, including non-binary depth-2 answers.
            const normalizedResponse = r.response === 'N_A' ? 'N/A' : r.response;
            responsesMapForGate.set(key, normalizedResponse);
            // Store response ID if available
            if (r.response_id) {
              responseIdMapForGate.set(key, r.response_id);
            }
          }
        }
        setResponseIdMap(responseIdMapForGate);

        const enrichedElements = elementsData
          .map((el: Record<string, unknown>) => {
            const canonId = el.canon_id || el.element_code || el.element_id || '';
            return {
              ...el,
              canon_id: canonId,
              discipline_code: el.discipline_code || '', // Ensure required field is present
              element_id: canonId, // Map for backward compatibility
              element_code: canonId, // Map for backward compatibility
              // Use response from getResponses() if available, otherwise preserve element's current_response
              current_response: responseMap.has(String(canonId))
                ? responseMap.get(String(canonId))
                : (el.current_response || null),
              // Gate metadata should already be included from API
              mapped_gate: el.mapped_gate || null,
            };
          })
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const aCanon = a.canon_id as string | undefined;
            const bCanon = b.canon_id as string | undefined;
            if (aCanon && bCanon) return String(aCanon).localeCompare(String(bCanon));
            return (Number(a.order_index) || 0) - (Number(b.order_index) || 0);
          });

        setElements(enrichedElements);
        setOfcs(ofcsData || []);
        
        // Convert server responses to DraftResponses format for draft hook
        const serverResponses: DraftResponses = {};
        responsesMapForGate.forEach((value, key) => {
          serverResponses[key] = value;
        });
        
        // Store server responses for draft hook (before merging with local draft)
        setServerResponsesForDraft(serverResponses);
        
        // Set responses map (will be merged with local draft by useDraftAutosave)
        setResponsesMap(responsesMapForGate);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load assessment data"
        );
      } finally {
        setLoading(false);
        }
      };

    fetchData();
  }, [assessmentId]);

  // Draft autosave: merge local draft with server responses
  useDraftAutosave({
    assessmentId,
    responses: draftResponses,
    setResponses: setDraftResponses,
    serverResponses: serverResponsesForDraft,
  });

  // Cleanup: flush pending saves on unmount
  useEffect(() => {
    const pendingSaves = pendingSavesRef.current;
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (pendingSaves.size > 0) pendingSaves.clear();
    };
  }, []);

  // Check if assessment is locked
  const isLocked = detail?.status === "LOCKED";
  const isReadOnly = isLocked || detail?.status === "SUBMITTED";

  // Calculate progress
  const progress = useMemo(() => {
    if (!elements || elements.length === 0) return { answered: 0, total: 0, percentage: 0 };
    const answered = elements.filter(e => e.current_response !== null && e.current_response !== undefined).length;
    const total = elements.length;
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    };
  }, [elements]);

  // Save component capability response handler
  const handleComponentResponseChange = async (
    componentCode: string,
    response: "YES" | "NO" | "N/A"
  ) => {
    if (isReadOnly) {
      setError("Assessment is locked or submitted and cannot be modified");
      return;
    }

    // Optimistically update UI
    setComponentResponses((prev) => ({
      ...prev,
      [componentCode]: response,
    }));

    setSavingComponent((prev) => ({ ...prev, [componentCode]: true }));

    try {
      await saveComponentCapabilityResponse(assessmentId, componentCode, response);
    } catch (err) {
      // Revert optimistic update on error
      setComponentResponses((prev) => {
        const updated = { ...prev };
        delete updated[componentCode];
        return updated;
      });
      setError(err instanceof Error ? err.message : "Failed to save component response");
    } finally {
      setSavingComponent((prev) => {
        const next = { ...prev };
        delete next[componentCode];
        return next;
      });
    }
  };

  // Debounced save queue for batching rapid changes
  const pendingSavesRef = useRef<Map<string, string>>(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushPendingSaves = async () => {
    if (pendingSavesRef.current.size === 0) return;

    const items = Array.from(pendingSavesRef.current.entries()).map(([canonId, response]) => ({
      question_canon_id: canonId, // Use canon_id (new format)
      question_template_id: canonId, // Also set legacy field for backward compatibility
      response_enum: response === 'N/A' ? 'N_A' : response
    }));

    // Mark all as saving
    setIsSaving(true);
    setSaving((prev) => {
      const updated = { ...prev };
      items.forEach(item => {
        const canonId = item.question_canon_id || item.question_template_id;
        if (canonId) {
          updated[canonId] = true;
        }
      });
      return updated;
    });

    try {
      const res = await fetch(`/api/runtime/assessments/${assessmentId}/responses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save responses: ${res.status}`);
      }

      // Update responses map for all saved items
      setResponsesMap((prev) => {
        const updated = new Map(prev);
        items.forEach(item => {
          const response = item.response_enum === 'N_A' ? 'N/A' : item.response_enum;
          const canonId = item.question_canon_id || item.question_template_id;
          if (canonId) {
            updated.set(canonId, response);
          }
        });
        return updated;
      });

      // Update last saved timestamp
      setLastSaved(new Date());
      
      // Show success toast
      toast.success(
        `Saved ${items.length} response${items.length > 1 ? 's' : ''}`,
        {
          duration: 2000,
        }
      );

      // Reload OFCs after save (only if any NO responses)
      const hasNoResponse = items.some(item => item.response_enum === 'NO');
      if (hasNoResponse) {
        const updatedOfcs = await getOfcs(assessmentId);
        setOfcs(updatedOfcs || []);
      }
    } catch (err) {
      console.error("Error saving responses:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save responses";
      setError(errorMessage);
      
      // Show error toast
      toast.error(
        `Failed to save: ${errorMessage}`,
        {
          duration: 4000,
        }
      );
    } finally {
      setIsSaving(false);
      // Clear saving state for all items
      setSaving((prev) => {
        const updated = { ...prev };
        items.forEach(item => {
          const canonId = item.question_canon_id || item.question_template_id;
          if (canonId) {
            delete updated[canonId];
          }
        });
        return updated;
      });
      pendingSavesRef.current.clear();
    }
  };

  // Save response handler with debouncing
  const handleResponseChange = async (
    canonId: string,
    response: "YES" | "NO" | "N/A" | "N_A" | string
  ) => {
    if (!elements) return;
    
    // Block modifications if locked or submitted
    if (isReadOnly) {
      setError("Assessment is locked or submitted and cannot be modified");
      return;
    }

    // Normalize response: convert "N_A" (API format) to "N/A" (UI format) for state storage
    const uiResponse = response === "N_A" ? "N/A" : response;

    // Get previous response for history
    const previousResponse = responsesMap.get(canonId);
    
    // Add to history if there was a previous response
    if (previousResponse) {
      addToHistory(canonId, previousResponse);
    }

    // Optimistically update UI immediately (match by canon_id)
    setElements((prev) =>
      prev.map((el) => {
        const elCanonId = el.canon_id || el.element_code || el.element_id || '';
        return elCanonId === canonId
          ? { ...el, current_response: uiResponse }
          : el;
      })
    );

    // Update responses map immediately for UI (keyed by canon_id)
    // Store UI value ("N/A"), convert to API value ("N_A") only when saving
    setResponsesMap((prev) => {
      const updated = new Map(prev);
      updated.set(canonId, uiResponse);
      return updated;
    });

    // Add to pending saves queue (store UI format, will convert to API format when saving)
    pendingSavesRef.current.set(canonId, uiResponse);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: wait 300ms for more changes, then batch save
    saveTimeoutRef.current = setTimeout(() => {
      flushPendingSaves();
      saveTimeoutRef.current = null;
    }, 300);
  };

  // Group elements by layer
  // Baseline questions have layer='baseline' or no layer (default to baseline)
  const groupedElements = {
    baseline: elements.filter((el) => {
      // Include if explicitly marked as baseline, or if no layer (default to baseline)
      return el.layer === "baseline" || !el.layer;
    }),
    sector: elements.filter((el) => {
      // Include if marked as sector layer
      return el.layer === "sector";
    }),
    subsector: elements.filter((el) => {
      // Include if marked as subsector layer
      return el.layer === "subsector";
    }),
  };

  // Build OFC map by required_element_id for quick lookup
  // Backend already filters to only return OFCs for NO responses
  // OFCs may reference required_element_code (legacy) or required_element_canon_id (new)
  const ofcMap = new Map<string, Record<string, unknown>[]>();
  for (const ofc of ofcs) {
    const reqElementId = ofc.required_element_id;
    const reqElementCode = ofc.required_element_code;
    const reqCanonId = ofc.required_element_canon_id;
    
    // Index by canon_id (new), element_code (legacy), and element_id (legacy) for flexible matching
    const keys = [reqCanonId, reqElementCode, reqElementId]
      .filter((k): k is string => typeof k === "string" && k.length > 0);
    for (const key of keys) {
      if (!ofcMap.has(key)) {
        ofcMap.set(key, []);
      }
      // Avoid duplicates
      if (!ofcMap.get(key)!.some(o => o.ofc_code === ofc.ofc_code)) {
        ofcMap.get(key)!.push(ofc);
      }
    }
  }
  
  // Also build reverse lookup: canon_id -> OFCs (for elements that match by legacy code)
  for (const element of elements) {
    if (element.current_response === "NO") {
      const canonId = element.canon_id || element.element_code || element.element_id;
      if (!canonId) continue;
      
      // Try to match by canon_id first, then legacy codes
      if (!ofcMap.has(canonId)) {
        if (element.element_code && ofcMap.has(element.element_code)) {
          ofcMap.set(canonId, ofcMap.get(element.element_code)!);
        } else if (element.element_id && ofcMap.has(element.element_id)) {
          ofcMap.set(canonId, ofcMap.get(element.element_id)!);
        }
      }
    }
  }

  // Loading state with skeleton
  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Execution</h2>
        </div>
        
        {/* Progress bar skeleton */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              height: "8px",
              backgroundColor: "#e5e7eb",
              borderRadius: "4px",
              marginBottom: "8px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Search skeleton */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              height: "44px",
              backgroundColor: "#e5e7eb",
              borderRadius: "4px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Discipline skeletons */}
        <div>
          <DisciplineSkeleton questionCount={4} />
          <DisciplineSkeleton questionCount={3} />
          <DisciplineSkeleton questionCount={5} />
        </div>
      </section>
    );
  }

  // Error state: Assessment not found
  if (error === "not_found") {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Execution</h2>
        </div>
        <div className="card">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.25rem", color: "#d13212" }}>
              Assessment Not Found
            </h3>
            <p style={{ marginBottom: "1.5rem", color: "#71767a" }}>
              This assessment could not be found. The assessment ID may be invalid or the assessment may have been removed.
            </p>
            <Link
              href="/assessments"
              className="usa-button"
              style={{ textDecoration: "none" }}
            >
              Back to Assessments
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Error state: Other errors
  if (error) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Execution</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error loading assessment:</strong>
          <p>{error}</p>
          <div style={{ marginTop: "1rem" }}>
            <Link
              href="/assessments"
              className="usa-button usa-button--outline"
              style={{ textDecoration: "none" }}
            >
              Back to Assessments
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!detail || elements.length === 0) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Execution</h2>
        </div>
        <div className="card">
          <p>No assessment data available.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 2000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 2000,
            iconTheme: {
              primary: '#00a91c',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#d13212',
              secondary: '#fff',
            },
          },
        }}
      />
      <section className="section active">
        {/* Sticky Navigation */}
        <StickyNav 
          assessmentId={assessmentId}
          facilityName={detail?.name}
        />

        {/* Breadcrumb Navigation */}
        <Breadcrumbs
          items={[
            { label: "Assessments", href: "/assessments" },
            { label: detail?.name || "Assessment", href: null },
            { label: "Questions", href: null },
          ]}
        />

        <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="section-title">Assessment Execution</h2>
          </div>
          <div className="section-actions" style={{ display: "flex", gap: "0.5rem" }}>
            <Link
              href="/assessments"
              className="usa-button usa-button--outline"
              style={{ textDecoration: "none" }}
            >
              Back to Assessments
            </Link>
            <Link
              href={`/assessments/${assessmentId}/results`}
              className="usa-button"
              style={{ textDecoration: "none" }}
            >
              View Results
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        {elements.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <ProgressBar
              current={progress.answered}
              total={progress.total}
              percentage={progress.percentage}
              label="Assessment Progress"
              showCount={true}
            />
          </div>
        )}

        {/* Question Search and Auto-save Indicator */}
        {elements.length > 0 && (
          <div style={{ 
            marginBottom: "1.5rem", 
            display: "flex", 
            gap: "1rem", 
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <div style={{ flex: "1", minWidth: "200px" }}>
              <QuestionSearch
                questions={elements.map(e => ({
                  canon_id: e.canon_id || e.element_code || e.element_id || '',
                  question_text: e.question_text,
                  discipline_name: e.discipline_name,
                  discipline_subtype_name: e.discipline_subtype_name,
                }))}
                onQuestionSelect={(canonId) => {
                  // Scroll to question - find by canon_id in the DOM
                  setTimeout(() => {
                    const questionElement = document.querySelector(`[data-canon-id="${canonId}"]`) || 
                                           document.querySelector(`[id*="${canonId}"]`);
                    if (questionElement) {
                      questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
                      // Highlight briefly
                      (questionElement as HTMLElement).style.backgroundColor = "#fff3cd";
                      setTimeout(() => {
                        (questionElement as HTMLElement).style.backgroundColor = "";
                      }, 2000);
                    }
                  }, 100);
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
              <UndoButton
                onUndo={() => {
                  const lastEntry = undoLast();
                  if (lastEntry) {
                    // Restore the previous response
                    handleResponseChange(lastEntry.questionId, lastEntry.response);
                  }
                }}
                disabled={!canUndo}
              />
              {/* Draft Management Actions */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: "0.5rem", paddingLeft: "0.5rem", borderLeft: "1px solid #dfe1e2" }}>
                <button
                  className="usa-button usa-button--outline"
                  style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
                  onClick={() => {
                    const env = loadDraft(assessmentId);
                    if (!env) {
                      // Ensure something exists; save current responses then download
                      saveDraft(assessmentId, draftResponses);
                      const env2 = loadDraft(assessmentId);
                      if (env2) downloadDraftAsFile(env2);
                      return;
                    }
                    downloadDraftAsFile(env);
                  }}
                  title="Download draft as JSON file"
                >
                  Save As
                </button>
                <label
                  className="usa-button usa-button--outline"
                  style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem", cursor: "pointer", margin: 0 }}
                  title="Load draft from JSON file"
                >
                  Load
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const env = await readDraftFile(file);
                        // If user loads a file from another machine, allow it but force current assessmentId match
                        if (env.assessment_id !== assessmentId) {
                          toast.error(`Draft file is for assessment ${env.assessment_id}, but current assessment is ${assessmentId}`);
                          return;
                        }
                        // Load responses into state
                        setDraftResponses(env.responses);
                        // Also update responsesMap for immediate UI update
        const newMap = new Map<string, string>();
        Object.entries(env.responses).forEach(([key, value]) => {
          if (typeof value === 'string') {
            newMap.set(key, value);
          }
        });
                        setResponsesMap(newMap);
                        // Update elements with loaded responses
                        setElements((prev) =>
                          prev.map((el) => {
                            const canonId = el.canon_id || el.element_code || el.element_id || '';
                            const loadedResponse = env.responses[canonId];
                            if (loadedResponse && typeof loadedResponse === 'string' && (loadedResponse === 'YES' || loadedResponse === 'NO' || loadedResponse === 'N/A')) {
                              return { ...el, current_response: loadedResponse as "YES" | "NO" | "N/A" };
                            }
                            return el;
                          })
                        );
                        toast.success("Draft loaded successfully");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to load draft file");
                      }
                      // Reset file input
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  className="usa-button usa-button--outline"
                  style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
                  onClick={() => {
                    if (confirm("Clear local draft? This will remove all unsaved changes from this browser.")) {
                      clearDraft(assessmentId);
                      toast.success("Local draft cleared");
                    }
                  }}
                  title="Clear local draft"
                >
                  Clear Draft
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Assessment Metadata */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>Assessment Information</h3>
          {isLocked && (
            <span style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: "#d13212",
              color: "white",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: "600"
            }}>
              LOCKED
            </span>
          )}
          {detail.status === "SUBMITTED" && (
            <span style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: "#fdb81e",
              color: "#1b1b1b",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: "600"
            }}>
              SUBMITTED
            </span>
          )}
          {detail.status === "IN_PROGRESS" && (
            <span style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: "#005ea2",
              color: "white",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: "600"
            }}>
              IN PROGRESS
            </span>
          )}
        </div>
        {isLocked && (
          <div style={{
            padding: "1rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #d13212",
            borderRadius: "0.25rem",
            marginBottom: "1rem"
          }}>
            <strong>Assessment is LOCKED</strong>
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
              This assessment is read-only and cannot be modified.
              {detail.locked_at && (
                <> Locked at: {new Date(detail.locked_at).toLocaleString()}</>
              )}
              {detail.locked_by && (
                <> by {detail.locked_by}</>
              )}
            </p>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div>
            <strong>Assessment ID:</strong> {detail.assessment_id}
          </div>
          <div>
            <strong>Name:</strong> {detail.name}
          </div>
          {detail.sector_name && (
            <div>
              <strong>Sector:</strong> {detail.sector_name}
            </div>
          )}
          {detail.subsector_name && (
            <div>
              <strong>Subsector:</strong> {detail.subsector_name}
            </div>
          )}
          <div>
            <strong>Status:</strong> {detail.status}
          </div>
          {detail.status === "SUBMITTED" && (
            <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#fef3c7", border: "1px solid #fbbf24", borderRadius: "0.25rem" }}>
              <strong>Assessment Submitted</strong>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
                This assessment has been submitted. You can now run OFC regeneration to generate nominations from NO responses.
              </p>
              <div style={{ marginTop: "0.75rem" }}>
                <Link
                  href="/engineering/ofcs/review"
                  className="usa-button"
                  style={{ textDecoration: "none", fontSize: "0.875rem", padding: "0.5rem 1rem" }}
                >
                  View OFC Nominations
                </Link>
              </div>
            </div>
          )}
        </div>
        {(detail.baseline_version || detail.sector_version || detail.subsector_version || detail.ofc_version) && (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #dfe1e2" }}>
            <strong>Doctrine Versions:</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.875rem" }}>
              {detail.baseline_version && <div>Baseline: {detail.baseline_version}</div>}
              {detail.sector_version && <div>Sector: {detail.sector_version}</div>}
              {detail.subsector_version && <div>Subsector: {detail.subsector_version}</div>}
              {detail.ofc_version && <div>OFC: {detail.ofc_version}</div>}
            </div>
          </div>
        )}
        {!isReadOnly && (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #dfe1e2", fontSize: "0.875rem", color: "#71767a" }}>
            <strong>Note:</strong> Responses are saved automatically when you select an answer. No need to click a save button.
          </div>
        )}
        <SubmitLockActions
          assessmentId={assessmentId}
          status={detail.status}
          onStatusChange={(newStatus) => {
            setDetail((prev) => prev ? { ...prev, status: newStatus as AssessmentDetail["status"] } : null);
          }}
        />
      </div>

      {/* Baseline Questions - Grouped by Discipline */}
      {groupedElements.baseline.length > 0 && (() => {
        // Group baseline questions by discipline
        const questionsByDiscipline = new Map<string, {
          disciplineName: string;
          disciplineCode: string;
          depth1: typeof groupedElements.baseline;
          depth2: typeof groupedElements.baseline;
        }>();

        // Deduplicate questions by canon_id before grouping
        const seenCanonIds = new Set<string>();
        const uniqueBaseline = groupedElements.baseline.filter(el => {
          const canonId = el.canon_id || el.element_code || el.element_id;
          if (!canonId) return true; // Keep items without canon_id (shouldn't happen)
          if (seenCanonIds.has(canonId)) {
            return false; // Skip duplicate
          }
          seenCanonIds.add(canonId);
          return true;
        });

        for (const el of uniqueBaseline) {
          const disciplineCode = el.discipline_code || 'UNKNOWN';
          const disciplineName = el.discipline_name || disciplineCode;
          const depth = el.depth || 1;

          // TEMP DEBUG: Log Rekeying Procedures question during grouping
          if (el.canon_id === 'BASE-KEY-KEY_REKEYING_PROCEDURES') {
             
            console.debug('[page.tsx] Rekeying Procedures during grouping', {
              canon_id: el.canon_id,
              discipline_subtype_id: el.discipline_subtype_id,
              subtype_code: el.subtype_code,
              depth,
              discipline_code: disciplineCode,
            });
          }

          if (!questionsByDiscipline.has(disciplineCode)) {
            questionsByDiscipline.set(disciplineCode, {
              disciplineName,
              disciplineCode,
              depth1: [],
              depth2: [],
            });
          }

          const disciplineGroup = questionsByDiscipline.get(disciplineCode)!;
          if (depth === 2) {
            disciplineGroup.depth2.push(el);
          } else {
            disciplineGroup.depth1.push(el);
          }
        }

        // Sort disciplines alphabetically
        const sortedDisciplines = Array.from(questionsByDiscipline.entries())
          .sort((a, b) => a[1].disciplineName.localeCompare(b[1].disciplineName));
        const disciplineNavItems = sortedDisciplines.map(([disciplineCode, group]) => ({
          id: `discipline-${disciplineCode.toLowerCase()}`,
          name: group.disciplineName,
          questionCount: group.depth1.length + group.depth2.length,
        }));

        return (
          <>
            <DisciplineNav disciplines={disciplineNavItems} defaultExpanded={true} />
            <div className="card" style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
                Baseline Questions
              </h3>
              {sortedDisciplines.map(([disciplineCode, group]) => {
                // Build checklist lookup from questions (checklist is already attached to depth1 questions)
                const checklistMap = new Map<string, SubtypeChecklist>();
                for (const q of group.depth1) {
                  if (q.subtype_code && isSubtypeChecklist(q.checklist)) {
                    checklistMap.set(q.subtype_code, q.checklist);
                  }
                }

                // Build depth2 tags lookup from questions (tags are already attached)
                const depth2TagsMap = new Map<string, string[]>();
                for (const q of group.depth2) {
                  if (q.depth2_tags && q.depth2_tags.length > 0) {
                    depth2TagsMap.set(q.canon_id, q.depth2_tags);
                  }
                }

                return (
                  <DisciplineSectionBlock
                    key={disciplineCode}
                    sectionId={`discipline-${disciplineCode.toLowerCase()}`}
                    disciplineCode={disciplineCode}
                    disciplineName={group.disciplineName}
                    questionsDepth1={group.depth1}
                    questionsDepth2={group.depth2}
                    responsesByCanonId={responsesMap}
                    checklistIndexBySubtype={(subtypeCode) => checklistMap.get(subtypeCode) || null}
                    depth2TagsIndexByCanonId={(canonId) => depth2TagsMap.get(canonId) || []}
                    onWriteResponse={async (canonId, value) => {
                      if (assessmentId) {
                        await writeResponse(assessmentId, canonId, value);
                      }
                    }}
                    onResponseChange={handleResponseChange}
                    saving={saving}
                    isReadOnly={isReadOnly}
                    assessmentId={assessmentId}
                  />
                );
              })}
              {/* Display OFCs for NO responses */}
              {groupedElements.baseline
                .filter((el) => {
                  const canonId = el.canon_id || el.element_code || el.element_id;
                  return canonId && el.current_response === "NO";
                })
                .map((element) => {
                  const canonId = element.canon_id || element.element_code || element.element_id;
                  if (!canonId) return null;
                  const responseId = responseIdMap.get(canonId);
                  return (
                    <div key={canonId} style={{ marginTop: "1rem" }}>
                      {/* Show candidates panel for NO responses */}
                      {responseId && (
                        <OfcCandidatesPanel
                          assessmentId={assessmentId}
                          responseId={responseId}
                          answer={element.current_response || "N/A"}
                          onPromoted={async () => {
                            // Refresh OFCs after promotion
                            const updatedOfcs = await getOfcs(assessmentId);
                            setOfcs(updatedOfcs || []);
                          }}
                        />
                      )}
                      {/* Show promoted OFCs */}
                      {ofcMap.has(canonId) && (
                        <div style={{ marginTop: "1rem" }}>
                          <OfcDisplay ofcs={(ofcMap.get(canonId) ?? []).slice(0, 4)} />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        );
      })()}

      {/* Sector / Context-Specific Considerations (Expansion) */}
      <ExpansionProfileSelector
        assessmentId={assessmentId}
        onProfilesChanged={() => {
          // Refresh questions if profiles change
          // This will be handled by ExpansionQuestionList's useEffect
        }}
      />

      <ExpansionQuestionList
        assessmentId={assessmentId}
        onResponseChange={() => {
          // Optional: refresh other data if needed
        }}
      />

      {/* Component Capability Layer (Optional, Non-Scoring) */}
      {componentQuestions.length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "1.5rem",
            borderBottom: "2px solid #71767a",
            paddingBottom: "0.5rem"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <h3 style={{ margin: 0 }}>
                  Component Capability (Evidence-Based)
                </h3>
                <span style={{
                  padding: "0.125rem 0.5rem",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#71767a"
                }}>
                  Optional
                </span>
              </div>
              <p style={{ 
                margin: 0, 
                fontSize: "0.875rem", 
                color: "#71767a",
                fontStyle: "italic"
              }}>
                These questions are generated from observed systems in source materials and do not affect baseline scoring.
              </p>
            </div>
            <button
              onClick={() => setShowComponentLayer(!showComponentLayer)}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: showComponentLayer ? "#005ea2" : "#71767a",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginLeft: "1rem"
              }}
            >
              {showComponentLayer ? "Hide" : "Show"}
            </button>
          </div>
          
          {showComponentLayer && (
            <div>
              {componentQuestions.map((question) => {
                const componentCode = question.component_code;
                const currentResponse = componentResponses[componentCode] || null;
                
                return (
                  <div
                    key={componentCode}
                    style={{
                      marginBottom: "2rem",
                      paddingBottom: "2rem",
                      borderBottom: "1px solid #dfe1e2",
                    }}
                  >
                    <h4 style={{ marginBottom: "0.5rem", fontSize: "1.1rem", color: "#71767a" }}>
                      {question.component_name || componentCode}
                    </h4>
                    <p style={{ marginBottom: "1rem", color: "#1b1b1b" }}>
                      {question.question_text}
                    </p>
                    <fieldset className="usa-fieldset">
                      <legend className="usa-legend" style={{ display: "none" }}>
                        Response for {question.component_name}
                      </legend>
                      <div className="usa-radio">
                        <input
                          className="usa-radio__input"
                          type="radio"
                          id={`component-${componentCode}-YES`}
                          name={`component-${componentCode}`}
                          value="YES"
                          checked={currentResponse === "YES"}
                          onChange={() => handleComponentResponseChange(componentCode, "YES")}
                          disabled={savingComponent[componentCode] || isReadOnly}
                        />
                        <label className="usa-radio__label" htmlFor={`component-${componentCode}-YES`}>
                          YES
                        </label>
                      </div>
                      <div className="usa-radio">
                        <input
                          className="usa-radio__input"
                          type="radio"
                          id={`component-${componentCode}-NO`}
                          name={`component-${componentCode}`}
                          value="NO"
                          checked={currentResponse === "NO"}
                          onChange={() => handleComponentResponseChange(componentCode, "NO")}
                          disabled={savingComponent[componentCode] || isReadOnly}
                        />
                        <label className="usa-radio__label" htmlFor={`component-${componentCode}-NO`}>
                          NO
                        </label>
                      </div>
                      <div className="usa-radio">
                        <input
                          className="usa-radio__input"
                          type="radio"
                          id={`component-${componentCode}-N/A`}
                          name={`component-${componentCode}`}
                          value="N/A"
                          checked={currentResponse === "N/A"}
                          onChange={() => handleComponentResponseChange(componentCode, "N/A")}
                          disabled={savingComponent[componentCode] || isReadOnly}
                        />
                        <label className="usa-radio__label" htmlFor={`component-${componentCode}-N/A`}>
                          N/A
                        </label>
                      </div>
                    </fieldset>
                    {savingComponent[componentCode] && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#71767a" }}>
                        Saving...
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sector Questions */}
      {groupedElements.sector.length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
            Sector Questions
          </h3>
          {groupedElements.sector.map((element) => {
            const canonId = element.canon_id || element.element_code || element.element_id || '';
            return (
              <div
                key={canonId}
                style={{
                  marginBottom: "2rem",
                  paddingBottom: "2rem",
                  borderBottom: "1px solid #dfe1e2",
                }}
              >
                <h4 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
                  {element.question_text}
                </h4>
                <fieldset className="usa-fieldset">
                  <legend className="usa-legend" style={{ display: "none" }}>
                    Response for {element.question_text}
                  </legend>
                  <div className="usa-radio">
                    <input
                      className="usa-radio__input"
                      type="radio"
                      id={`${canonId}-YES`}
                      name={canonId}
                      value="YES"
                      checked={element.current_response === "YES"}
                      onChange={() => handleResponseChange(canonId, "YES")}
                      disabled={saving[canonId] || isReadOnly}
                    />
                    <label className="usa-radio__label" htmlFor={`${canonId}-YES`}>
                      YES
                    </label>
                  </div>
                  <div className="usa-radio">
                    <input
                      className="usa-radio__input"
                      type="radio"
                      id={`${canonId}-NO`}
                      name={canonId}
                      value="NO"
                      checked={element.current_response === "NO"}
                      onChange={() => handleResponseChange(canonId, "NO")}
                      disabled={saving[canonId] || isReadOnly}
                    />
                    <label className="usa-radio__label" htmlFor={`${canonId}-NO`}>
                      NO
                    </label>
                  </div>
                  <div className="usa-radio">
                    <input
                      className="usa-radio__input"
                      type="radio"
                      id={`${canonId}-N/A`}
                      name={canonId}
                      value="N/A"
                      checked={element.current_response === "N/A"}
                      onChange={() => handleResponseChange(canonId, "N/A")}
                      disabled={saving[canonId] || isReadOnly}
                    />
                    <label className="usa-radio__label" htmlFor={`${canonId}-N/A`}>
                      N/A
                    </label>
                  </div>
                </fieldset>
                {saving[canonId] && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#71767a" }}>
                    Saving...
                  </p>
                )}
                {/* Display OFCs for NO responses only (hard cap 4) */}
                {element.current_response === "NO" && ofcMap.has(canonId) && (
                  <OfcDisplay ofcs={(ofcMap.get(canonId) ?? []).slice(0, 4)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Subsector Questions */}
      {groupedElements.subsector.length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
            Subsector Questions
          </h3>
          {groupedElements.subsector.map((element) => {
            const canonId = element.canon_id || element.element_code || element.element_id || '';
            return (
              <div
                key={canonId}
                style={{
                  marginBottom: "2rem",
                  paddingBottom: "2rem",
                  borderBottom: "1px solid #dfe1e2",
                }}
              >
                <h4 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
                  {element.question_text}
                </h4>
                <fieldset className="usa-fieldset">
                  <legend className="usa-legend" style={{ display: "none" }}>
                    Response for {element.question_text}
                  </legend>
                  <div className="usa-radio">
                    <input
                      className="usa-radio__input"
                      type="radio"
                      id={`${canonId}-YES`}
                      name={canonId}
                      value="YES"
                      checked={element.current_response === "YES"}
                      onChange={() => handleResponseChange(canonId, "YES")}
                      disabled={saving[canonId] || isReadOnly}
                    />
                    <label className="usa-radio__label" htmlFor={`${canonId}-YES`}>
                      YES
                    </label>
                  </div>
                  <div className="usa-radio">
                    <input
                      className="usa-radio__input"
                      type="radio"
                      id={`${canonId}-NO`}
                      name={canonId}
                      value="NO"
                      checked={element.current_response === "NO"}
                      onChange={() => handleResponseChange(canonId, "NO")}
                      disabled={saving[canonId] || isReadOnly}
                    />
                    <label className="usa-radio__label" htmlFor={`${canonId}-NO`}>
                      NO
                    </label>
                  </div>
                  <div className="usa-radio">
                    <input
                      className="usa-radio__input"
                      type="radio"
                      id={`${canonId}-N/A`}
                      name={canonId}
                      value="N/A"
                      checked={element.current_response === "N/A"}
                      onChange={() => handleResponseChange(canonId, "N/A")}
                      disabled={saving[canonId] || isReadOnly}
                    />
                    <label className="usa-radio__label" htmlFor={`${canonId}-N/A`}>
                      N/A
                    </label>
                  </div>
                </fieldset>
                {saving[canonId] && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#71767a" }}>
                    Saving...
                  </p>
                )}
                {/* Display OFCs for NO responses only (hard cap 4) */}
                {element.current_response === "NO" && ofcMap.has(canonId) && (
                  <OfcDisplay ofcs={(ofcMap.get(canonId) ?? []).slice(0, 4)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
    </>
  );
}
