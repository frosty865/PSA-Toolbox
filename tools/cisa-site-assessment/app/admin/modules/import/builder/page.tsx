"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/app/lib/apiUrl";
import { readResponseJson } from "@/app/lib/http/responseJson";
import { validateModuleJson, type ValidationIssue } from "@/app/lib/admin/module_json_validator";

const EVENT_TRIGGERS = ["TAMPERING", "OTHER", "OUTAGE", "FIRE", "IMPACT"] as const;

type SubtypeOption = {
  discipline_id: string;
  discipline_code: string;
  discipline_name: string;
  subtype_id: string;
  subtype_name: string;
  subtype_code: string | null;
};

type QuestionRow = {
  text: string;
  discipline_id: string;
  discipline_subtype_id: string;
  asset_or_location: string;
  event_trigger: (typeof EVENT_TRIGGERS)[number];
};

type SourceRow = { url: string; label: string };

type OfcRow = {
  ofc_text: string;
  sources: SourceRow[];
};

type RiskRow = {
  driver_type: "CYBER_DRIVER" | "FRAUD_DRIVER";
  driver_text: string;
};

function moduleSlug(moduleCode: string): string {
  const u = moduleCode.toUpperCase().replace(/[^A-Z0-9_]/g, "_").trim();
  if (u.startsWith("MODULE_")) return u.slice("MODULE_".length);
  return u;
}

function emptyQuestion(): QuestionRow {
  return {
    text: "",
    discipline_id: "",
    discipline_subtype_id: "",
    asset_or_location: "",
    event_trigger: "TAMPERING",
  };
}

function emptyOfc(): OfcRow {
  return { ofc_text: "", sources: [] };
}

function emptyRisk(driver_type: "CYBER_DRIVER" | "FRAUD_DRIVER"): RiskRow {
  return { driver_type, driver_text: "" };
}

function buildPayload(
  moduleCode: string,
  title: string,
  description: string,
  importSource: string,
  mode: "REPLACE" | "APPEND",
  questions: QuestionRow[],
  ofcs: OfcRow[],
  riskRows: RiskRow[]
): Record<string, unknown> {
  const slug = moduleSlug(moduleCode);
  const mc = moduleCode.toUpperCase().trim();

  const module_questions = questions.map((q, i) => ({
    id: `MODULEQ_${slug}_${String(i + 1).padStart(3, "0")}`,
    text: q.text.trim(),
    order: i + 1,
    discipline_id: q.discipline_id,
    discipline_subtype_id: q.discipline_subtype_id,
    asset_or_location: q.asset_or_location.trim(),
    event_trigger: q.event_trigger,
  }));

  const module_ofcs = ofcs.map((o, i) => ({
    ofc_id: `MOD_OFC_${slug}_${String(i + 1).padStart(3, "0")}`,
    ofc_text: o.ofc_text.trim(),
    order_index: i + 1,
    sources: o.sources
      .filter((s) => (s.url?.trim() || s.label?.trim()))
      .map((s) => ({
        url: s.url?.trim() ?? "",
        label: s.label?.trim() ?? "",
      })),
  }));

  const risk_drivers = riskRows
    .filter((r) => r.driver_text.trim().length > 0)
    .map((r) => ({
      driver_type: r.driver_type,
      driver_text: r.driver_text.trim(),
    }));

  const out: Record<string, unknown> = {
    module_code: mc,
    title: title.trim(),
    module_questions,
    module_ofcs,
  };

  if (description.trim()) out.description = description.trim();
  if (importSource.trim()) out.import_source = importSource.trim();
  out.mode = mode;
  if (risk_drivers.length > 0) out.risk_drivers = risk_drivers;

  return out;
}

