"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Draft {
  id: string;
  module_code: string | null;
  title: string;
  summary: string | null;
  status: string;
}

interface DraftSource {
  id: string;
  source_id: string;
  source_label: string | null;
  source_url: string | null;
}

interface DraftQuestion {
  id: string;
  question_text: string;
  discipline_id: string;
  discipline_subtype_id: string | null;
  confidence: number | null;
  rationale: string | null;
  status: string;
  discipline_name: string | null;
  discipline_subtype_name: string | null;
}

interface Discipline {
  id: string;
  name: string;
  code?: string;
  discipline_subtypes: Array<{ id: string; name: string; code?: string; discipline_id: string }>;
}

type QuestionEdits = Record<string, { question_text: string; discipline_id: string; discipline_subtype_id: string | null }>;

export default function ModuleDraftReviewPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = String(params?.draftId || "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [questionEdits, setQuestionEdits] = useState<QuestionEdits>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [publishCode, setPublishCode] = useState("");
  const [publishTitle, setPublishTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const [generateModuleCode, setGenerateModuleCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadDraft = useCallback(() => {
    if (!draftId) return;
    fetch(`/api/admin/module-drafts/${draftId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.draft) {
          setDraft(d.draft);
          setTitle(d.draft.title || "");
          setSummary(d.draft.summary || "");
          setSources(d.sources || []);
          const qs = d.questions || [];
          setQuestions(qs);
          const edits: QuestionEdits = {};
          qs.forEach((q: DraftQuestion) => {
            edits[q.id] = {
              question_text: q.question_text || "",
              discipline_id: q.discipline_id || "",
              discipline_subtype_id: q.discipline_subtype_id || null,
            };
          });
          setQuestionEdits(edits);
        } else setError(d.error || "Failed to load draft");
      })
      .catch(() => setError("Failed to load draft"))
      .finally(() => setLoading(false));
  }, [draftId]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (draft) setPublishTitle(draft.title || "");
  }, [draft]);

  useEffect(() => {
    fetch("/api/reference/disciplines?active=true")
      .then((r) => r.json())
      .then((d) => {
        if (d.disciplines) setDisciplines(d.disciplines);
      })
      .catch(() => {});
  }, []);


  const handleGenerate = () => {
    const code = generateModuleCode.trim();
    if (!code || !/^MODULE_[A-Z0-9_]+$/.test(code)) {
      setGenerateError("module_code is required and must match MODULE_[A-Z0-9_]+");
      return;
    }
    setGenerateError(null);
    setGenerating(true);
    fetch(`/api/admin/module-drafts/${draftId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_code: code }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) loadDraft();
        else setGenerateError(d.error || "Failed to generate.");
      })
      .catch(() => setGenerateError("Failed to generate."))
      .finally(() => setGenerating(false));
  };

  const saveMeta = () => {
    if (!draftId || draft?.status !== "DRAFT") return;
    setSavingMeta(true);
    fetch(`/api/admin/module-drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || undefined, summary: summary || undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) loadDraft();
      })
      .finally(() => setSavingMeta(false));
  };

  const setEdit = (qId: string, field: "question_text" | "discipline_id" | "discipline_subtype_id", value: string | null) => {
    setQuestionEdits((prev) => {
      const cur = prev[qId] || { question_text: "", discipline_id: "", discipline_subtype_id: null };
      const next = { ...prev, [qId]: { ...cur, [field]: value === "" ? null : value } };
      if (field === "discipline_id") next[qId].discipline_subtype_id = null;
      return next;
    });
  };

  const setQuestionStatus = (qId: string, status: "ACCEPTED" | "REJECTED") => {
    const edits = questionEdits[qId];
    if (!edits) return;
    
    // Client-side validation for ACCEPTED questions
    if (status === "ACCEPTED") {
      const qText = edits.question_text.trim();
      if (!qText || qText.length < 12 || !qText.endsWith("?")) {
        alert("Question must be at least 12 characters and end with '?'");
        return;
      }
      const lower = qText.toLowerCase();
      const banned = [
        "is the facility able to",
        "can the facility",
        "identify and respond to behavior",
        "interpersonal violence",
        "targeted grievance"
      ];
      if (banned.some(p => lower.includes(p))) {
        alert("Question contains banned phrases. Please edit before accepting.");
        return;
      }
    }
    
    setUpdatingId(qId);
    fetch(`/api/admin/module-drafts/${draftId}/questions/${qId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        edits: {
          question_text: edits.question_text.trim() || undefined,
          discipline_id: edits.discipline_id?.trim() ? edits.discipline_id : undefined,
          discipline_subtype_id: edits.discipline_subtype_id === null || edits.discipline_subtype_id === "" ? null : edits.discipline_subtype_id,
        },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          loadDraft();
        } else {
          alert(d.error || "Failed to update question. " + (d.reasons ? d.reasons.join(", ") : ""));
        }
      })
      .catch((e) => {
        alert("Failed to update question: " + e.message);
      })
      .finally(() => setUpdatingId(null));
  };

  const clearAllDrafts = async () => {
    const draftQuestions = questions.filter((q) => q.status === "DRAFT");
    if (draftQuestions.length === 0) return;
    
    setClearingAll(true);
    try {
      // Reject all DRAFT questions in parallel
      const promises = draftQuestions.map((q) => {
        const edits = questionEdits[q.id] || { question_text: q.question_text, discipline_id: q.discipline_id || "", discipline_subtype_id: q.discipline_subtype_id || null };
        return fetch(`/api/admin/module-drafts/${draftId}/questions/${q.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "REJECTED",
            edits: {
              question_text: edits.question_text.trim() || undefined,
              discipline_id: edits.discipline_id?.trim() ? edits.discipline_id : undefined,
              discipline_subtype_id: edits.discipline_subtype_id === null || edits.discipline_subtype_id === "" ? null : edits.discipline_subtype_id,
            },
          }),
        });
      });
      
      await Promise.all(promises);
      loadDraft();
    } catch (e) {
      console.error("Failed to clear all:", e);
    } finally {
      setClearingAll(false);
    }
  };

  const handlePublish = () => {
    const code = publishCode.trim();
    const t = publishTitle.trim();
    if (!/^MODULE_[A-Z0-9_]+$/.test(code)) {
      setPublishError("module_code is required and must match MODULE_[A-Z0-9_]+");
      return;
    }
    if (!t) {
      setPublishError("title is required");
      return;
    }
    setPublishError(null);
    setPublishing(true);
    fetch(`/api/admin/module-drafts/${draftId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_code: code, title: t }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.module_code) {
          router.push(`/admin/modules/${d.module_code}`);
          return;
        }
        setPublishError(d.error || d.message || "Failed to publish");
      })
      .catch(() => setPublishError("Failed to publish"))
      .finally(() => setPublishing(false));
  };

  const acceptedCount = questions.filter((q) => q.status === "ACCEPTED").length;

  if (loading) return <div style={{ padding: "var(--spacing-lg)" }}>Loading draft…</div>;
  if (error || !draft) return <div style={{ padding: "var(--spacing-lg)", color: "#b50909" }}>{error || "Draft not found"}</div>;
  if (draft.status !== "DRAFT") {
    return (
      <div className="card">
        <p>This draft is already {draft.status.toLowerCase()}.</p>
        <Link href="/admin/module-management">Back to Module Management</Link>
      </div>
    );
  }

  const subtypesFor = (disciplineId: string) =>
    disciplines.find((d) => d.id === disciplineId)?.discipline_subtypes || [];

  return (
    <div>
      <div
        style={{
          padding: "var(--spacing-md)",
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "var(--border-radius)",
          marginBottom: "var(--spacing-lg)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <strong>Draft / Needs Review.</strong> These are draft suggestions. Review and accept before publishing. OFCs are not created by this flow.
      </div>

      <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
        <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-md)" }}>Generate suggestions</h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", marginBottom: "var(--spacing-md)" }}>
          Generate template-based questions from evidence in draft sources. Requires module_code to load template.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)", maxWidth: 400, marginBottom: "var(--spacing-md)" }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>module_code (e.g. MODULE_EV_PARKING) *</label>
            <input
              type="text"
              value={generateModuleCode}
              onChange={(e) => setGenerateModuleCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="MODULE_"
              disabled={generating}
              style={{ width: "100%", padding: "var(--spacing-sm) var(--spacing-md)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
            />
          </div>
        </div>
        {generateError && <p style={{ color: "#b50909", marginBottom: "var(--spacing-sm)" }}>{generateError}</p>}
        <button type="button" onClick={handleGenerate} disabled={generating || !generateModuleCode.trim()} style={{ padding: "var(--spacing-sm) var(--spacing-md)", background: generating || !generateModuleCode.trim() ? "#ccc" : "var(--cisa-blue)", color: "#fff", border: "none", borderRadius: "var(--border-radius)", cursor: generating || !generateModuleCode.trim() ? "not-allowed" : "pointer" }}>
          {generating ? "Generating…" : "Generate suggestions"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
        <h1 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-md)" }}>Draft: {draft.title || "Untitled"}</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)", maxWidth: 600 }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveMeta}
              disabled={savingMeta}
              style={{ width: "100%", padding: "var(--spacing-sm) var(--spacing-md)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={saveMeta}
              disabled={savingMeta}
              rows={3}
              style={{ width: "100%", padding: "var(--spacing-sm) var(--spacing-md)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
            />
          </div>
        </div>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", marginTop: "var(--spacing-sm)" }}>Sources: {sources.map((s) => s.source_label || s.source_id).join(", ")}</p>
      </div>

      <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-md)" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, margin: 0 }}>Suggested questions</h2>
          {questions.filter((q) => q.status === "DRAFT").length > 0 && (
            <button
              type="button"
              onClick={clearAllDrafts}
              disabled={clearingAll || !!updatingId}
              style={{
                padding: "var(--spacing-xs) var(--spacing-md)",
                fontSize: "var(--font-size-sm)",
                background: clearingAll ? "#ccc" : "#dc3545",
                color: "#fff",
                border: "none",
                borderRadius: "var(--border-radius)",
                cursor: clearingAll || updatingId ? "not-allowed" : "pointer",
                fontWeight: 500,
              }}
            >
              {clearingAll ? "Clearing…" : "Clear All"}
            </button>
          )}
        </div>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", marginBottom: "var(--spacing-md)" }}>
          Edit text and discipline/subtype as needed. Accept or reject each. Only accepted questions are published.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--cisa-gray-light)", textAlign: "left" }}>
                <th style={{ padding: "var(--spacing-sm)", width: "28%" }}>Question (editable)</th>
                <th style={{ padding: "var(--spacing-sm)", width: "14%" }}>Discipline</th>
                <th style={{ padding: "var(--spacing-sm)", width: "14%" }}>Subtype</th>
                <th style={{ padding: "var(--spacing-sm)", width: "18%" }}>Evidence</th>
                <th style={{ padding: "var(--spacing-sm)", width: "16%" }}>Status / Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const edits = questionEdits[q.id] || { question_text: q.question_text, discipline_id: q.discipline_id || "", discipline_subtype_id: q.discipline_subtype_id || null };
                const isDraft = q.status === "DRAFT";
                const subs = subtypesFor(edits.discipline_id);
                return (
                  <tr key={q.id} style={{ borderBottom: "1px solid var(--cisa-gray-light)", verticalAlign: "top" }}>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {isDraft ? (
                        <input
                          value={edits.question_text}
                          onChange={(e) => setEdit(q.id, "question_text", e.target.value)}
                          style={{ width: "100%", padding: "var(--spacing-xs) var(--spacing-sm)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
                        />
                      ) : (
                        <span>{q.question_text}</span>
                      )}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {isDraft ? (
                        <select
                          value={edits.discipline_id}
                          onChange={(e) => setEdit(q.id, "discipline_id", e.target.value)}
                          style={{ width: "100%", padding: "var(--spacing-xs) var(--spacing-sm)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
                        >
                          <option value="">—</option>
                          {disciplines.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{q.discipline_name || "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {isDraft ? (
                        <select
                          value={edits.discipline_subtype_id || ""}
                          onChange={(e) => setEdit(q.id, "discipline_subtype_id", e.target.value || null)}
                          style={{ width: "100%", padding: "var(--spacing-xs) var(--spacing-sm)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
                        >
                          <option value="">—</option>
                          {subs.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{q.discipline_subtype_name || "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)", color: "var(--cisa-gray)", fontSize: "var(--font-size-xs)" }}>
                      {q.rationale ? (
                        <div style={{ maxWidth: 300 }}>
                          <div style={{ fontStyle: "italic", marginBottom: 4 }}>{q.rationale}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {q.status === "ACCEPTED" && <span style={{ color: "#0d8050", fontWeight: 500 }}>Accepted</span>}
                      {q.status === "REJECTED" && <span style={{ color: "var(--cisa-gray)" }}>Rejected</span>}
                      {isDraft && (
                        <div style={{ display: "flex", gap: "var(--spacing-xs)", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setQuestionStatus(q.id, "ACCEPTED")}
                            disabled={!!updatingId || clearingAll}
                            style={{ padding: "2px 8px", fontSize: "var(--font-size-xs)", background: "#0d8050", color: "#fff", border: "none", borderRadius: "var(--border-radius)", cursor: updatingId || clearingAll ? "not-allowed" : "pointer" }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestionStatus(q.id, "REJECTED")}
                            disabled={!!updatingId || clearingAll}
                            style={{ padding: "2px 8px", fontSize: "var(--font-size-xs)", background: "var(--cisa-gray)", color: "#fff", border: "none", borderRadius: "var(--border-radius)", cursor: updatingId || clearingAll ? "not-allowed" : "pointer" }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {questions.length === 0 && <p style={{ padding: "var(--spacing-md)", color: "var(--cisa-gray)" }}>No suggested questions.</p>}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, marginBottom: "var(--spacing-md)" }}>Publish draft</h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)", marginBottom: "var(--spacing-md)" }}>
          Only ACCEPTED questions will be copied into the module. Requires module_code and title. No OFCs are created.
        </p>
        {publishError && <p style={{ color: "#b50909", marginBottom: "var(--spacing-sm)" }}>{publishError}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)", maxWidth: 400, marginBottom: "var(--spacing-md)" }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>module_code (e.g. MODULE_WATER_CYBER) *</label>
            <input
              value={publishCode}
              onChange={(e) => setPublishCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="MODULE_"
              style={{ width: "100%", padding: "var(--spacing-sm) var(--spacing-md)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--spacing-xs)" }}>title *</label>
            <input
              value={publishTitle}
              onChange={(e) => setPublishTitle(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm) var(--spacing-md)", border: "1px solid var(--cisa-gray-light)", borderRadius: "var(--border-radius)" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            style={{
              padding: "var(--spacing-sm) var(--spacing-lg)",
              background: publishing ? "#ccc" : "var(--cisa-blue)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontWeight: 600,
              cursor: publishing ? "not-allowed" : "pointer",
            }}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--cisa-gray)" }}>Accepted: {acceptedCount}</span>
          <Link href="/admin/module-drafts/build" style={{ fontSize: "var(--font-size-sm)" }}>Build another draft</Link>
          <Link href="/admin/module-management" style={{ fontSize: "var(--font-size-sm)" }}>Module Management</Link>
        </div>
      </div>
    </div>
  );
}
