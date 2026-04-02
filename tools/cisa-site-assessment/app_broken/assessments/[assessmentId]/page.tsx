"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAssessmentDetail,
  getRequiredElements,
  getResponses,
  saveResponse as saveResponseProvider,
  getOfcs,
  getComponentCapabilityQuestions,
  getComponentCapabilityResponses,
  saveComponentCapabilityResponse,
  updateAssessmentStatus,
} from "../../../src/data/psaDataProvider";
import OfcDisplay from "../../components/OfcDisplay";
import SubmitLockActions from "./components/SubmitLockActions";
import GateOrderedQuestions from "@/app/components/GateOrderedQuestions";

interface RequiredElement {
  element_id: string;
  element_code: string;
  layer: "baseline" | "sector" | "subsector";
  title: string;
  question_text: string;
  order_index: number;
  current_response: "YES" | "NO" | "N/A" | null;
  mapped_gate?: "CONTROL_EXISTS" | "CONTROL_OPERABLE" | "CONTROL_RESILIENCE" | null;
  discipline_name?: string;
  discipline_subtype_name?: string;
  discipline_subtype_id?: string;
  response_enum?: string[];
}

interface AssessmentDetail {
  assessment_id: string;
  name: string;
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
  const router = useRouter();
  const assessmentId = params?.assessmentId as string;

  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [elements, setElements] = useState<RequiredElement[]>([]);
  const [ofcs, setOfcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [responsesMap, setResponsesMap] = useState<Map<string, "YES" | "NO" | "N/A">>(new Map());
  const [submitting, setSubmitting] = useState(false);
  
  // Component Capability Layer state
  const [componentQuestions, setComponentQuestions] = useState<any[]>([]);
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
        console.log("Responses:", responsesData);

        if (!detailData) {
          setError("not_found");
          return;
        }

        if (!elementsData || elementsData.length === 0) {
          setError("No required elements found for this assessment");
          return;
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
          componentResponsesData.forEach((r: any) => {
            if (r.component_code && r.response) {
              componentResponseMap[r.component_code] = r.response;
            }
          });
        }
        setComponentResponses(componentResponseMap);

        // Merge responses into elements
        // Responses from getResponses() take precedence, but preserve existing current_response if no response found
        const responseMap = new Map(
          responsesData.map((r: any) => [r.element_id, r.response])
        );

        // Build responses map for GateOrderedQuestions component
        const responsesMapForGate = new Map<string, "YES" | "NO" | "N/A">();
        for (const r of responsesData) {
          if (r.element_id && r.response) {
            responsesMapForGate.set(r.element_id, r.response);
          }
        }

        const enrichedElements = elementsData
          .map((el: any) => ({
            ...el,
            // Use response from getResponses() if available, otherwise preserve element's current_response
            current_response: responseMap.has(el.element_id) 
              ? responseMap.get(el.element_id) 
              : (el.current_response || null),
            // Gate metadata should already be included from API
            mapped_gate: el.mapped_gate || null,
          }))
          .sort((a: any, b: any) => a.order_index - b.order_index);

        setElements(enrichedElements);
        setOfcs(ofcsData || []);
        setResponsesMap(responsesMapForGate);
        
        // Store responses map in component state for gate component
        const responsesMap = new Map<string, "YES" | "NO" | "N/A">();
        for (const r of responsesData) {
          if (r.element_id && r.response) {
            responsesMap.set(r.element_id, r.response);
          }
        }
        setResponsesMap(responsesMap);
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

  // Check if assessment is locked
  const isLocked = detail?.status === "LOCKED";
  const isReadOnly = isLocked || detail?.status === "SUBMITTED";

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

  // Save response handler
  const handleResponseChange = async (
    elementId: string,
    response: "YES" | "NO" | "N/A"
  ) => {
    if (!elements) return;
    
    // Block modifications if locked or submitted
    if (isReadOnly) {
      setError("Assessment is locked or submitted and cannot be modified");
      return;
    }

    // Optimistically update UI
    setElements((prev) =>
      prev.map((el) =>
        el.element_id === elementId
          ? { ...el, current_response: response }
          : el
      )
    );

    setSaving((prev) => ({ ...prev, [elementId]: true }));

    try {
      await saveResponseProvider(assessmentId, elementId, response);
      
      // Update responses map
      setResponsesMap((prev) => {
        const updated = new Map(prev);
        updated.set(elementId, response);
        return updated;
      });
      
      // Update responses map for gate component
      setResponsesMap((prev) => {
        const updated = new Map(prev);
        updated.set(elementId, response);
        return updated;
      });
      
      // Reload OFCs after response change (backend filters to NO responses only)
      const updatedOfcs = await getOfcs(assessmentId);
      setOfcs(updatedOfcs || []);
    } catch (err) {
      // Revert optimistic update on error
      setElements((prev) =>
        prev.map((el) =>
          el.element_id === elementId
            ? { ...el, current_response: elements.find((e) => e.element_id === elementId)?.current_response || null }
            : el
        )
      );
      setError(err instanceof Error ? err.message : "Failed to save response");
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[elementId];
        return next;
      });
    }
  };

  // Group elements by layer
  const groupedElements = {
    baseline: elements.filter((el) => el.layer === "baseline"),
    sector: elements.filter((el) => el.layer === "sector"),
    subsector: elements.filter((el) => el.layer === "subsector"),
  };

  // Build OFC map by required_element_id for quick lookup
  // Backend already filters to only return OFCs for NO responses
  const ofcMap = new Map<string, any[]>();
  for (const ofc of ofcs) {
    const reqElementId = ofc.required_element_id;
    const reqElementCode = ofc.required_element_code;
    
    // Index by both ID and code for flexible matching
    if (reqElementId) {
      if (!ofcMap.has(reqElementId)) {
        ofcMap.set(reqElementId, []);
      }
      // Avoid duplicates
      if (!ofcMap.get(reqElementId)!.some(o => o.ofc_code === ofc.ofc_code)) {
        ofcMap.get(reqElementId)!.push(ofc);
      }
    }
    if (reqElementCode) {
      if (!ofcMap.has(reqElementCode)) {
        ofcMap.set(reqElementCode, []);
      }
      // Avoid duplicates
      if (!ofcMap.get(reqElementCode)!.some(o => o.ofc_code === ofc.ofc_code)) {
        ofcMap.get(reqElementCode)!.push(ofc);
      }
    }
  }
  
  // Also build reverse lookup: element_id -> OFCs (for elements that match by code)
  for (const element of elements) {
    if (element.current_response === "NO") {
      const elementId = element.element_id;
      const elementCode = element.element_code;
      
      // Try to match by element_id first
      if (!ofcMap.has(elementId)) {
        // If no match by ID, try by code
        if (elementCode && ofcMap.has(elementCode)) {
          ofcMap.set(elementId, ofcMap.get(elementCode)!);
        }
      }
    }
  }

  // Loading state
  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Execution</h2>
        </div>
        <div className="card">
          <p>Loading assessment data...</p>
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
    <section className="section active">
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
          {detail.facility.sector_name && (
            <div>
              <strong>Sector:</strong> {detail.facility.sector_name}
            </div>
          )}
          {detail.facility.subsector_name && (
            <div>
              <strong>Subsector:</strong> {detail.facility.subsector_name}
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
            setDetail((prev) => prev ? { ...prev, status: newStatus as any } : null);
          }}
        />
      </div>

      {/* Baseline Questions - Gate-Ordered */}
      {groupedElements.baseline.length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
            Baseline Questions (Gate-Ordered)
          </h3>
          <GateOrderedQuestions
            elements={groupedElements.baseline}
            responses={responsesMap}
            onResponseChange={handleResponseChange}
            saving={saving}
            isReadOnly={isReadOnly}
          />
          {/* Display OFCs for NO responses */}
          {groupedElements.baseline
            .filter((el) => el.current_response === "NO" && ofcMap.has(el.element_id))
            .map((element) => (
              <div key={element.element_id} style={{ marginTop: "1rem" }}>
                <OfcDisplay ofcs={ofcMap.get(element.element_id)!} />
              </div>
            ))}
        </div>
      )}

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
          {groupedElements.sector.map((element) => (
            <div
              key={element.element_id}
              style={{
                marginBottom: "2rem",
                paddingBottom: "2rem",
                borderBottom: "1px solid #dfe1e2",
              }}
            >
              <h4 style={{ marginBottom: "0.5rem", fontSize: "1.1rem" }}>
                {element.title}
              </h4>
              <p style={{ marginBottom: "1rem", color: "#1b1b1b" }}>
                {element.question_text}
              </p>
              <fieldset className="usa-fieldset">
                <legend className="usa-legend" style={{ display: "none" }}>
                  Response for {element.title}
                </legend>
                <div className="usa-radio">
                  <input
                    className="usa-radio__input"
                    type="radio"
                    id={`${element.element_id}-YES`}
                    name={element.element_id}
                    value="YES"
                    checked={element.current_response === "YES"}
                    onChange={() => handleResponseChange(element.element_id, "YES")}
                    disabled={saving[element.element_id] || isReadOnly}
                  />
                  <label className="usa-radio__label" htmlFor={`${element.element_id}-YES`}>
                    YES
                  </label>
                </div>
                <div className="usa-radio">
                  <input
                    className="usa-radio__input"
                    type="radio"
                    id={`${element.element_id}-NO`}
                    name={element.element_id}
                    value="NO"
                    checked={element.current_response === "NO"}
                    onChange={() => handleResponseChange(element.element_id, "NO")}
                    disabled={saving[element.element_id] || isReadOnly}
                  />
                  <label className="usa-radio__label" htmlFor={`${element.element_id}-NO`}>
                    NO
                  </label>
                </div>
                <div className="usa-radio">
                  <input
                    className="usa-radio__input"
                    type="radio"
                    id={`${element.element_id}-N/A`}
                    name={element.element_id}
                    value="N/A"
                    checked={element.current_response === "N/A"}
                    onChange={() => handleResponseChange(element.element_id, "N/A")}
                    disabled={saving[element.element_id] || isReadOnly}
                  />
                  <label className="usa-radio__label" htmlFor={`${element.element_id}-N/A`}>
                    N/A
                  </label>
                </div>
              </fieldset>
              {saving[element.element_id] && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#71767a" }}>
                  Saving...
                </p>
              )}
              {/* Display OFCs for NO responses only */}
              {element.current_response === "NO" && ofcMap.has(element.element_id) && (
                <OfcDisplay ofcs={ofcMap.get(element.element_id)!} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Subsector Questions */}
      {groupedElements.subsector.length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
            Subsector Questions
          </h3>
          {groupedElements.subsector.map((element) => (
            <div
              key={element.element_id}
              style={{
                marginBottom: "2rem",
                paddingBottom: "2rem",
                borderBottom: "1px solid #dfe1e2",
              }}
            >
              <h4 style={{ marginBottom: "0.5rem", fontSize: "1.1rem" }}>
                {element.title}
              </h4>
              <p style={{ marginBottom: "1rem", color: "#1b1b1b" }}>
                {element.question_text}
              </p>
              <fieldset className="usa-fieldset">
                <legend className="usa-legend" style={{ display: "none" }}>
                  Response for {element.title}
                </legend>
                <div className="usa-radio">
                  <input
                    className="usa-radio__input"
                    type="radio"
                    id={`${element.element_id}-YES`}
                    name={element.element_id}
                    value="YES"
                    checked={element.current_response === "YES"}
                    onChange={() => handleResponseChange(element.element_id, "YES")}
                    disabled={saving[element.element_id] || isReadOnly}
                  />
                  <label className="usa-radio__label" htmlFor={`${element.element_id}-YES`}>
                    YES
                  </label>
                </div>
                <div className="usa-radio">
                  <input
                    className="usa-radio__input"
                    type="radio"
                    id={`${element.element_id}-NO`}
                    name={element.element_id}
                    value="NO"
                    checked={element.current_response === "NO"}
                    onChange={() => handleResponseChange(element.element_id, "NO")}
                    disabled={saving[element.element_id] || isReadOnly}
                  />
                  <label className="usa-radio__label" htmlFor={`${element.element_id}-NO`}>
                    NO
                  </label>
                </div>
                <div className="usa-radio">
                  <input
                    className="usa-radio__input"
                    type="radio"
                    id={`${element.element_id}-N/A`}
                    name={element.element_id}
                    value="N/A"
                    checked={element.current_response === "N/A"}
                    onChange={() => handleResponseChange(element.element_id, "N/A")}
                    disabled={saving[element.element_id] || isReadOnly}
                  />
                  <label className="usa-radio__label" htmlFor={`${element.element_id}-N/A`}>
                    N/A
                  </label>
                </div>
              </fieldset>
              {saving[element.element_id] && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#71767a" }}>
                  Saving...
                </p>
              )}
              {/* Display OFCs for NO responses only */}
              {element.current_response === "NO" && ofcMap.has(element.element_id) && (
                <OfcDisplay ofcs={ofcMap.get(element.element_id)!} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