export default function ModuleImportJsonBuilderPage() {
  const router = useRouter();
  const [loadingRef, setLoadingRef] = useState(true);
  const [refError, setRefError] = useState<string | null>(null);
  const [subtypeOptions, setSubtypeOptions] = useState<SubtypeOption[]>([]);

  const [moduleCode, setModuleCode] = useState("MODULE_EXAMPLE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importSource, setImportSource] = useState("module_import_builder.json");
  const [mode, setMode] = useState<"REPLACE" | "APPEND">("REPLACE");

  const [questions, setQuestions] = useState<QuestionRow[]>([emptyQuestion()]);
  const [ofcs, setOfcs] = useState<OfcRow[]>([]);
  const [riskRows, setRiskRows] = useState<RiskRow[]>([
    emptyRisk("CYBER_DRIVER"),
    emptyRisk("FRAUD_DRIVER"),
  ]);

  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRef(true);
        setRefError(null);
        const r = await fetch(apiUrl("/api/reference/disciplines?active=true"), {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const data = (await readResponseJson(r)) as {
          disciplines?: Array<{
            id: string;
            code: string;
            name: string;
            discipline_subtypes?: Array<{
              id: string;
              name: string;
              code: string | null;
              discipline_id: string;
            }>;
          }>;
        };
        const opts: SubtypeOption[] = [];
        for (const d of data.disciplines ?? []) {
          for (const s of d.discipline_subtypes ?? []) {
            opts.push({
              discipline_id: d.id,
              discipline_code: d.code,
              discipline_name: d.name,
              subtype_id: s.id,
              subtype_name: s.name,
              subtype_code: s.code,
            });
          }
        }
        opts.sort((a, b) =>
          `${a.discipline_code} ${a.subtype_name}`.localeCompare(`${b.discipline_code} ${b.subtype_name}`)
        );
        if (!cancelled) setSubtypeOptions(opts);
      } catch (e) {
        if (!cancelled) setRefError(e instanceof Error ? e.message : "Failed to load disciplines");
      } finally {
        if (!cancelled) setLoadingRef(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jsonText = useMemo(() => {
    try {
      const p = buildPayload(
        moduleCode,
        title,
        description,
        importSource,
        mode,
        questions,
        ofcs,
        riskRows
      );
      return JSON.stringify(p, null, 2);
    } catch {
      return "{}";
    }
  }, [moduleCode, title, description, importSource, mode, questions, ofcs, riskRows]);

  useEffect(() => {
    try {
      const obj = JSON.parse(jsonText) as Record<string, unknown>;
      const res = validateModuleJson(obj, false);
      setValidationIssues(res.issues);
    } catch {
      setValidationIssues([]);
    }
  }, [jsonText]);

  const applySubtypeToQuestion = useCallback((qi: number, subtypeId: string) => {
    const opt = subtypeOptions.find((o) => o.subtype_id === subtypeId);
    setQuestions((prev) => {
      const next = [...prev];
      const row = { ...next[qi] };
      if (opt) {
        row.discipline_id = opt.discipline_id;
        row.discipline_subtype_id = opt.subtype_id;
      } else {
        row.discipline_id = "";
        row.discipline_subtype_id = "";
      }
      next[qi] = row;
      return next;
    });
  }, [subtypeOptions]);

  const slug = moduleSlug(moduleCode);

  const sendToImport = () => {
    try {
      sessionStorage.setItem("psa_module_import_builder_json", jsonText);
      router.push("/admin/modules/import");
    } catch {
      router.push("/admin/modules/import");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Link href="/admin/modules/import" style={{ color: "#0066cc" }}>
          ← Import
        </Link>
        <Link href="/admin/modules/import/help" style={{ color: "#0066cc" }}>
          Help guide
        </Link>
      </div>

      <h1 style={{ marginTop: 0 }}>Module import JSON builder</h1>
      <p style={{ color: "#555", maxWidth: 800 }}>
        Build a valid module import payload with dropdowns for discipline/subtype (no manual UUID pasting).
        IDs are generated as{" "}
        <code>
          MODULEQ_{slug}_### / MOD_OFC_{slug}_###
        </code>{" "}
        from your module code. Copy JSON or open it on the Import page.
      </p>

      {loadingRef && <p style={{ color: "#666" }}>Loading discipline reference…</p>}
      {refError && (
        <div
          style={{
            padding: 12,
            background: "#fee",
            border: "1px solid #c00",
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <strong>Reference data failed:</strong> {refError}
        </div>
      )}

      <section style={{ marginTop: 24, padding: 16, background: "#fafafa", borderRadius: 8, border: "1px solid #e0e0e0" }}>
        <h2 style={{ marginTop: 0 }}>Module metadata</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>module_code *</span>
            <input
              value={moduleCode}
              onChange={(e) => setModuleCode(e.target.value)}
              style={{ padding: 8, fontFamily: "monospace" }}
              placeholder="MODULE_MY_TOPIC"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 8 }} placeholder="Human-readable title" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>import_source</span>
            <input value={importSource} onChange={(e) => setImportSource(e.target.value)} style={{ padding: 8 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600 }}>mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as "REPLACE" | "APPEND")} style={{ padding: 8 }}>
              <option value="REPLACE">REPLACE</option>
              <option value="APPEND">APPEND</option>
            </select>
          </label>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          <span>description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ padding: 8, width: "100%" }} />
        </label>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Module questions</h2>
          <button
            type="button"
            className="usa-button usa-button--outline"
            onClick={() => setQuestions((q) => [...q, emptyQuestion()])}
          >
            Add question
          </button>
        </div>
        {questions.map((q, qi) => (
          <div
            key={qi}
            style={{
              marginTop: 16,
              padding: 16,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              Generated id:{" "}
              <code style={{ fontSize: 13 }}>
                MODULEQ_{slug}_{String(qi + 1).padStart(3, "0")}
              </code>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Question text *</span>
              <textarea
                value={q.text}
                onChange={(e) => {
                  const t = e.target.value;
                  setQuestions((prev) => {
                    const n = [...prev];
                    n[qi] = { ...n[qi], text: t };
                    return n;
                  });
                }}
                rows={3}
                style={{ padding: 8, width: "100%", fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Discipline — subtype *</span>
              <select
                value={q.discipline_subtype_id}
                onChange={(e) => applySubtypeToQuestion(qi, e.target.value)}
                style={{ padding: 8 }}
                disabled={subtypeOptions.length === 0}
              >
                <option value="">Select subtype…</option>
                {subtypeOptions.map((o) => (
                  <option key={o.subtype_id} value={o.subtype_id}>
                    {o.discipline_code} — {o.subtype_name}
                    {o.subtype_code ? ` (${o.subtype_code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600 }}>asset_or_location *</span>
                <input
                  value={q.asset_or_location}
                  onChange={(e) => {
                    const t = e.target.value;
                    setQuestions((prev) => {
                      const n = [...prev];
                      n[qi] = { ...n[qi], asset_or_location: t };
                      return n;
                    });
                  }}
                  style={{ padding: 8 }}
                  placeholder="Concrete noun(s) that also appear in the question"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600 }}>event_trigger *</span>
                <select
                  value={q.event_trigger}
                  onChange={(e) => {
                    const t = e.target.value as QuestionRow["event_trigger"];
                    setQuestions((prev) => {
                      const n = [...prev];
                      n[qi] = { ...n[qi], event_trigger: t };
                      return n;
                    });
                  }}
                  style={{ padding: 8 }}
                >
                  {EVENT_TRIGGERS.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                style={{ marginTop: 12, color: "#b00020", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
              >
                Remove question
              </button>
            )}
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Module OFCs</h2>
          <button type="button" className="usa-button usa-button--outline" onClick={() => setOfcs((o) => [...o, emptyOfc()])}>
            Add OFC
          </button>
        </div>
        {ofcs.length === 0 && (
          <p style={{ color: "#666", marginTop: 12 }}>
            No OFCs yet — optional. Add one or more, or leave empty to import questions only.
          </p>
        )}
        {ofcs.map((o, oi) => (
          <div
            key={oi}
            style={{
              marginTop: 16,
              padding: 16,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              Generated id:{" "}
              <code>
                MOD_OFC_{slug}_{String(oi + 1).padStart(3, "0")}
              </code>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600 }}>ofc_text *</span>
              <textarea
                value={o.ofc_text}
                onChange={(e) => {
                  const t = e.target.value;
                  setOfcs((prev) => {
                    const n = [...prev];
                    n[oi] = { ...n[oi], ofc_text: t };
                    return n;
                  });
                }}
                rows={3}
                style={{ padding: 8, width: "100%" }}
                placeholder="Physical security–only recommendation"
              />
            </label>
            <div style={{ marginTop: 12 }}>
              <span style={{ fontWeight: 600 }}>Sources (optional)</span>
              {o.sources.map((s, si) => (
                <div key={si} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <input
                    placeholder="URL"
                    value={s.url}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOfcs((prev) => {
                        const n = [...prev];
                        const src = [...n[oi].sources];
                        src[si] = { ...src[si], url: v };
                        n[oi] = { ...n[oi], sources: src };
                        return n;
                      });
                    }}
                    style={{ padding: 8, flex: 1, minWidth: 200 }}
                  />
                  <input
                    placeholder="Label"
                    value={s.label}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOfcs((prev) => {
                        const n = [...prev];
                        const src = [...n[oi].sources];
                        src[si] = { ...src[si], label: v };
                        n[oi] = { ...n[oi], sources: src };
                        return n;
                      });
                    }}
                    style={{ padding: 8, flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setOfcs((prev) => {
                        const n = [...prev];
                        n[oi] = { ...n[oi], sources: n[oi].sources.filter((_, i) => i !== si) };
                        return n;
                      });
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                style={{ marginTop: 8 }}
                className="usa-button usa-button--outline"
                onClick={() =>
                  setOfcs((prev) => {
                    const n = [...prev];
                    n[oi] = { ...n[oi], sources: [...n[oi].sources, { url: "", label: "" }] };
                    return n;
                  })
                }
              >
                Add source row
              </button>
            </div>
            <button
              type="button"
              style={{ marginTop: 12, color: "#b00020", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => setOfcs((prev) => prev.filter((_, i) => i !== oi))}
            >
              Remove OFC
            </button>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Risk drivers (optional)</h2>
        <p style={{ color: "#666", fontSize: 14 }}>Leave blank to omit. Cyber/fraud context only — not scored as questions.</p>
        {riskRows.map((r, ri) => (
          <div key={ri} style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.driver_type.replace(/_/g, " ")}</div>
            <textarea
              value={r.driver_text}
              onChange={(e) => {
                const t = e.target.value;
                setRiskRows((prev) => {
                  const n = [...prev];
                  n[ri] = { ...n[ri], driver_text: t };
                  return n;
                });
              }}
              rows={2}
              style={{ padding: 8, width: "100%" }}
            />
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Generated JSON</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            className="usa-button"
            onClick={() => {
              void navigator.clipboard.writeText(jsonText);
            }}
          >
            Copy JSON
          </button>
          <button
            type="button"
            className="usa-button usa-button--outline"
            onClick={() => {
              const blob = new Blob([jsonText], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${moduleSlug(moduleCode) || "module"}_import.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download .json
          </button>
          <button type="button" className="usa-button usa-button--outline" onClick={sendToImport}>
            Open in Import page
          </button>
        </div>

        {validationIssues.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              background: validationIssues.some((i) => i.level === "error") ? "#fee" : "#fff8e6",
              borderRadius: 4,
              maxHeight: 220,
              overflow: "auto",
            }}
          >
            <strong>Validation</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {validationIssues.slice(0, 25).map((issue, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  [{issue.field}] {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <textarea
          readOnly
          value={jsonText}
          rows={22}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: 12,
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#f8f8f8",
          }}
        />
      </section>
    </div>
  );
}
