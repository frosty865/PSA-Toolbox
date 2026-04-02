"use client";

import { useState } from "react";

interface SubmitLockActionsProps {
  assessmentId: string;
  status: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "LOCKED";
  onStatusChange?: (newStatus: string) => void;
}

export default function SubmitLockActions({
  assessmentId,
  status,
  onStatusChange,
}: SubmitLockActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/runtime/assessments/${assessmentId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed to submit assessment (${response.status})`);
      }

      const data = await response.json();
      if (onStatusChange) {
        onStatusChange(data.new_status || "SUBMITTED");
      }
      // Reload page to reflect new status
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit assessment");
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to lock assessment (${response.status})`);
      }

      const data = await response.json();
      if (onStatusChange) {
        onStatusChange(data.status);
      }
      // Reload page to reflect new status
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock assessment");
    } finally {
      setLoading(false);
      setShowLockConfirm(false);
    }
  };

  // Don't show actions if already locked
  if (status === "LOCKED") {
    return null;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      {error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #d13212",
            borderRadius: "0.25rem",
            marginBottom: "1rem",
            color: "#d13212",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {status !== "SUBMITTED" && (
          <button
            className="usa-button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Assessment"}
          </button>
        )}

        {status === "SUBMITTED" && !showLockConfirm && (
          <button
            className="usa-button usa-button--secondary"
            onClick={() => setShowLockConfirm(true)}
            disabled={loading}
          >
            Lock Assessment
          </button>
        )}

        {showLockConfirm && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fffbf0",
              border: "1px solid #fdb81e",
              borderRadius: "0.25rem",
              marginTop: "1rem",
            }}
          >
            <p style={{ margin: "0 0 1rem 0", fontWeight: "600" }}>
              Confirm Lock Assessment
            </p>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem" }}>
              Locking an assessment is <strong>irreversible</strong>. Once locked, the
              assessment becomes read-only and cannot be modified.
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="usa-button"
                onClick={handleLock}
                disabled={loading}
              >
                {loading ? "Locking..." : "Confirm Lock"}
              </button>
              <button
                className="usa-button usa-button--outline"
                onClick={() => {
                  setShowLockConfirm(false);
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

