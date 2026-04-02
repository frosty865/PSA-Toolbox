"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export interface AdminOfc {
  id: string;
  ofc_text: string;
  title: string | null;
  version: number;
  status: string;
  status_reason: string | null;
  ofc_origin?: "CORPUS" | "MODULE";
  submitted_by: string | null;
  submitted_at: string | null;
  reference_unresolved: boolean;
  evidence_excerpt: string | null;
  discipline: string | null;
  discipline_id: string | null;
  subtype: string | null;
  subtype_id: string | null;
  supersedes_ofc_id: string | null;
  supersedes_version: number | null;
  source?: "nomination" | "mined";
  candidate_id?: string;
  document_chunk_id?: string | null;
  source_id?: string | null;
  citation?: string | null;
  source_title?: string | null;
  source_publisher?: string | null;
  source_published_date?: string | null;
  source_type?: string | null;
  source_uri?: string | null;
  document_title?: string | null;
  locator_type?: string | null;
  locator?: string | null;
  page_number?: number | null;
}

export default function OFCReviewQueue() {
  const [ofcs, setOfcs] = useState<AdminOfc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadReviewQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount and when statusFilter changes
  }, [statusFilter]);

  const loadReviewQueue = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter) {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/admin/ofcs/review-queue?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to load review queue");
      }

      if (data.success && data.ofcs) {
        setOfcs(data.ofcs);
      } else {
        setOfcs([]);
      }
    } catch (err) {
      console.error("Error loading review queue:", err);
      setError(err instanceof Error ? err.message : "Failed to load review queue");
      setOfcs([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
      case "UNDER_REVIEW":
        return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
      case "APPROVED":
        return { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" };
      case "REJECTED":
        return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
      case "PENDING":
        return { bg: "#e0e7ff", color: "#3730a3", border: "#a5b4fc" };
      case "REVIEWED":
        return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
      case "PROMOTED":
        return { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" };
      default:
        return { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" };
    }
  };

  const getOriginBadgeColor = (origin: "CORPUS" | "MODULE" | undefined) => {
    if (!origin) return { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" };
    switch (origin) {
      case "CORPUS":
        return { bg: "#e0f2fe", color: "#0c4a6e", border: "#7dd3fc" };
      case "MODULE":
        return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
      default:
        return { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" };
    }
  };

  const handlePromote = async (ofc: AdminOfc) => {
    if (!ofc.candidate_id) return;
    setActionLoading(ofc.id);
    try {
      const response = await fetch(`/api/admin/ofcs/candidates/${ofc.candidate_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PROMOTED", reviewed_by: "ADMIN" }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.ok === false && data.error) {
          const errorMsg = data.error.message || "Failed to promote candidate";
          const requestId = data.requestId ? ` (Request ID: ${data.requestId})` : "";
          throw new Error(`${errorMsg}${requestId}`);
        }
        throw new Error(data.error || data.message || "Failed to promote candidate");
      }

      if (data.ok === true || data.success === true) {
        await loadReviewQueue();
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to promote candidate";
      setError(errorMessage);
      console.error("[handlePromote] Error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (ofc: AdminOfc) => {
    if (!ofc.candidate_id) return;
    setActionLoading(ofc.id);
    try {
      const response = await fetch(`/api/admin/ofcs/candidates/${ofc.candidate_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED", reviewed_by: "ADMIN" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to reject candidate");
      }
      await loadReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject candidate");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (ofc: AdminOfc) => {
    if (!ofc.candidate_id) return;
    setEditingId(ofc.id);
    setEditText(ofc.ofc_text);
  };

  const handleSaveEdit = async (ofc: AdminOfc) => {
    if (!ofc.candidate_id || !editText.trim()) return;
    setActionLoading(ofc.id);
    try {
      const response = await fetch(`/api/admin/ofcs/candidates/${ofc.candidate_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snippet_text: editText.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update candidate");
      }
      setEditingId(null);
      setEditText("");
      await loadReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update candidate");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  if (loading) {
    return (
      <div className="card">
        <p>Loading review queue...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header" style={{ marginBottom: "var(--spacing-lg)" }}>
        <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, margin: 0 }}>
          CORPUS Review Queue
        </h2>
        <p
          style={{
            fontSize: "var(--font-size-base)",
            color: "var(--cisa-gray)",
            lineHeight: 1.6,
            marginTop: "var(--spacing-md)",
            maxWidth: "800px",
          }}
        >
          Review CORPUS candidates mined from sources. Origin controls routing (CORPUS vs MODULE).
          Citation is descriptive source text.
        </p>
        <div
          style={{
            marginTop: "var(--spacing-md)",
            padding: "var(--spacing-sm) var(--spacing-md)",
            backgroundColor: "#e0f2fe",
            border: "1px solid #7dd3fc",
            borderRadius: "var(--border-radius)",
            fontSize: "var(--font-size-sm)",
            color: "#0c4a6e",
            maxWidth: "800px",
          }}
        >
          <strong>Note:</strong> Origin controls routing (CORPUS vs MODULE). Citation is descriptive
          source metadata, not candidate origin.
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{
            marginBottom: "var(--spacing-lg)",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          <p style={{ color: "#991b1b", margin: 0 }}>
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
        <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
          >
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "var(--spacing-xs) var(--spacing-sm)",
                borderRadius: "var(--border-radius)",
                border: "1px solid var(--cisa-gray-light)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <option value="">All (SUBMITTED, UNDER_REVIEW, PENDING)</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="PENDING">PENDING (Mined)</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="PROMOTED">PROMOTED</option>
            </select>
          </label>
          <button
            onClick={loadReviewQueue}
            className="btn btn-secondary"
            style={{ fontSize: "var(--font-size-sm)" }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Review Queue Table */}
      <div className="card">
        {ofcs.length === 0 ? (
          <div
            style={{
              padding: "var(--spacing-xl)",
              textAlign: "center",
              color: "var(--cisa-gray)",
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>No OFCs in review queue</p>
            <p style={{ margin: "var(--spacing-sm) 0 0 0", fontSize: "var(--font-size-sm)" }}>
              {statusFilter
                ? `No OFCs found with status "${statusFilter}"`
                : "No OFCs are currently awaiting review"}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--cisa-gray-light)" }}>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Title
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    OFC Text
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Origin
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    <span
                      title="Source citation text; not candidate origin."
                      style={{ cursor: "help", borderBottom: "1px dotted var(--cisa-gray)" }}
                    >
                      Source
                    </span>
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Discipline
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Submitted By
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Submitted At
                  </th>
                  <th
                    style={{
                      padding: "var(--spacing-sm)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--cisa-gray-dark)",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {ofcs.map((ofc) => {
                  const statusColors = getStatusBadgeColor(ofc.status);
                  return (
                    <tr
                      key={ofc.id}
                      style={{
                        borderBottom: "1px solid var(--cisa-gray-light)",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <td style={{ padding: "var(--spacing-sm)" }}>
                        {ofc.title || <em style={{ color: "var(--cisa-gray)" }}>No title</em>}
                      </td>
                      <td style={{ padding: "var(--spacing-sm)", maxWidth: "500px" }}>
                        {editingId === ofc.id ? (
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              padding: "var(--spacing-xs)",
                              border: "1px solid var(--cisa-gray-light)",
                              borderRadius: "var(--border-radius)",
                              fontSize: "var(--font-size-sm)",
                              fontFamily: "inherit",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              wordWrap: "break-word",
                              overflowWrap: "break-word",
                              whiteSpace: "normal",
                              lineHeight: "1.5",
                            }}
                          >
                            {ofc.ofc_text || <em style={{ color: "var(--cisa-gray)" }}>No text</em>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "var(--spacing-sm)" }}>
                        {ofc.ofc_origin ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: getOriginBadgeColor(ofc.ofc_origin).bg,
                              color: getOriginBadgeColor(ofc.ofc_origin).color,
                              border: `1px solid ${getOriginBadgeColor(ofc.ofc_origin).border}`,
                            }}
                          >
                            {ofc.ofc_origin}
                          </span>
                        ) : (
                          <em style={{ color: "var(--cisa-gray)", fontSize: "var(--font-size-xs)" }}>N/A</em>
                        )}
                      </td>
                      <td style={{ padding: "var(--spacing-sm)", maxWidth: "300px" }}>
                        {(ofc.citation || ofc.source_title || ofc.source_publisher) ? (
                          <div
                            style={{
                              wordWrap: "break-word",
                              overflowWrap: "break-word",
                              whiteSpace: "normal",
                              fontSize: "var(--font-size-xs)",
                              lineHeight: "1.4",
                            }}
                          >
                            {ofc.citation ? (
                              <div style={{ marginBottom: "4px" }}>{ofc.citation}</div>
                            ) : (
                              <>
                                {ofc.source_title && (
                                  <div style={{ marginBottom: "2px" }}>{ofc.source_title}</div>
                                )}
                                {ofc.source_publisher && (
                                  <div
                                    style={{
                                      color: "var(--cisa-gray)",
                                      fontSize: "10px",
                                      marginBottom: "2px",
                                    }}
                                  >
                                    {ofc.source_publisher}
                                    {ofc.source_published_date &&
                                      `, ${new Date(ofc.source_published_date).getFullYear()}`}
                                  </div>
                                )}
                              </>
                            )}
                            {(ofc.page_number || ofc.locator) && (
                              <div
                                style={{
                                  color: "var(--cisa-gray)",
                                  fontSize: "10px",
                                  marginTop: "4px",
                                  borderTop: "1px solid var(--cisa-gray-light)",
                                  paddingTop: "4px",
                                }}
                              >
                                {ofc.page_number && <div>Page {ofc.page_number}</div>}
                                {ofc.locator && (
                                  <div>
                                    {ofc.locator_type || "Locator"}: {ofc.locator}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <em style={{ color: "var(--cisa-gray)", fontSize: "var(--font-size-xs)" }}>
                            No source
                          </em>
                        )}
                      </td>
                      <td style={{ padding: "var(--spacing-sm)" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: statusColors.bg,
                            color: statusColors.color,
                            border: `1px solid ${statusColors.border}`,
                          }}
                        >
                          {ofc.status}
                        </span>
                      </td>
                      <td style={{ padding: "var(--spacing-sm)" }}>
                        {ofc.discipline || <em style={{ color: "var(--cisa-gray)" }}>N/A</em>}
                        {ofc.subtype && (
                          <span style={{ color: "var(--cisa-gray)", fontSize: "11px" }}> / {ofc.subtype}</span>
                        )}
                      </td>
                      <td style={{ padding: "var(--spacing-sm)" }}>
                        {ofc.submitted_by || <em style={{ color: "var(--cisa-gray)" }}>N/A</em>}
                      </td>
                      <td style={{ padding: "var(--spacing-sm)" }}>{formatDate(ofc.submitted_at)}</td>
                      <td style={{ padding: "var(--spacing-sm)" }}>
                        {ofc.source === "mined" && ofc.candidate_id ? (
                          <div style={{ display: "flex", gap: "var(--spacing-xs)", flexWrap: "wrap" }}>
                            {editingId === ofc.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(ofc)}
                                  disabled={actionLoading === ofc.id}
                                  style={{
                                    padding: "4px 8px",
                                    backgroundColor: "#10b981",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "var(--border-radius)",
                                    fontSize: "11px",
                                    cursor: actionLoading === ofc.id ? "not-allowed" : "pointer",
                                    opacity: actionLoading === ofc.id ? 0.6 : 1,
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={actionLoading === ofc.id}
                                  style={{
                                    padding: "4px 8px",
                                    backgroundColor: "#6b7280",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "var(--border-radius)",
                                    fontSize: "11px",
                                    cursor: actionLoading === ofc.id ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(ofc)}
                                  disabled={actionLoading === ofc.id}
                                  style={{
                                    padding: "4px 8px",
                                    backgroundColor: "#3b82f6",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "var(--border-radius)",
                                    fontSize: "11px",
                                    cursor: actionLoading === ofc.id ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Edit
                                </button>
                                {ofc.status === "PENDING" && (
                                  <>
                                    <button
                                      onClick={() => handlePromote(ofc)}
                                      disabled={actionLoading === ofc.id}
                                      style={{
                                        padding: "4px 8px",
                                        backgroundColor: "#10b981",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "var(--border-radius)",
                                        fontSize: "11px",
                                        cursor: actionLoading === ofc.id ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      Promote
                                    </button>
                                    <button
                                      onClick={() => handleReject(ofc)}
                                      disabled={actionLoading === ofc.id}
                                      style={{
                                        padding: "4px 8px",
                                        backgroundColor: "#ef4444",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "var(--border-radius)",
                                        fontSize: "11px",
                                        cursor: actionLoading === ofc.id ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <Link
                            href={`/admin/ofcs/${ofc.id}`}
                            style={{
                              padding: "4px 12px",
                              backgroundColor: "var(--cisa-blue)",
                              color: "#ffffff",
                              textDecoration: "none",
                              borderRadius: "var(--border-radius)",
                              fontSize: "var(--font-size-sm)",
                              display: "inline-block",
                            }}
                          >
                            Review
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
