"use client";

import { useState, useEffect } from "react";
import { promoteCandidateToAssessment } from "@/app/lib/api/promoteCandidateToAssessment";
import { toast } from "react-hot-toast";

type Candidate = {
  id: string;
  title: string;
  recommendation_text: string;
  discipline_subtype_id?: string;
  capability_dimension?: string;
  source_type?: string;
  match_score?: number;
};

interface OfcCandidatesPanelProps {
  assessmentId: string;
  responseId: string;
  answer: "YES" | "NO" | "N_A" | "N/A";
  onPromoted?: () => void;
}

export default function OfcCandidatesPanel({
  assessmentId,
  responseId,
  answer,
  onPromoted,
}: OfcCandidatesPanelProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Normalize answer format (UI uses "N/A", API uses "N_A")
  const normalizedAnswer = answer === "N/A" ? "N_A" : answer;

  // Only fetch if answer is NO
  useEffect(() => {
    if (normalizedAnswer !== "NO") {
      setCandidates([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/runtime/assessments/${assessmentId}/responses/${responseId}/ofc-candidates`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.error_code === "REQUIRES_NO_VULNERABILITY") {
            // Not an error - just means answer isn't NO
            setCandidates([]);
            return;
          }
          throw new Error(data.error || `Failed to fetch candidates: ${res.status}`);
        }
        const data = await res.json();
        setCandidates(data.candidates || []);
      })
      .catch((err) => {
        console.error("[OfcCandidatesPanel] Error fetching candidates:", err);
        setError(err instanceof Error ? err.message : "Failed to load candidates");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [assessmentId, responseId, normalizedAnswer]);

  // Don't render if answer is not NO
  if (normalizedAnswer !== "NO") {
    return null;
  }

  const handlePromote = async (candidateId: string) => {
    setPromoting(candidateId);
    try {
      await promoteCandidateToAssessment({
        assessmentId,
        assessmentResponseId: responseId,
        candidateId,
      });

      toast.success("Candidate promoted successfully");
      
      // Remove promoted candidate from list
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));

      // Call refresh hook if provided
      if (onPromoted) {
        onPromoted();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to promote candidate";
      toast.error(message);
      console.error("[OfcCandidatesPanel] Promote error:", err);
    } finally {
      setPromoting(null);
    }
  };

  // Truncate text helper
  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f8f9fa", borderRadius: "4px", borderLeft: "3px solid #005ea2" }}>
      <h6 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: "600" }}>
        OFC Candidates Available for Promotion
      </h6>

      {loading && (
        <p style={{ fontSize: "0.875rem", color: "#71767a" }}>Loading candidates...</p>
      )}

      {error && (
        <p style={{ fontSize: "0.875rem", color: "#b50909" }}>Error: {error}</p>
      )}

      {!loading && !error && candidates.length === 0 && (
        <p style={{ fontSize: "0.875rem", color: "#71767a" }}>
          No candidates available for this question.
        </p>
      )}

      {!loading && !error && candidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              style={{
                padding: "0.75rem",
                backgroundColor: "#ffffff",
                borderRadius: "4px",
                border: "1px solid #dfe1e2",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h6 style={{ fontSize: "0.875rem", fontWeight: "600", margin: 0 }}>
                  {candidate.title}
                </h6>
                {candidate.match_score !== undefined && candidate.match_score > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "#71767a" }}>
                    Match: {(candidate.match_score * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {candidate.recommendation_text && (
                <p style={{ fontSize: "0.8125rem", color: "#1b1b1b", marginBottom: "0.5rem", lineHeight: "1.4" }}>
                  {truncateText(candidate.recommendation_text)}
                </p>
              )}

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
                {candidate.capability_dimension && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.125rem 0.5rem",
                      backgroundColor: "#e0e7ff",
                      color: "#3730a3",
                      borderRadius: "2px",
                    }}
                  >
                    {candidate.capability_dimension}
                  </span>
                )}
                {candidate.source_type && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.125rem 0.5rem",
                      backgroundColor: "#f3f4f6",
                      color: "#374151",
                      borderRadius: "2px",
                    }}
                  >
                    {candidate.source_type}
                  </span>
                )}
              </div>

              <button
                onClick={() => handlePromote(candidate.id)}
                disabled={promoting === candidate.id}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.875rem",
                  backgroundColor: promoting === candidate.id ? "#71767a" : "#005ea2",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: promoting === candidate.id ? "not-allowed" : "pointer",
                }}
              >
                {promoting === candidate.id ? "Promoting..." : "Promote"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
