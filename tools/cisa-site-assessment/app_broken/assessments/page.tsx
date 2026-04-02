"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAssessments } from "@/src/data/psaDataProvider";
import CreateAssessmentDialog from "@/app/components/CreateAssessmentDialog";

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
}

export default function AssessmentsListPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch assessments list
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getAssessments();
        // Temporary diagnostic (remove after verification)
        console.log("Assessments from provider:", data);
        setAssessments(data);
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

    fetchAssessments();
  }, []);

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

  const handleAssessmentCreated = (assessmentId: string, instanceId: string) => {
    // Refresh assessments list
    const fetchAssessments = async () => {
      try {
        const data = await getAssessments();
        setAssessments(data);
      } catch (err) {
        console.error("Failed to refresh assessments:", err);
      }
    };
    fetchAssessments();
    
    // Navigate to the new assessment
    router.push(`/assessments/${assessmentId}`);
  };

  return (
    <section className="section active">
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="section-title">Assessments</h2>
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
                        <Link
                          href={`/assessments/${assessment.assessment_id}`}
                          className="btn btn-sm btn-primary"
                        >
                          {status === "LOCKED" ? "View" : "Open"}
                        </Link>
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

