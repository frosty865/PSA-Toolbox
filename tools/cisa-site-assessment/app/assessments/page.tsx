"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CreateAssessmentDialog from "@/app/components/CreateAssessmentDialog";
import { apiUrl } from "@/app/lib/apiUrl";

/** Read failed response body without throwing on empty or non-JSON (proxies often return empty 502 bodies). */
async function readApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text?.trim()) {
    return `${response.status} ${response.statusText || "Request failed"}`;
  }
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    if (typeof j.message === "string" && j.message.trim()) return j.message;
    if (typeof j.error === "string" && j.error.trim()) return j.error;
  } catch {
    /* HTML or plain text */
  }
  return text.slice(0, 500);
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

interface Assessment {
  assessment_id: string;
  name?: string;
  facility_name?: string;
  sector?: string;
  sector_name?: string;
  subsector?: string;
  subsector_name?: string;
  status?: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "LOCKED";
  created_at?: string;
  updated_at?: string;
  qa_flag?: boolean;
  test_run_id?: string | null;
}

export default function AssessmentsListPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTestAssessments, setShowTestAssessments] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingTest, setCreatingTest] = useState(false);

  // Fetch assessments list
  const fetchAssessments = async (includeTest: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = includeTest
        ? apiUrl("/api/runtime/assessments?include_qa=true")
        : apiUrl("/api/runtime/assessments");

      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response));
      }
      const text = await response.text();
      if (!text.trim()) {
        setAssessments([]);
        return;
      }
      setAssessments(JSON.parse(text) as Assessment[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load assessments"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments(showTestAssessments);
  }, [showTestAssessments]);

  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessments</h2>
        </div>
        <div className="card">
          <p>Loading assessments...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessments</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error loading assessments:</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

   
  const handleAssessmentCreated = (assessmentId: string, _instanceId: string) => {
    // Refresh assessments list
    fetchAssessments(showTestAssessments);
    
    // Navigate to the new assessment
    router.push(`/assessments/${assessmentId}`);
  };

  const handleDelete = async (assessmentId: string) => {
    if (!confirm('Are you sure you want to delete this test assessment? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(assessmentId);
      const response = await fetch(apiUrl(`/api/runtime/assessments/${assessmentId}`), {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response));
      }

      // Refresh assessments list
      await fetchAssessments(showTestAssessments);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete assessment');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateTestAssessment = async () => {
    if (!confirm('Create a test/training assessment? This will be marked as a test assessment and can be easily deleted.')) {
      return;
    }

    try {
      setCreatingTest(true);
      
      // Use dedicated test assessment endpoint - much simpler!
      const response = await fetch(apiUrl("/api/runtime/test-assessments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // Empty body - endpoint handles everything
        credentials: "same-origin",
      });

      const responseText = await response.text();

      if (!response.ok) {
        if (!responseText.trim()) {
          throw new Error(
            `${response.status} ${response.statusText || "Request failed"}`
          );
        }
        const errObj = tryParseJsonObject(responseText);
        if (errObj) {
          console.error("[Test Assessment] API Error Response:", errObj);
          const errorMsg =
            (typeof errObj.error === "string" && errObj.error) ||
            (typeof errObj.message === "string" && errObj.message) ||
            `${response.status} ${response.statusText}`;
          const details = errObj.details;
          const suffix =
            details !== undefined
              ? `\n\nDetails: ${JSON.stringify(details, null, 2)}`
              : "";
          throw new Error(`${errorMsg}${suffix}`);
        }
        throw new Error(responseText.slice(0, 500));
      }

      const data = tryParseJsonObject(responseText) ?? {};
      const ok = data.ok === true;
      const newAssessmentId =
        typeof data.assessment_id === "string" ? data.assessment_id : undefined;
      const err =
        typeof data.error === "string" ? data.error : "Failed to create test assessment";

      if (!ok || !newAssessmentId) {
        throw new Error(err);
      }

      // Refresh assessments list
      await fetchAssessments(showTestAssessments);

      // Navigate to the new test assessment
      router.push(`/assessments/${newAssessmentId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create test assessment';
      console.error('[Test Assessment] Error:', err);
      alert(errorMessage);
    } finally {
      setCreatingTest(false);
    }
  };

  const isTestAssessment = (assessment: Assessment): boolean => {
    const name = assessment.name || assessment.facility_name || '';
    return (
      assessment.qa_flag === true ||
      assessment.test_run_id !== null ||
      name.startsWith('[QA]') ||
      name.toLowerCase().includes('test')
    );
  };

  return (
    <section className="section active">
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <h2 className="section-title">Assessments</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
            <input
              type="checkbox"
              checked={showTestAssessments}
              onChange={(e) => setShowTestAssessments(e.target.checked)}
              style={{ margin: 0 }}
            />
            Show test assessments
          </label>
          <button
            onClick={handleCreateTestAssessment}
            disabled={creatingTest}
            className="usa-button"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: creatingTest ? "#9ca3af" : "#005ea2",
              cursor: creatingTest ? "not-allowed" : "pointer",
              opacity: creatingTest ? 0.6 : 1,
            }}
            title="Create a test/training assessment that can be easily deleted"
          >
            {creatingTest ? "Creating..." : "Create Test Assessment"}
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="usa-button"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            Create New Assessment
          </button>
        </div>
      </div>

      <CreateAssessmentDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleAssessmentCreated}
      />

      {assessments.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
              No Assessments Found
            </h3>
            <p style={{ marginBottom: "1.5rem", color: "#71767a" }}>
              No assessments are available. Create a new assessment to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Assessment ID</th>
                  <th>Facility Name</th>
                  <th>Sector</th>
                  <th>Subsector</th>
                  <th>Status</th>
                  <th>Updated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => {
                  const status = assessment.status || "DRAFT";
                  const statusColor = 
                    status === "LOCKED" ? "#d13212" :
                    status === "SUBMITTED" ? "#fdb81e" :
                    status === "IN_PROGRESS" ? "#005ea2" :
                    "#71767a";
                  
                  return (
                    <tr key={assessment.assessment_id}>
                      <td>{assessment.assessment_id}</td>
                      <td>{assessment.name || assessment.facility_name || "N/A"}</td>
                      <td>{assessment.sector_name || assessment.sector || "N/A"}</td>
                      <td>{assessment.subsector_name || assessment.subsector || "N/A"}</td>
                      <td>
                        <span style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: statusColor,
                          color: status === "SUBMITTED" ? "#1b1b1b" : "white",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: "600"
                        }}>
                          {status}
                        </span>
                      </td>
                      <td>
                        {assessment.updated_at
                          ? new Date(assessment.updated_at).toLocaleString()
                          : "N/A"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <Link
                            href={`/assessments/${assessment.assessment_id}`}
                            className="btn btn-sm btn-primary"
                          >
                            {status === "LOCKED" ? "View" : "Open"}
                          </Link>
                          {isTestAssessment(assessment) && (
                            <button
                              onClick={() => handleDelete(assessment.assessment_id)}
                              disabled={deletingId === assessment.assessment_id}
                              className="btn btn-sm"
                              style={{
                                backgroundColor: "#d13212",
                                color: "white",
                                border: "none",
                                padding: "0.25rem 0.75rem",
                                fontSize: "0.875rem",
                                cursor: deletingId === assessment.assessment_id ? "not-allowed" : "pointer",
                                opacity: deletingId === assessment.assessment_id ? 0.6 : 1,
                              }}
                              title="Delete test assessment"
                            >
                              {deletingId === assessment.assessment_id ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

