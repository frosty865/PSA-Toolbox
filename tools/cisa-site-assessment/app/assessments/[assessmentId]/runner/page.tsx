"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type UniverseItem = {
  question_code: string;
  layer: string;
  order_index: number;
  meta: Record<string, unknown>;
};

type ResponseRow = {
  question_code: string;
  response_enum: "YES" | "NO" | "N_A";
  detail: Record<string, unknown>;
};

function Radio({ value, current, onChange }: { value: "YES" | "NO" | "N_A"; current?: string; onChange: (v: "YES" | "NO" | "N_A") => void }) {
  return (
    <label style={{ marginRight: 12, cursor: "pointer" }}>
      <input
        type="radio"
        name="response"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        style={{ marginRight: 6 }}
      />
      {value}
    </label>
  );
}

export default function AssessmentRunner() {
  const params = useParams();
  const assessmentId = params?.assessmentId as string;

  const [universe, setUniverse] = useState<UniverseItem[]>([]);
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>({});
  const [responses, setResponses] = useState<Record<string, ResponseRow>>({});
  const [status, setStatus] = useState<"DRAFT" | "IN_PROGRESS" | "COMPLETE">("DRAFT");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assessmentId) return;

    (async () => {
      try {
        setLoading(true);
        
        // Load question universe
        const uRes = await fetch(`/api/runtime/assessments/${assessmentId}/question-universe`, { cache: "no-store" });
        const uData = await uRes.json();
        const questions = (uData?.questions ?? []).map((q: Record<string, unknown>) => ({
          question_code: q.question_code,
          layer: q.layer,
          order_index: q.order_index,
          meta: q.meta ?? {}
        }));
        setUniverse(questions);

        // Load question texts
        const textsRes = await fetch(`/api/runtime/questions?universe=ALL`, { cache: "no-store" });
        const textsData = await textsRes.json();
        const textMap: Record<string, string> = {};
        
        // Map BASE questions
        for (const q of textsData?.base_questions ?? []) {
          textMap[q.question_code] = q.question_text || q.question_code;
        }
        
        // Map EXPANSION questions
        for (const q of textsData?.expansion_questions ?? []) {
          textMap[q.question_code] = q.question_text || q.question_code;
        }
        
        setQuestionTexts(textMap);

        // Load existing responses
        const rRes = await fetch(`/api/runtime/assessments/${assessmentId}/responses`, { cache: "no-store" });
        const rData = await rRes.json();
        const responseMap: Record<string, ResponseRow> = {};
        for (const row of rData?.responses ?? []) {
          responseMap[row.question_code] = row;
        }
        setResponses(responseMap);

        // Load status
        const sRes = await fetch(`/api/runtime/assessments/${assessmentId}/status`, { cache: "no-store" });
        const sData = await sRes.json();
        setStatus(sData?.status ?? "DRAFT");
      } catch (error) {
        console.error("Failed to load assessment:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [assessmentId]);

  const ordered = useMemo(() => universe.slice().sort((a, b) => a.order_index - b.order_index), [universe]);

  async function saveOne(question_code: string, response_enum: "YES" | "NO" | "N_A") {
    setSaving(true);
    try {
      const next = {
        ...responses,
        [question_code]: { question_code, response_enum, detail: responses?.[question_code]?.detail ?? {} }
      };
      setResponses(next);

      await fetch(`/api/runtime/assessments/${assessmentId}/responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ question_code, response_enum, detail: next[question_code].detail }] })
      });

      setStatus("IN_PROGRESS");
    } catch (error) {
      console.error("Failed to save response:", error);
      alert("Failed to save response. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    setSaving(true);
    try {
      await fetch(`/api/runtime/assessments/${assessmentId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETE" })
      });
      setStatus("COMPLETE");
    } catch (error) {
      console.error("Failed to mark complete:", error);
      alert("Failed to mark complete. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const answeredCount = Object.values(responses).filter(r => !!r?.response_enum).length;

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <p>Loading assessment...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Assessment Runner</h1>
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
        <div><strong>Assessment ID:</strong> {assessmentId}</div>
        <div><strong>Status:</strong> <span style={{ textTransform: "uppercase" }}>{status}</span></div>
        <div><strong>Progress:</strong> {answeredCount} / {ordered.length} questions answered</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          onClick={markComplete}
          disabled={saving || status === "COMPLETE"}
          style={{
            padding: "8px 16px",
            border: "1px solid #999",
            borderRadius: 6,
            backgroundColor: status === "COMPLETE" ? "#4CAF50" : "#fff",
            color: status === "COMPLETE" ? "#fff" : "#000",
            cursor: saving || status === "COMPLETE" ? "not-allowed" : "pointer"
          }}
        >
          {status === "COMPLETE" ? "✓ Complete" : "Mark Complete"}
        </button>
        {saving && <span style={{ padding: "8px 0" }}>Saving…</span>}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {ordered.map((q) => {
          const current = responses?.[q.question_code]?.response_enum;
          const questionText = questionTexts[q.question_code] || q.question_code;
          
          return (
            <div
              key={q.question_code}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                backgroundColor: current ? "#fff" : "#fafafa"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  #{q.order_index} • {q.question_code}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {q.layer}
                  {q?.meta?.group ? ` • ${q.meta.group}` : ""}
                </div>
              </div>

              <div style={{ marginBottom: 12, fontSize: 15, lineHeight: 1.5 }}>
                {questionText}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Radio value="YES" current={current} onChange={(v) => saveOne(q.question_code, v)} />
                <Radio value="NO" current={current} onChange={(v) => saveOne(q.question_code, v)} />
                <Radio value="N_A" current={current} onChange={(v) => saveOne(q.question_code, v)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


