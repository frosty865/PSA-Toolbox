"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/app/components/AdminNav";

interface Candidate {
  id: string;
  discipline_subtype_id: string;
  problem_statement: string;
  evidence: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
  discipline_subtype_code?: string | null;
  discipline_subtype_name?: string | null;
}

const MAX_OFCS_PER_VULN = 4;

export default function ProblemCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [promoteModal, setPromoteModal] = useState<Candidate | null>(null);
  const [capabilityStatement, setCapabilityStatement] = useState("");
  const [promoting, setPromoting] = useState(false);

  const loadCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/problem-candidates?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCandidates(data.candidates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load candidates");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when statusFilter changes
  }, [statusFilter]);

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      const res = await fetch(`/api/admin/problem-candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      await loadCandidates();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setRejectingId(null);
    }
  };

  const handlePromoteSubmit = async () => {
    if (!promoteModal) return;
    const text = capabilityStatement.trim();
    if (!text) {
      alert("Capability statement (OFC text) is required.");
      return;
    }
    setPromoting(true);
    try {
      const res = await fetch(`/api/admin/problem-candidates/${promoteModal.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability_statement: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Promote failed");
      setPromoteModal(null);
      setCapabilityStatement("");
      await loadCandidates();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Promote failed");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div style={{ padding: "var(--spacing-lg)" }}>
      <AdminNav />
      <h1 style={{ marginBottom: "var(--spacing-md)" }}>Problem Candidates</h1>
      <p style={{ marginBottom: "var(--spacing-md)", color: "#555" }}>
        Review evidence and promote PENDING candidates to authored canonical OFCs. Only admin promotion creates canonical OFCs; corpus pipeline is evidence-only.
      </p>

      <div style={{ marginBottom: "var(--spacing-md)", display: "flex", gap: "var(--spacing-sm)", alignItems: "center" }}>
        <label>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "4px 8px" }}
        >
          <option value="">All</option>
          <option value="PENDING">PENDING</option>
          <option value="REJECTED">REJECTED</option>
          <option value="ACCEPTED">ACCEPTED</option>
        </select>
      </div>

      {error && <p style={{ color: "#b50909", marginBottom: "var(--spacing-md)" }}>{error}</p>}
      {loading && <p>Loading…</p>}
      {!loading && candidates.length === 0 && <p>No candidates found.</p>}
      {!loading && candidates.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {candidates.map((c) => (
            <li
              key={c.id}
              style={{
                border: "1px solid #dfe1e2",
                borderRadius: "4px",
                padding: "var(--spacing-md)",
                marginBottom: "var(--spacing-sm)",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--spacing-sm)" }}>
                <div style={{ flex: "1 1 300px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{c.problem_statement?.slice(0, 200)}{(c.problem_statement?.length ?? 0) > 200 ? "…" : ""}</div>
                  <div style={{ fontSize: "0.875rem", color: "#555" }}>
                    Subtype: {c.discipline_subtype_code ?? c.discipline_subtype_name ?? c.discipline_subtype_id}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#71767a" }}>
                    {c.status} · {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {c.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPromoteModal(c);
                          setCapabilityStatement(c.problem_statement?.slice(0, 500) ?? "");
                        }}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#005ea2",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Promote → Author OFC
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(c.id)}
                        disabled={rejectingId === c.id}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#71767a",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: rejectingId === c.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {rejectingId === c.id ? "Rejecting…" : "Reject"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {c.evidence && Object.keys(c.evidence).length > 0 && (
                <details style={{ marginTop: "8px" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.875rem" }}>Evidence</summary>
                  <pre style={{ fontSize: "0.75rem", overflow: "auto", marginTop: "4px", padding: "8px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                    {JSON.stringify(c.evidence, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {promoteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !promoting && setPromoteModal(null)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "var(--spacing-lg)",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Promote to canonical OFC</h2>
            <p style={{ fontSize: "0.875rem", color: "#555" }}>
              Author the capability statement (OFC text). Subtype is copied from the candidate; OFC will be canonical (no module_code).
            </p>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 600 }}>Capability statement (OFC text)</label>
            <textarea
              value={capabilityStatement}
              onChange={(e) => setCapabilityStatement(e.target.value)}
              rows={6}
              style={{ width: "100%", padding: "8px", marginBottom: "var(--spacing-md)" }}
              placeholder="Enter the authored OFC capability statement…"
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => !promoting && setPromoteModal(null)}
                style={{ padding: "8px 16px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromoteSubmit}
                disabled={promoting || !capabilityStatement.trim()}
                style={{
                  padding: "8px 16px",
                  backgroundColor: promoting ? "#71767a" : "#005ea2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: promoting ? "not-allowed" : "pointer",
                }}
              >
                {promoting ? "Promoting…" : "Promote"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: "var(--spacing-lg)", fontSize: "0.875rem", color: "#71767a" }}>
        Assessment UI shows canonical OFCs only; hard cap {MAX_OFCS_PER_VULN} OFCs per question; zero OFCs if subtype mismatch or missing subtype.
      </p>
    </div>
  );
}
